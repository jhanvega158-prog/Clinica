import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { EstadoRegistro, Factura, FacturaInsert } from '../../core/models/interfaces/database.types';
import { FacturacionService } from '../../core/services/facturacion.service';
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
  private readonly toast = inject(ToastService);
  readonly facturas = signal<Factura[]>([]);
  readonly selectedId = signal<string | null>(null);
  readonly loading = this.facturacionService.loading;
  readonly form = this.fb.nonNullable.group({
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
    try { this.facturas.set(await this.facturacionService.findAll({ orderBy: 'fecha', ascending: false })); }
    catch (error) { this.toast.error(error instanceof Error ? error.message : 'No se cargaron facturas'); }
  }

  edit(factura: Factura): void {
    this.selectedId.set(factura.id);
    this.form.patchValue({ ...factura, observaciones: factura.observaciones ?? '' });
  }

  clear(): void {
    this.selectedId.set(null);
    this.form.reset({ paciente_id: '', numero: '', fecha: todayIso(), subtotal: 0, impuesto: 0, descuento: 0, estado: 'pendiente', observaciones: '' });
  }

  total(): number {
    const raw = this.form.getRawValue();
    return (Number(raw.subtotal) || 0) + (Number(raw.impuesto) || 0) - (Number(raw.descuento) || 0);
  }

  async save(): Promise<void> {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    const raw = this.form.getRawValue();
    const payload: FacturaInsert = { paciente_id: raw.paciente_id, numero: raw.numero, fecha: raw.fecha, subtotal: Number(raw.subtotal) || 0, impuesto: Number(raw.impuesto) || 0, descuento: Number(raw.descuento) || 0, total: this.total(), estado: raw.estado, observaciones: raw.observaciones || null };
    try {
      const id = this.selectedId();
      id ? await this.facturacionService.update(id, payload) : await this.facturacionService.create(payload);
      this.toast.success('Factura guardada');
      this.clear();
      await this.load();
    } catch (error) { this.toast.error(error instanceof Error ? error.message : 'No se pudo guardar factura'); }
  }

  async remove(factura: Factura): Promise<void> {
    try { await this.facturacionService.delete(factura.id); this.toast.success('Factura eliminada'); await this.load(); }
    catch (error) { this.toast.error(error instanceof Error ? error.message : 'No se pudo eliminar factura'); }
  }

  print(): void {
    window.print();
  }
}
