import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Inventario, InventarioInsert } from '../../core/models/interfaces/database.types';
import { InventarioService } from '../../core/services/inventario.service';
import { ToastService } from '../../core/services/toast.service';
import { ValidationFeedbackDirective } from '../../shared/directives/validation-feedback.directive';
import {
  emptyToNull,
  integerMin,
  maxTrimLength,
  nonNegativeNumber,
  normalizeWhitespace,
  notBlankOptional,
  requiredTrim
} from '../../shared/utils/validation.utils';

@Component({
  selector: 'app-inventario',
  standalone: true,
  imports: [ReactiveFormsModule, ValidationFeedbackDirective],
  templateUrl: './inventario.component.html'
})
export class InventarioComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly inventarioService = inject(InventarioService);
  private readonly toast = inject(ToastService);
  readonly items = signal<Inventario[]>([]);
  readonly selectedId = signal<string | null>(null);
  readonly loading = this.inventarioService.loading;
  readonly form = this.fb.nonNullable.group({
    codigo: ['', [requiredTrim(), maxTrimLength(40)]],
    nombre: ['', [requiredTrim(), maxTrimLength(120)]],
    categoria: ['', [requiredTrim(), maxTrimLength(80)]],
    stock: [0, [Validators.required, integerMin(0)]],
    stock_minimo: [0, [Validators.required, integerMin(0)]],
    unidad: ['', [notBlankOptional(), maxTrimLength(30)]],
    costo: [0, [nonNegativeNumber()]],
    vencimiento: [''],
    activo: [true]
  });

  ngOnInit(): void { void this.load(); }

  async load(): Promise<void> {
    try { this.items.set(await this.inventarioService.findAll({ orderBy: 'nombre', ascending: true })); }
    catch (error) { this.toast.error(error instanceof Error ? error.message : 'No se cargo inventario'); }
  }

  async loadLowStock(): Promise<void> {
    try { this.items.set(await this.inventarioService.bajoStock()); }
    catch (error) { this.toast.error(error instanceof Error ? error.message : 'No se cargo stock bajo'); }
  }

  edit(item: Inventario): void {
    this.selectedId.set(item.id);
    this.form.patchValue({ ...item, categoria: item.categoria ?? '', unidad: item.unidad ?? '', costo: item.costo ?? 0, vencimiento: item.vencimiento ?? '' });
  }

  clear(): void {
    this.selectedId.set(null);
    this.form.reset({ codigo: '', nombre: '', categoria: '', stock: 0, stock_minimo: 0, unidad: '', costo: 0, vencimiento: '', activo: true });
    this.form.markAsPristine();
    this.form.markAsUntouched();
  }

  async save(): Promise<void> {
    if (this.loading()) { return; }
    this.normalizeForm();
    this.validateDuplicados();
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    const raw = this.form.getRawValue();
    if (raw.vencimiento && raw.vencimiento < new Date().toISOString().slice(0, 10)) {
      this.toast.info('El producto se encuentra caducado.');
    }
    const payload: InventarioInsert = { codigo: normalizeWhitespace(raw.codigo), nombre: normalizeWhitespace(raw.nombre), categoria: normalizeWhitespace(raw.categoria), stock: Number(raw.stock) || 0, stock_minimo: Number(raw.stock_minimo) || 0, unidad: emptyToNull(raw.unidad), costo: Number(raw.costo) || null, vencimiento: raw.vencimiento || null, activo: raw.activo };
    try {
      const id = this.selectedId();
      id ? await this.inventarioService.update(id, payload) : await this.inventarioService.create(payload);
      this.toast.success('Inventario guardado');
      this.clear();
      await this.load();
    } catch (error) { this.toast.error(error instanceof Error ? error.message : 'No se pudo guardar inventario'); }
  }

  async remove(item: Inventario): Promise<void> {
    if (!window.confirm('¿Está seguro de eliminar este ítem de inventario?')) {
      return;
    }
    try { await this.inventarioService.delete(item.id); this.toast.success('Item eliminado'); await this.load(); }
    catch (error) { this.toast.error(error instanceof Error ? error.message : 'No se pudo eliminar item'); }
  }

  private normalizeForm(): void {
    const raw = this.form.getRawValue();
    this.form.patchValue({
      codigo: normalizeWhitespace(raw.codigo),
      nombre: normalizeWhitespace(raw.nombre),
      categoria: normalizeWhitespace(raw.categoria),
      unidad: normalizeWhitespace(raw.unidad)
    }, { emitEvent: false });
  }

  private validateDuplicados(): void {
    const codigo = normalizeWhitespace(this.form.controls.codigo.value);
    const id = this.selectedId();
    const duplicado = this.items().some((item) => item.codigo === codigo && item.id !== id);
    const control = this.form.controls.codigo;
    const errors = { ...(control.errors ?? {}) };
    if (duplicado) {
      errors['duplicateCode'] = true;
    } else {
      delete errors['duplicateCode'];
    }
    control.setErrors(Object.keys(errors).length ? errors : null);
  }
}
