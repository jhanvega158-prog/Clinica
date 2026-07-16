import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Inventario, InventarioInsert } from '../../core/models/interfaces/database.types';
import { InventarioService } from '../../core/services/inventario.service';
import { ToastService } from '../../core/services/toast.service';

@Component({
  selector: 'app-inventario',
  standalone: true,
  imports: [ReactiveFormsModule],
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
    codigo: ['', Validators.required],
    nombre: ['', Validators.required],
    categoria: [''],
    stock: [0, Validators.required],
    stock_minimo: [0, Validators.required],
    unidad: [''],
    costo: [0],
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
  }

  async save(): Promise<void> {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    const raw = this.form.getRawValue();
    const payload: InventarioInsert = { codigo: raw.codigo, nombre: raw.nombre, categoria: raw.categoria || null, stock: Number(raw.stock) || 0, stock_minimo: Number(raw.stock_minimo) || 0, unidad: raw.unidad || null, costo: Number(raw.costo) || null, vencimiento: raw.vencimiento || null, activo: raw.activo };
    try {
      const id = this.selectedId();
      id ? await this.inventarioService.update(id, payload) : await this.inventarioService.create(payload);
      this.toast.success('Inventario guardado');
      this.clear();
      await this.load();
    } catch (error) { this.toast.error(error instanceof Error ? error.message : 'No se pudo guardar inventario'); }
  }

  async remove(item: Inventario): Promise<void> {
    try { await this.inventarioService.delete(item.id); this.toast.success('Item eliminado'); await this.load(); }
    catch (error) { this.toast.error(error instanceof Error ? error.message : 'No se pudo eliminar item'); }
  }
}
