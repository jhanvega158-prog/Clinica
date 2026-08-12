import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { EstadoRegistro, Tratamiento, TratamientoInsert } from '../../core/models/interfaces/database.types';
import { PacientesService } from '../../core/services/pacientes.service';
import { ToastService } from '../../core/services/toast.service';
import { TratamientosService } from '../../core/services/tratamientos.service';
import { todayIso } from '../../shared/utils/date-utils';
import { ValidationFeedbackDirective } from '../../shared/directives/validation-feedback.directive';
import {
  allowedValues,
  ecuadorianCedula,
  emptyToNull,
  maxTrimLength,
  maxTwoDecimals,
  nonNegativeNumber,
  normalizeWhitespace,
  notBlankOptional,
  notFutureDate,
  requiredTrim
} from '../../shared/utils/validation.utils';

@Component({
  selector: 'app-tratamientos',
  standalone: true,
  imports: [ReactiveFormsModule, ValidationFeedbackDirective],
  templateUrl: './tratamientos.component.html'
})
export class TratamientosComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly tratamientosService = inject(TratamientosService);
  private readonly pacientesService = inject(PacientesService);
  private readonly toast = inject(ToastService);
  readonly tratamientos = signal<Tratamiento[]>([]);
  readonly selectedId = signal<string | null>(null);
  readonly loading = this.tratamientosService.loading;
  readonly pacientesPorId = signal<Map<string, string>>(new Map());
  readonly pacienteInfo = signal<string | null>(null);
  readonly pacienteError = signal<string | null>(null);
  readonly buscandoPaciente = signal(false);
  readonly form = this.fb.nonNullable.group({
    cedula: ['', [requiredTrim(), ecuadorianCedula()]],
    paciente_id: ['', Validators.required],
    historia_id: [''],
    diagnostico: ['', [requiredTrim(), maxTrimLength(400)]],
    procedimiento: ['', [requiredTrim(), maxTrimLength(600)]],
    prescripcion: ['', [notBlankOptional(), maxTrimLength(500)]],
    fecha: [todayIso(), [Validators.required, notFutureDate()]],
    estado: ['pendiente' as EstadoRegistro, [Validators.required, allowedValues(['pendiente', 'activo', 'completado', 'anulado'] as const)]],
    costo: [0, [Validators.required, nonNegativeNumber(), maxTwoDecimals()]],
    notas: ['', [notBlankOptional(), maxTrimLength(300)]]
  });

  ngOnInit(): void { void this.load(); }

  async load(): Promise<void> {
    try {
      const [tratamientos, pacientes] = await Promise.all([
        this.tratamientosService.findAll({ orderBy: 'fecha', ascending: false }),
        this.pacientesService.findAll({ orderBy: 'apellidos', ascending: true })
      ]);
      this.tratamientos.set(tratamientos);
      this.pacientesPorId.set(new Map(pacientes.map((paciente) => [paciente.id, `${paciente.apellidos} ${paciente.nombres} (${paciente.cedula})`])));
    } catch (error) {
      this.toast.error(error instanceof Error ? error.message : 'No se cargaron tratamientos');
    }
  }

  edit(item: Tratamiento): void {
    this.selectedId.set(item.id);
    const pacienteLabel = this.pacientesPorId().get(item.paciente_id) ?? '';
    const cedula = pacienteLabel.match(/\((\d{10})\)$/)?.[1] ?? '';
    this.form.patchValue({ ...item, cedula, historia_id: item.historia_id ?? '', prescripcion: item.prescripcion ?? '', costo: item.costo ?? 0, notas: item.notas ?? '' });
  }

  clear(): void {
    this.selectedId.set(null);
    this.form.reset({ cedula: '', paciente_id: '', historia_id: '', diagnostico: '', procedimiento: '', prescripcion: '', fecha: todayIso(), estado: 'pendiente', costo: 0, notas: '' });
    this.form.markAsPristine();
    this.form.markAsUntouched();
    this.pacienteInfo.set(null);
    this.pacienteError.set(null);
  }

  async save(): Promise<void> {
    if (this.loading()) { return; }
    this.normalizeForm();
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    const raw = this.form.getRawValue();
    if (!raw.paciente_id) {
      this.pacienteError.set('Busca un paciente por cédula antes de guardar el tratamiento.');
      return;
    }
    const payload: TratamientoInsert = { paciente_id: raw.paciente_id, historia_id: emptyToNull(raw.historia_id), diagnostico: normalizeWhitespace(raw.diagnostico), procedimiento: normalizeWhitespace(raw.procedimiento), prescripcion: emptyToNull(raw.prescripcion), fecha: raw.fecha, estado: raw.estado, costo: Number(raw.costo), notas: emptyToNull(raw.notas) };
    try {
      const id = this.selectedId();
      id ? await this.tratamientosService.update(id, payload) : await this.tratamientosService.create(payload);
      this.toast.success('Tratamiento guardado');
      this.clear();
      await this.load();
    } catch (error) { this.toast.error(error instanceof Error ? error.message : 'No se pudo guardar tratamiento'); }
  }

  async buscarPacientePorCedula(): Promise<void> {
    const cedula = normalizeWhitespace(this.form.controls.cedula.value);
    if (!cedula) {
      this.pacienteInfo.set(null);
      this.pacienteError.set(null);
      return;
    }

    this.buscandoPaciente.set(true);
    this.pacienteError.set(null);
    try {
      const result = await this.pacientesService.buscarPorCedulaConDetalles(cedula);
      if (!result.paciente) {
        this.form.patchValue({ paciente_id: '' });
        this.pacienteInfo.set(null);
        this.pacienteError.set('No existe un paciente registrado con esa cédula.');
        return;
      }

      this.form.patchValue({ paciente_id: result.paciente.id, cedula: result.paciente.cedula });
      const details = [
        `${result.paciente.apellidos} ${result.paciente.nombres}`,
        result.edad !== null ? `Edad: ${result.edad} años` : null,
        result.paciente.telefono ? `Tel.: ${result.paciente.telefono}` : null,
        result.paciente.email ? `Email: ${result.paciente.email}` : null,
        result.paciente.direccion ? `Dir.: ${result.paciente.direccion}` : null,
        result.seguro ? `Seguro: ${result.seguro}` : null
      ].filter(Boolean) as string[];
      this.pacienteInfo.set(details.join(' • '));
    } catch (error) {
      this.pacienteError.set(error instanceof Error ? error.message : 'No se pudo buscar el paciente.');
    } finally {
      this.buscandoPaciente.set(false);
    }
  }

  pacienteDisplayValue(): string {
    return this.pacienteInfo() ?? 'Sin paciente seleccionado';
  }

  pacienteNombre(pacienteId: string): string {
    return this.pacientesPorId().get(pacienteId) ?? 'Paciente sin identificar';
  }

  async remove(item: Tratamiento): Promise<void> {
    if (!window.confirm('¿Está seguro de eliminar este tratamiento?')) {
      return;
    }
    try { await this.tratamientosService.delete(item.id); this.toast.success('Tratamiento eliminado'); await this.load(); }
    catch (error) { this.toast.error(error instanceof Error ? error.message : 'No se pudo eliminar tratamiento'); }
  }

  private normalizeForm(): void {
    const raw = this.form.getRawValue();
    this.form.patchValue({
      cedula: normalizeWhitespace(raw.cedula),
      historia_id: normalizeWhitespace(raw.historia_id),
      diagnostico: normalizeWhitespace(raw.diagnostico),
      procedimiento: normalizeWhitespace(raw.procedimiento),
      prescripcion: normalizeWhitespace(raw.prescripcion),
      notas: normalizeWhitespace(raw.notas)
    }, { emitEvent: false });
  }
}
