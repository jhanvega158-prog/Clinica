import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { CpoResultado, EstadoRegistro, Odontograma, OdontogramaDetalle, OdontogramaDetalleInsert, OdontogramaInsert } from '../../core/models/interfaces/database.types';
import { OdontogramaService } from '../../core/services/odontograma.service';
import { ToastService } from '../../core/services/toast.service';

@Component({
  selector: 'app-odontograma',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './odontograma.component.html',
  styleUrl: './odontograma.component.css'
})
export class OdontogramaComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly odontogramaService = inject(OdontogramaService);
  private readonly toast = inject(ToastService);
  readonly odontogramas = signal<Odontograma[]>([]);
  readonly detalles = signal<OdontogramaDetalle[]>([]);
  readonly selectedId = signal<string | null>(null);
  readonly cpo = signal<CpoResultado | null>(null);
  readonly loading = this.odontogramaService.loading;
  readonly piezas = [18,17,16,15,14,13,12,11,21,22,23,24,25,26,27,28,48,47,46,45,44,43,42,41,31,32,33,34,35,36,37,38,55,54,53,52,51,61,62,63,64,65,85,84,83,82,81,71,72,73,74,75];
  readonly hallazgos = computed(() => new Map(this.detalles().map((detalle) => [detalle.pieza, detalle.condicion])));
  readonly form = this.fb.nonNullable.group({ paciente_id: ['', Validators.required], historia_id: [''], tipo: ['inicial' as 'inicial' | 'evolucion', Validators.required], estado: ['activo' as EstadoRegistro, Validators.required], observaciones: [''] });
  readonly detailForm = this.fb.nonNullable.group({ pieza: [11, Validators.required], superficie: [''], condicion: ['caries', Validators.required], movilidad: [0], recesion: [0], notas: [''] });

  ngOnInit(): void { void this.load(); }

  async load(): Promise<void> {
    try { this.odontogramas.set(await this.odontogramaService.findAll({ orderBy: 'created_at', ascending: false })); }
    catch (error) { this.toast.error(error instanceof Error ? error.message : 'No se cargaron odontogramas'); }
  }

  async select(item: Odontograma): Promise<void> {
    this.selectedId.set(item.id);
    this.form.patchValue({ paciente_id: item.paciente_id, historia_id: item.historia_id ?? '', tipo: item.tipo, estado: item.estado, observaciones: item.observaciones ?? '' });
    await this.loadDetails(item.id);
    await this.calculate();
  }

  async loadDetails(id: string): Promise<void> {
    try { this.detalles.set(await this.odontogramaService.detalles(id)); }
    catch (error) { this.toast.error(error instanceof Error ? error.message : 'No se cargaron detalles'); }
  }

  clear(): void {
    this.selectedId.set(null);
    this.detalles.set([]);
    this.cpo.set(null);
    this.form.reset({ paciente_id: '', historia_id: '', tipo: 'inicial', estado: 'activo', observaciones: '' });
  }

  async save(): Promise<void> {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    const raw = this.form.getRawValue();
    const payload: OdontogramaInsert = { paciente_id: raw.paciente_id, historia_id: raw.historia_id || null, tipo: raw.tipo, estado: raw.estado, observaciones: raw.observaciones || null };
    try {
      const id = this.selectedId();
      const saved = id ? await this.odontogramaService.update(id, payload) : await this.odontogramaService.create(payload);
      this.selectedId.set(saved.id);
      this.toast.success('Odontograma guardado');
      await this.load();
      await this.loadDetails(saved.id);
      await this.calculate();
    } catch (error) { this.toast.error(error instanceof Error ? error.message : 'No se pudo guardar odontograma'); }
  }

  async saveDetail(pieza?: number): Promise<void> {
    const odontogramaId = this.selectedId();
    if (!odontogramaId) { this.toast.error('Guarda o selecciona un odontograma'); return; }
    const raw = this.detailForm.getRawValue();
    const payload: OdontogramaDetalleInsert = { odontograma_id: odontogramaId, pieza: pieza ?? raw.pieza, superficie: raw.superficie || null, condicion: raw.condicion, movilidad: Number(raw.movilidad) || null, recesion: Number(raw.recesion) || null, notas: raw.notas || null };
    try {
      await this.odontogramaService.guardarDetalle(payload);
      this.toast.success('Hallazgo guardado');
      await this.loadDetails(odontogramaId);
      await this.calculate();
    } catch (error) { this.toast.error(error instanceof Error ? error.message : 'No se pudo guardar hallazgo'); }
  }

  async removeDetail(detalle: OdontogramaDetalle): Promise<void> {
    try {
      await this.odontogramaService.eliminarDetalle(detalle.id);
      this.toast.success('Hallazgo eliminado');
      const id = this.selectedId();
      if (id) { await this.loadDetails(id); await this.calculate(); }
    } catch (error) { this.toast.error(error instanceof Error ? error.message : 'No se pudo eliminar hallazgo'); }
  }

  async remove(item: Odontograma): Promise<void> {
    try { await this.odontogramaService.delete(item.id); this.toast.success('Odontograma eliminado'); this.clear(); await this.load(); }
    catch (error) { this.toast.error(error instanceof Error ? error.message : 'No se pudo eliminar odontograma'); }
  }

  async calculate(): Promise<void> {
    const pacienteId = this.form.controls.paciente_id.value;
    if (!pacienteId) { return; }
    try { this.cpo.set(await this.odontogramaService.calcularCpo(pacienteId)); }
    catch (error) { this.toast.error(error instanceof Error ? error.message : 'RPC calcular_cpo no disponible'); }
  }
}
