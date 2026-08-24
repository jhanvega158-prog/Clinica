import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { AbstractControl, FormArray, FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { DetalleFactura, EstadoFactura, Factura, Paciente, Tratamiento } from '../../core/models/interfaces/database.types';
import { AuthService } from '../../core/services/auth.service';
import { FacturacionService } from '../../core/services/facturacion.service';
import { PacientesService } from '../../core/services/pacientes.service';
import { ToastService } from '../../core/services/toast.service';
import { TratamientosService } from '../../core/services/tratamientos.service';
import { todayIso } from '../../shared/utils/date-utils';
import { ValidationFeedbackDirective } from '../../shared/directives/validation-feedback.directive';
import { allowedValues, ecuadorianCedula, emptyToNull, maxTrimLength, normalizeWhitespace, notBlankOptional, notFutureDate, requiredTrim } from '../../shared/utils/validation.utils';

@Component({
  selector: 'app-facturacion',
  standalone: true,
  imports: [ReactiveFormsModule, ValidationFeedbackDirective],
  templateUrl: './facturacion.component.html',
  styleUrl: './facturacion.component.css'
})
export class FacturacionComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly facturacionService = inject(FacturacionService);
  private readonly pacientesService = inject(PacientesService);
  private readonly tratamientosService = inject(TratamientosService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);

  readonly facturas = signal<Factura[]>([]);
  readonly tratamientos = signal<Tratamiento[]>([]);
  readonly pacientes = signal<Map<string, Paciente>>(new Map());
  readonly selectedId = signal<string | null>(null);
  readonly pacienteActual = signal<Paciente | null>(null);
  readonly pacienteInfo = signal<string | null>(null);
  readonly pacienteError = signal<string | null>(null);
  readonly buscandoPaciente = signal(false);
  readonly generandoPdf = signal(false);
  readonly filterVersion = signal(0);
  readonly loading = this.facturacionService.loading;

  readonly form = this.fb.nonNullable.group({
    cedula: ['', [requiredTrim(), ecuadorianCedula()]],
    paciente_id: ['', Validators.required],
    numero: [{ value: '', disabled: true }, [Validators.required]],
    fecha: [todayIso(), [Validators.required, notFutureDate()]],
    estado: ['pendiente' as EstadoFactura, [Validators.required, allowedValues(['pendiente', 'completado', 'anulado'] as const)]],
    iva_porcentaje: [0, [Validators.required, Validators.min(0), Validators.max(100)]],
    observaciones: ['', [notBlankOptional(), maxTrimLength(300)]]
  });
  readonly lineas: FormArray = this.fb.array([]);
  readonly filtros = this.fb.nonNullable.group({ texto: [''], estado: [''], desde: [''], hasta: [''] });

  readonly tratamientosDisponibles = computed(() => {
    const pacienteId = this.pacienteActual()?.id;
    const all = this.tratamientos();
    return pacienteId ? all.filter((item) => item.paciente_id === pacienteId) : all;
  });
  readonly facturasFiltradas = computed(() => {
    this.filterVersion();
    const { texto, estado, desde, hasta } = this.filtros.getRawValue();
    const term = normalizeWhitespace(texto).toLowerCase();
    return this.facturas().filter((factura) => {
      const patient = this.pacientes().get(factura.paciente_id);
      const patientText = patient ? `${patient.nombres} ${patient.apellidos} ${patient.cedula}`.toLowerCase() : '';
      return (!term || factura.numero.toLowerCase().includes(term) || patientText.includes(term))
        && (!estado || factura.estado === estado)
        && (!desde || factura.fecha >= desde)
        && (!hasta || factura.fecha <= hasta);
    });
  });
  readonly professionalName = computed(() => {
    const profile = this.auth.profile();
    return profile ? `${profile.nombres} ${profile.apellidos}`.trim() : 'Responsable VitaDenti';
  });

  async ngOnInit(): Promise<void> {
    this.agregarServicio();
    await this.load();
    await this.prepareNewNumber();
  }

  async load(): Promise<void> {
    try {
      const [facturas, pacientes, tratamientos] = await Promise.all([
        this.facturacionService.findAll({ orderBy: 'created_at', ascending: false }),
        this.pacientesService.findAll({ orderBy: 'apellidos', ascending: true }),
        this.tratamientosService.findAll({ orderBy: 'fecha', ascending: false })
      ]);
      this.facturas.set(facturas);
      this.pacientes.set(new Map(pacientes.map((paciente) => [paciente.id, paciente])));
      this.tratamientos.set(tratamientos);
    } catch (error) {
      this.toast.error(error instanceof Error ? error.message : 'No se cargaron las facturas.');
    }
  }

  agregarServicio(item?: Partial<DetalleFactura>): void {
    this.lineas.push(this.fb.nonNullable.group({
      tratamiento_id: [item?.tratamiento_id ?? 'otro'],
      descripcion: [item?.descripcion ?? '', [Validators.required, maxTrimLength(180)]],
      cantidad: [Number(item?.cantidad ?? 1), [Validators.required, Validators.min(0.01)]],
      precio_unitario: [Number(item?.precio_unitario ?? 0), [Validators.required, Validators.min(0)]],
      descuento: [Number(item?.descuento ?? 0), [Validators.min(0)]]
    }));
  }

  eliminarServicio(index: number): void {
    this.lineas.removeAt(index);
    if (!this.lineas.length) this.agregarServicio();
  }

  seleccionarTratamiento(index: number): void {
    const line = this.lineas.at(index);
    const id = line.get('tratamiento_id')?.value;
    if (id === 'otro') {
      line.patchValue({ descripcion: '', precio_unitario: 0 });
      return;
    }
    const tratamiento = this.tratamientos().find((item) => item.id === id);
    if (tratamiento) line.patchValue({ descripcion: tratamiento.procedimiento, precio_unitario: Number(tratamiento.costo ?? 0) });
  }

  lineaTotal(index: number): number {
    const raw = this.lineas.at(index).getRawValue();
    return this.money(Math.max(Number(raw.cantidad || 0) * Number(raw.precio_unitario || 0) - Number(raw.descuento || 0), 0));
  }

  subtotal(): number {
    return this.money(this.lineas.controls.reduce((sum, line) => {
      const raw = line.getRawValue();
      return sum + Number(raw.cantidad || 0) * Number(raw.precio_unitario || 0);
    }, 0));
  }

  descuentoTotal(): number {
    return this.money(this.lineas.controls.reduce((sum, line) => sum + Number(line.get('descuento')?.value || 0), 0));
  }

  impuesto(): number {
    return this.money(Math.max(this.subtotal() - this.descuentoTotal(), 0) * Number(this.form.controls.iva_porcentaje.value || 0) / 100);
  }

  total(): number { return this.money(this.subtotal() - this.descuentoTotal() + this.impuesto()); }

  async save(): Promise<void> {
    const current = this.facturas().find((factura) => factura.id === this.selectedId());
    if (current?.estado === 'anulado') { this.toast.error('Una factura anulada no puede editarse.'); return; }
    this.normalizeForm();
    if (this.form.invalid || this.lineas.invalid) {
      this.form.markAllAsTouched(); this.lineas.markAllAsTouched(); return;
    }
    if (!this.form.controls.paciente_id.value) {
      this.pacienteError.set('Busca un paciente por cédula antes de guardar la factura.'); return;
    }
    if (this.lineas.controls.some((_, index) => Number(this.lineas.at(index).get('descuento')?.value || 0) > Number(this.lineas.at(index).get('cantidad')?.value || 0) * Number(this.lineas.at(index).get('precio_unitario')?.value || 0))) {
      this.toast.error('El descuento de un servicio no puede superar su importe.'); return;
    }
    try {
      const raw = this.form.getRawValue();
      const saved = await this.facturacionService.guardarConDetalles(this.selectedId(), {
        paciente_id: raw.paciente_id, numero: raw.numero, fecha: raw.fecha, estado: raw.estado,
        iva_porcentaje: Number(raw.iva_porcentaje),
        observaciones: emptyToNull(raw.observaciones)
      }, this.lineas.controls.map((line, index) => {
        const item = line.getRawValue();
        return { tratamiento_id: item.tratamiento_id === 'otro' ? null : item.tratamiento_id, descripcion: normalizeWhitespace(item.descripcion), cantidad: Math.trunc(Number(item.cantidad)), precio_unitario: Number(item.precio_unitario), descuento: Number(item.descuento), total: this.lineaTotal(index) };
      }));
      this.selectedId.set(saved.id);
      this.form.controls.numero.setValue(saved.numero);
      this.toast.success('Factura guardada correctamente.');
      await this.load();
    } catch (error) {
      this.toast.error(error instanceof Error ? error.message : 'No se pudo guardar la factura.');
    }
  }

  async edit(factura: Factura): Promise<void> {
    try {
      const complete = await this.facturacionService.cargarCompleta(factura.id);
      factura = complete.factura;
      const items = complete.detalles;
      const patient = this.pacientes().get(factura.paciente_id) ?? await this.pacientesService.findById(factura.paciente_id);
      this.form.enable({ emitEvent: false });
      this.lineas.enable({ emitEvent: false });
      this.selectedId.set(factura.id);
      this.pacienteActual.set(patient);
      this.pacienteInfo.set(patient ? this.patientSummary(patient) : null);
      this.form.reset({ cedula: patient?.cedula ?? '', paciente_id: factura.paciente_id, numero: factura.numero, fecha: factura.fecha, estado: factura.estado, iva_porcentaje: Number(factura.iva_porcentaje ?? 0), observaciones: factura.observaciones ?? '' });
      this.form.controls.numero.disable({ emitEvent: false });
      this.lineas.clear();
      items.forEach((item) => this.agregarServicio(item));
      if (!items.length) this.agregarServicio({ descripcion: 'Detalle no disponible', cantidad: 1, precio_unitario: factura.subtotal, descuento: factura.descuento });
      if (factura.estado === 'anulado') { this.form.disable({ emitEvent: false }); this.lineas.disable({ emitEvent: false }); }
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (error) { this.toast.error(error instanceof Error ? error.message : 'No se cargó el detalle de la factura.'); }
  }

  async clear(): Promise<void> {
    this.form.enable({ emitEvent: false }); this.lineas.enable({ emitEvent: false });
    this.selectedId.set(null); this.pacienteActual.set(null); this.pacienteInfo.set(null); this.pacienteError.set(null);
    this.form.reset({ cedula: '', paciente_id: '', numero: '', fecha: todayIso(), estado: 'pendiente', iva_porcentaje: 0, observaciones: '' });
    this.lineas.clear(); this.agregarServicio();
    await this.prepareNewNumber();
  }

  async buscarPacientePorCedula(): Promise<void> {
    const cedula = normalizeWhitespace(this.form.controls.cedula.value);
    if (!cedula) return;
    this.buscandoPaciente.set(true); this.pacienteError.set(null);
    try {
      const result = await this.pacientesService.buscarPorCedulaConDetalles(cedula);
      if (!result.paciente) {
        this.form.patchValue({ paciente_id: '' }); this.pacienteActual.set(null); this.pacienteInfo.set(null);
        this.pacienteError.set('No existe un paciente registrado con esa cédula.'); return;
      }
      this.form.patchValue({ paciente_id: result.paciente.id, cedula: result.paciente.cedula });
      this.pacienteActual.set(result.paciente); this.pacienteInfo.set(this.patientSummary(result.paciente));
    } catch (error) { this.pacienteError.set(error instanceof Error ? error.message : 'No se pudo buscar el paciente.'); }
    finally { this.buscandoPaciente.set(false); }
  }

  async cambiarEstado(factura: Factura, estado: EstadoFactura): Promise<void> {
    if (factura.estado === 'anulado') return;
    if (estado === 'anulado' && !window.confirm(`¿Está seguro de anular la factura ${factura.numero}?`)) return;
    try { await this.facturacionService.cambiarEstado(factura.id, estado); this.toast.success(estado === 'anulado' ? 'Factura anulada.' : 'Factura marcada como pagada.'); await this.load(); }
    catch (error) { this.toast.error(error instanceof Error ? error.message : 'No se actualizó la factura.'); }
  }

  async descargarFactura(factura?: Factura): Promise<void> {
    if (factura) await this.edit(factura);
    if (!this.selectedId()) { this.toast.error('Primero debe guardar la factura.'); return; }
    const complete = await this.facturacionService.cargarCompleta(this.selectedId()!);
    await this.edit(complete.factura);
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    const sheet = document.getElementById('factura-pdf');
    if (!sheet) return;
    this.generandoPdf.set(true);
    try {
      await this.waitForImages(sheet);
      const canvas = await html2canvas(sheet, { scale: 2, backgroundColor: '#fff', useCORS: true, logging: false });
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
      const margin = 8, maxWidth = pdf.internal.pageSize.getWidth() - margin * 2, maxHeight = pdf.internal.pageSize.getHeight() - margin * 2;
      const ratio = Math.min(maxWidth / canvas.width, maxHeight / canvas.height);
      const width = canvas.width * ratio, height = canvas.height * ratio;
      pdf.addImage(canvas.toDataURL('image/jpeg', .95), 'JPEG', (pdf.internal.pageSize.getWidth() - width) / 2, margin, width, height, undefined, 'FAST');
      const patient = this.pacienteActual();
      const name = `${patient?.nombres ?? 'Paciente'}_${patient?.apellidos ?? ''}`.replace(/[^a-zA-ZÀ-ÿ0-9]+/g, '_');
      pdf.save(`Factura_${this.form.getRawValue().numero}_${name}_${todayIso()}.pdf`);
    } catch (error) { this.toast.error(error instanceof Error ? error.message : 'No se pudo generar el PDF.'); }
    finally { this.generandoPdf.set(false); }
  }

  estadoLabel(estado: EstadoFactura): string { return estado === 'completado' ? 'Pagada' : estado === 'anulado' ? 'Anulada' : 'Pendiente'; }
  asLine(control: AbstractControl): FormGroup { return control as FormGroup; }
  pacienteNombre(id: string): string { const p = this.pacientes().get(id); return p ? `${p.apellidos} ${p.nombres}` : 'Paciente sin identificar'; }
  currency(value: number): string { return new Intl.NumberFormat('es-EC', { style: 'currency', currency: 'USD' }).format(Number(value || 0)); }
  updateFilters(): void { this.filterVersion.update((value) => value + 1); }
  pdfGeneratedAt(): string { return new Intl.DateTimeFormat('es-EC', { dateStyle: 'long', timeStyle: 'short' }).format(new Date()); }

  private async prepareNewNumber(): Promise<void> {
    try { this.form.controls.numero.setValue(await this.facturacionService.siguienteNumero()); }
    catch { const max = this.facturas().reduce((value, item) => Math.max(value, Number(item.numero.match(/(\d+)$/)?.[1] ?? 0)), 0); this.form.controls.numero.setValue(`FAC-${String(max + 1).padStart(6, '0')}`); }
  }
  private patientSummary(patient: Paciente): string { return `${patient.apellidos} ${patient.nombres} • ${patient.email || 'Sin correo'} • ${patient.telefono || 'Sin teléfono'}`; }
  private normalizeForm(): void { const raw = this.form.getRawValue(); this.form.patchValue({ cedula: normalizeWhitespace(raw.cedula), observaciones: normalizeWhitespace(raw.observaciones) }, { emitEvent: false }); }
  private money(value: number): number { return Math.round((Number(value) + Number.EPSILON) * 100) / 100; }
  private async waitForImages(container: HTMLElement): Promise<void> { await Promise.all(Array.from(container.querySelectorAll('img')).map((image) => image.complete ? Promise.resolve() : new Promise<void>((resolve) => { image.onload = () => resolve(); image.onerror = () => resolve(); }))); }
}
