import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { EstadoRegistro, Factura, FacturaInsert } from '../../core/models/interfaces/database.types';
import { FacturacionService } from '../../core/services/facturacion.service';
import { PacientesService } from '../../core/services/pacientes.service';
import { ToastService } from '../../core/services/toast.service';
import { todayIso } from '../../shared/utils/date-utils';

@Component({
  selector: 'app-facturacion',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './facturacion.component.html'
})
export class FacturacionComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly facturacionService = inject(FacturacionService);
  private readonly pacientesService = inject(PacientesService);
  private readonly toast = inject(ToastService);
  readonly facturas = signal<Factura[]>([]);
  readonly selectedId = signal<string | null>(null);
  readonly loading = this.facturacionService.loading;
  readonly pacientesPorId = signal<Map<string, string>>(new Map());
  readonly pacienteInfo = signal<string | null>(null);
  readonly pacienteError = signal<string | null>(null);
  readonly buscandoPaciente = signal(false);
  readonly form = this.fb.nonNullable.group({
    cedula: ['', Validators.required],
    paciente_id: ['', Validators.required],
    numero: ['', Validators.required],
    fecha: [todayIso(), Validators.required],
    subtotal: [0, Validators.required],
    impuesto: [0],
    descuento: [0],
    estado: ['pendiente' as EstadoRegistro, Validators.required],
    observaciones: ['']
  });

  ngOnInit(): void { void this.load(); }

  async load(): Promise<void> {
    try {
      const [facturas, pacientes] = await Promise.all([
        this.facturacionService.findAll({ orderBy: 'fecha', ascending: false }),
        this.pacientesService.findAll({ orderBy: 'apellidos', ascending: true })
      ]);
      this.facturas.set(facturas);
      this.pacientesPorId.set(new Map(pacientes.map((paciente) => [paciente.id, `${paciente.apellidos} ${paciente.nombres} (${paciente.cedula})`])));
    } catch (error) {
      this.toast.error(error instanceof Error ? error.message : 'No se cargaron facturas');
    }
  }

  edit(factura: Factura): void {
    this.selectedId.set(factura.id);
    this.form.patchValue({ ...factura, observaciones: factura.observaciones ?? '' });
  }

  clear(): void {
    this.selectedId.set(null);
    this.form.reset({ cedula: '', paciente_id: '', numero: '', fecha: todayIso(), subtotal: 0, impuesto: 0, descuento: 0, estado: 'pendiente', observaciones: '' });
    this.pacienteInfo.set(null);
    this.pacienteError.set(null);
  }

  total(): number {
    const raw = this.form.getRawValue();
    return (Number(raw.subtotal) || 0) + (Number(raw.impuesto) || 0) - (Number(raw.descuento) || 0);
  }

  async save(): Promise<void> {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    const raw = this.form.getRawValue();
    if (!raw.paciente_id) {
      this.pacienteError.set('Busca un paciente por cédula antes de guardar la factura.');
      return;
    }
    const payload: FacturaInsert = { paciente_id: raw.paciente_id, numero: raw.numero, fecha: raw.fecha, subtotal: Number(raw.subtotal) || 0, impuesto: Number(raw.impuesto) || 0, descuento: Number(raw.descuento) || 0, total: this.total(), estado: raw.estado, observaciones: raw.observaciones || null };
    try {
      const id = this.selectedId();
      id ? await this.facturacionService.update(id, payload) : await this.facturacionService.create(payload);
      this.toast.success('Factura guardada');
      this.clear();
      await this.load();
    } catch (error) { this.toast.error(error instanceof Error ? error.message : 'No se pudo guardar factura'); }
  }

  async buscarPacientePorCedula(): Promise<void> {
    const cedula = this.form.controls.cedula.value.trim();
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

  async remove(factura: Factura): Promise<void> {
    try { await this.facturacionService.delete(factura.id); this.toast.success('Factura eliminada'); await this.load(); }
    catch (error) { this.toast.error(error instanceof Error ? error.message : 'No se pudo eliminar factura'); }
  }

  print(): void {
    window.print();
  }
}
