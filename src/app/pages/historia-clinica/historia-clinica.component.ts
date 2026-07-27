import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { DocumentoClinico, EstadoRegistro, HistoriaClinica, HistoriaClinicaInsert, Json } from '../../core/models/interfaces/database.types';
import { HistoriaService } from '../../core/services/historia.service';
import { PacientesService } from '../../core/services/pacientes.service';
import { ToastService } from '../../core/services/toast.service';
import { ValidationFeedbackDirective } from '../../shared/directives/validation-feedback.directive';
import {
  allowedValues,
  ecuadorianCedula,
  emptyToNull,
  maxTrimLength,
  normalizeWhitespace,
  notBlankOptional,
  requiredTrim
} from '../../shared/utils/validation.utils';

@Component({
  selector: 'app-historia-clinica',
  standalone: true,
  imports: [ReactiveFormsModule, ValidationFeedbackDirective],
  templateUrl: './historia-clinica.component.html'
})
export class HistoriaClinicaComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly historiaService = inject(HistoriaService);
  private readonly pacientesService = inject(PacientesService);
  private readonly toast = inject(ToastService);
  readonly historias = signal<HistoriaClinica[]>([]);
  readonly selectedId = signal<string | null>(null);
  readonly loading = this.historiaService.loading;
  readonly pacientesPorId = signal<Map<string, string>>(new Map());
  readonly documentos = signal<DocumentoClinico[]>([]);
  readonly pacienteInfo = signal<string | null>(null);
  readonly pacienteError = signal<string | null>(null);
  readonly buscandoPaciente = signal(false);
  readonly form = this.fb.nonNullable.group({
    cedula: ['', [requiredTrim(), ecuadorianCedula()]],
    paciente_id: ['', Validators.required],
    usuario_id: [''],
    motivo_consulta: ['', [requiredTrim(), maxTrimLength(500)]],
    enfermedad_actual: ['', [notBlankOptional(), maxTrimLength(1000)]],
    seguros: ['', [notBlankOptional(), maxTrimLength(300)]],
    signos_vitales: ['', [notBlankOptional(), maxTrimLength(600)]],
    examen_estomatognatico: ['', [notBlankOptional(), maxTrimLength(1200)]],
    diagnosticos: ['', [notBlankOptional(), maxTrimLength(1000)]],
    plan_tratamiento: ['', [notBlankOptional(), maxTrimLength(1200)]],
    observaciones: ['', [notBlankOptional(), maxTrimLength(500)]],
    estado: ['activo' as EstadoRegistro, [Validators.required, allowedValues(['activo', 'pendiente', 'completado', 'anulado'] as const)]]
  });

  ngOnInit(): void { void this.load(); }

  async load(): Promise<void> {
    try {
      const [historias, pacientes] = await Promise.all([
        this.historiaService.findAll({ orderBy: 'created_at', ascending: false }),
        this.pacientesService.findAll({ orderBy: 'apellidos', ascending: true })
      ]);
      this.historias.set(historias);
      this.pacientesPorId.set(new Map(pacientes.map((paciente) => [paciente.id, `${paciente.apellidos} ${paciente.nombres} (${paciente.cedula})`])));
    } catch (error) {
      this.toast.error(error instanceof Error ? error.message : 'No se cargaron historias');
    }
  }

  edit(historia: HistoriaClinica): void {
    this.selectedId.set(historia.id);
    const pacienteLabel = this.pacientesPorId().get(historia.paciente_id) ?? '';
    const cedula = pacienteLabel.match(/\((\d{10})\)$/)?.[1] ?? '';
    this.form.patchValue({
      cedula,
      paciente_id: historia.paciente_id,
      usuario_id: historia.usuario_id ?? '',
      motivo_consulta: historia.motivo_consulta ?? '',
      enfermedad_actual: historia.enfermedad_actual ?? '',
      seguros: '',
      signos_vitales: this.stringifyJson(historia.signos_vitales),
      examen_estomatognatico: this.stringifyJson(historia.examen_estomatognatico),
      diagnosticos: this.stringifyJson(historia.diagnosticos),
      plan_tratamiento: historia.plan_tratamiento ?? '',
      observaciones: historia.observaciones ?? '',
      estado: historia.estado
    });
    void this.cargarSegurosPaciente(historia.paciente_id);
  }

  clear(): void {
    this.selectedId.set(null);
    this.documentos.set([]);
    this.form.reset({ cedula: '', paciente_id: '', usuario_id: '', motivo_consulta: '', enfermedad_actual: '', seguros: '', signos_vitales: '', examen_estomatognatico: '', diagnosticos: '', plan_tratamiento: '', observaciones: '', estado: 'activo' });
    this.form.markAsPristine();
    this.form.markAsUntouched();
    this.pacienteInfo.set(null);
    this.pacienteError.set(null);
  }

  async save(): Promise<void> {
    if (this.loading()) { return; }
    this.normalizeForm();
    this.validateEstadoClinico();
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    const raw = this.form.getRawValue();
    if (!raw.paciente_id) {
      this.pacienteError.set('Busca un paciente por cédula antes de guardar la historia clínica.');
      return;
    }
    const payload: HistoriaClinicaInsert = {
      paciente_id: raw.paciente_id,
      usuario_id: emptyToNull(raw.usuario_id),
      motivo_consulta: normalizeWhitespace(raw.motivo_consulta),
      enfermedad_actual: emptyToNull(raw.enfermedad_actual),
      antecedentes_personales: null,
      antecedentes_familiares: null,
      signos_vitales: this.parseJson(raw.signos_vitales),
      examen_estomatognatico: this.parseJson(raw.examen_estomatognatico),
      diagnosticos: this.parseJson(raw.diagnosticos),
      plan_tratamiento: emptyToNull(raw.plan_tratamiento),
      observaciones: emptyToNull(raw.observaciones),
      estado: raw.estado
    };
    try {
      const id = this.selectedId();
      const saved = id ? await this.historiaService.update(id, payload) : await this.historiaService.create(payload);
      await this.guardarSeguros(raw.paciente_id, raw.seguros);
      this.toast.success('Historia clinica guardada');
      this.clear();
      this.selectedId.set(saved.id);
      await this.load();
      await this.cargarDocumentos(raw.paciente_id, saved.id);
    } catch (error) { this.toast.error(error instanceof Error ? error.message : 'No se pudo guardar historia'); }
  }

  async remove(historia: HistoriaClinica): Promise<void> {
    if (!window.confirm('¿Está seguro de eliminar esta historia clínica?')) {
      return;
    }
    try { await this.historiaService.delete(historia.id); this.toast.success('Historia eliminada'); await this.load(); }
    catch (error) { this.toast.error(error instanceof Error ? error.message : 'No se pudo eliminar historia'); }
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
        result.seguro ? `Seguro: ${result.seguro}` : null,
        result.historia ? `HC: ${result.historia.numero_formulario || 'registrada'}` : 'Sin historia clínica'
      ].filter(Boolean) as string[];
      this.pacienteInfo.set(details.join(' • '));
    } catch (error) {
      this.pacienteError.set(error instanceof Error ? error.message : 'No se pudo buscar el paciente.');
    } finally {
      this.buscandoPaciente.set(false);
    }
  }

  async upload(event: Event, tipo: 'radiografia' | 'documento'): Promise<void> {
    const pacienteId = this.form.controls.paciente_id.value;
    const historiaId = this.selectedId();
    const input = event.target as HTMLInputElement;
    const file = input.files?.item(0);
    if (!pacienteId || !file) { this.toast.error('Selecciona un paciente antes de subir archivos'); return; }
    try {
      await this.pacientesService.uploadDocumento(pacienteId, file, tipo, historiaId);
      await this.cargarDocumentos(pacienteId, historiaId);
      this.toast.success('Archivo clinico subido');
      input.value = '';
    } catch (error) { this.toast.error(error instanceof Error ? error.message : 'No se pudo subir archivo'); }
  }

  async eliminarDocumento(documento: DocumentoClinico): Promise<void> {
    try {
      await this.pacientesService.eliminarDocumento(documento);
      this.documentos.set(this.documentos().filter((item) => item.id !== documento.id));
      this.toast.success('Archivo eliminado');
    } catch (error) {
      this.toast.error(error instanceof Error ? error.message : 'No se pudo eliminar archivo');
    }
  }

  abrirDocumento(documento: DocumentoClinico): void {
    window.open(documento.url, '_blank', 'noopener,noreferrer');
  }

  pacienteDisplayValue(): string {
    return this.pacienteInfo() ?? 'Sin paciente seleccionado';
  }

  pacienteNombre(pacienteId: string): string {
    return this.pacientesPorId().get(pacienteId) ?? 'Paciente sin identificar';
  }

  print(): void { window.print(); }

  private async cargarSegurosPaciente(pacienteId: string): Promise<void> {
    try {
      const seguros = await this.pacientesService.listarSegurosPaciente(pacienteId);
      this.form.patchValue({ seguros: seguros.map((seguro) => seguro.nombre).join(', ') });
    } catch {
      this.form.patchValue({ seguros: '' });
    }
  }

  private async guardarSeguros(pacienteId: string, seguros: string): Promise<void> {
    if (!pacienteId) {
      return;
    }
    const list = seguros.split(/[\n,]+/).map((item) => item.trim()).filter(Boolean);
    for (const seguro of list) {
      await this.pacientesService.guardarSeguroPaciente(pacienteId, seguro);
    }
  }

  private async cargarDocumentos(pacienteId: string, historiaId: string | null): Promise<void> {
    try {
      const documentos = await this.pacientesService.listarDocumentos(pacienteId, historiaId);
      this.documentos.set(documentos);
    } catch {
      this.documentos.set([]);
    }
  }

  private parseJson(value: string): Json | null {
    if (!value.trim()) { return null; }
    try { return JSON.parse(value) as Json; }
    catch { return value; }
  }

  private stringifyJson(value: Json | null): string {
    return value === null ? '' : JSON.stringify(value, null, 2);
  }

  private normalizeForm(): void {
    const raw = this.form.getRawValue();
    this.form.patchValue({
      cedula: normalizeWhitespace(raw.cedula),
      usuario_id: normalizeWhitespace(raw.usuario_id),
      motivo_consulta: normalizeWhitespace(raw.motivo_consulta),
      enfermedad_actual: normalizeWhitespace(raw.enfermedad_actual),
      seguros: normalizeWhitespace(raw.seguros),
      signos_vitales: normalizeWhitespace(raw.signos_vitales),
      examen_estomatognatico: normalizeWhitespace(raw.examen_estomatognatico),
      diagnosticos: normalizeWhitespace(raw.diagnosticos),
      plan_tratamiento: normalizeWhitespace(raw.plan_tratamiento),
      observaciones: normalizeWhitespace(raw.observaciones)
    }, { emitEvent: false });
  }

  private validateEstadoClinico(): void {
    const diagnosticos = this.form.controls.diagnosticos;
    const errors = { ...(diagnosticos.errors ?? {}) };
    if (this.form.controls.estado.value === 'completado' && !normalizeWhitespace(diagnosticos.value)) {
      errors['required'] = true;
    } else {
      delete errors['required'];
    }
    diagnosticos.setErrors(Object.keys(errors).length ? errors : null);
  }
}
