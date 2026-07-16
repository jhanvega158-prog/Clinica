import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { EstadoRegistro, Tratamiento, TratamientoInsert } from '../../core/models/interfaces/database.types';
import { ToastService } from '../../core/services/toast.service';
import { TratamientosService } from '../../core/services/tratamientos.service';
import { todayIso } from '../../shared/utils/date-utils';

@Component({
  selector: 'app-tratamientos',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './tratamientos.component.html'
})
export class TratamientosComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly tratamientosService = inject(TratamientosService);
  private readonly toast = inject(ToastService);
  readonly tratamientos = signal<Tratamiento[]>([]);
  readonly selectedId = signal<string | null>(null);
  readonly loading = this.tratamientosService.loading;
  readonly form = this.fb.nonNullable.group({
    paciente_id: ['', Validators.required],
    historia_id: [''],
    diagnostico: ['', Validators.required],
    procedimiento: ['', Validators.required],
    prescripcion: [''],
    fecha: [todayIso(), Validators.required],
    estado: ['pendiente' as EstadoRegistro, Validators.required],
    costo: [0],
    notas: ['']
  });

  ngOnInit(): void { void this.load(); }

  async load(): Promise<void> {
    try { this.tratamientos.set(await this.tratamientosService.findAll({ orderBy: 'fecha', ascending: false })); }
    catch (error) { this.toast.error(error instanceof Error ? error.message : 'No se cargaron tratamientos'); }
  }

  edit(item: Tratamiento): void {
    this.selectedId.set(item.id);
    this.form.patchValue({ ...item, historia_id: item.historia_id ?? '', prescripcion: item.prescripcion ?? '', costo: item.costo ?? 0, notas: item.notas ?? '' });
  }

  clear(): void {
    this.selectedId.set(null);
    this.form.reset({ paciente_id: '', historia_id: '', diagnostico: '', procedimiento: '', prescripcion: '', fecha: todayIso(), estado: 'pendiente', costo: 0, notas: '' });
  }

  async save(): Promise<void> {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    const raw = this.form.getRawValue();
    const payload: TratamientoInsert = { paciente_id: raw.paciente_id, historia_id: raw.historia_id || null, diagnostico: raw.diagnostico, procedimiento: raw.procedimiento, prescripcion: raw.prescripcion || null, fecha: raw.fecha, estado: raw.estado, costo: Number(raw.costo) || null, notas: raw.notas || null };
    try {
      const id = this.selectedId();
      id ? await this.tratamientosService.update(id, payload) : await this.tratamientosService.create(payload);
      this.toast.success('Tratamiento guardado');
      this.clear();
      await this.load();
    } catch (error) { this.toast.error(error instanceof Error ? error.message : 'No se pudo guardar tratamiento'); }
  }

  async remove(item: Tratamiento): Promise<void> {
    try { await this.tratamientosService.delete(item.id); this.toast.success('Tratamiento eliminado'); await this.load(); }
    catch (error) { this.toast.error(error instanceof Error ? error.message : 'No se pudo eliminar tratamiento'); }
  }
}
