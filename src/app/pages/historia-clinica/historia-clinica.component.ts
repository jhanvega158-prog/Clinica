import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { EstadoRegistro, HistoriaClinica, HistoriaClinicaInsert, Json } from '../../core/models/interfaces/database.types';
import { HistoriaService } from '../../core/services/historia.service';
import { PacientesService } from '../../core/services/pacientes.service';
import { ToastService } from '../../core/services/toast.service';

@Component({
  selector: 'app-historia-clinica',
  standalone: true,
  imports: [ReactiveFormsModule],
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
  readonly form = this.fb.nonNullable.group({
    paciente_id: ['', Validators.required],
    usuario_id: [''],
    motivo_consulta: [''],
    enfermedad_actual: [''],
    antecedentes_personales: [''],
    antecedentes_familiares: [''],
    signos_vitales: [''],
    examen_estomatognatico: [''],
    diagnosticos: [''],
    plan_tratamiento: [''],
    observaciones: [''],
    estado: ['activo' as EstadoRegistro, Validators.required]
  });

  ngOnInit(): void { void this.load(); }

  async load(): Promise<void> {
    try { this.historias.set(await this.historiaService.findAll({ orderBy: 'created_at', ascending: false })); }
    catch (error) { this.toast.error(error instanceof Error ? error.message : 'No se cargaron historias'); }
  }

  edit(historia: HistoriaClinica): void {
    this.selectedId.set(historia.id);
    this.form.patchValue({
      paciente_id: historia.paciente_id,
      usuario_id: historia.usuario_id ?? '',
      motivo_consulta: historia.motivo_consulta ?? '',
      enfermedad_actual: historia.enfermedad_actual ?? '',
      antecedentes_personales: this.stringifyJson(historia.antecedentes_personales),
      antecedentes_familiares: this.stringifyJson(historia.antecedentes_familiares),
      signos_vitales: this.stringifyJson(historia.signos_vitales),
      examen_estomatognatico: this.stringifyJson(historia.examen_estomatognatico),
      diagnosticos: this.stringifyJson(historia.diagnosticos),
      plan_tratamiento: historia.plan_tratamiento ?? '',
      observaciones: historia.observaciones ?? '',
      estado: historia.estado
    });
  }

  clear(): void {
    this.selectedId.set(null);
    this.form.reset({ paciente_id: '', usuario_id: '', motivo_consulta: '', enfermedad_actual: '', antecedentes_personales: '', antecedentes_familiares: '', signos_vitales: '', examen_estomatognatico: '', diagnosticos: '', plan_tratamiento: '', observaciones: '', estado: 'activo' });
  }

  async save(): Promise<void> {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    const raw = this.form.getRawValue();
    const payload: HistoriaClinicaInsert = {
      paciente_id: raw.paciente_id,
      usuario_id: raw.usuario_id || null,
      motivo_consulta: raw.motivo_consulta || null,
      enfermedad_actual: raw.enfermedad_actual || null,
      antecedentes_personales: this.parseJson(raw.antecedentes_personales),
      antecedentes_familiares: this.parseJson(raw.antecedentes_familiares),
      signos_vitales: this.parseJson(raw.signos_vitales),
      examen_estomatognatico: this.parseJson(raw.examen_estomatognatico),
      diagnosticos: this.parseJson(raw.diagnosticos),
      plan_tratamiento: raw.plan_tratamiento || null,
      observaciones: raw.observaciones || null,
      estado: raw.estado
    };
    try {
      const id = this.selectedId();
      id ? await this.historiaService.update(id, payload) : await this.historiaService.create(payload);
      this.toast.success('Historia clinica guardada');
      this.clear();
      await this.load();
    } catch (error) { this.toast.error(error instanceof Error ? error.message : 'No se pudo guardar historia'); }
  }

  async remove(historia: HistoriaClinica): Promise<void> {
    try { await this.historiaService.delete(historia.id); this.toast.success('Historia eliminada'); await this.load(); }
    catch (error) { this.toast.error(error instanceof Error ? error.message : 'No se pudo eliminar historia'); }
  }

  async upload(event: Event, tipo: 'radiografia' | 'documento'): Promise<void> {
    const pacienteId = this.form.controls.paciente_id.value;
    const historiaId = this.selectedId();
    const input = event.target as HTMLInputElement;
    const file = input.files?.item(0);
    if (!pacienteId || !file) { this.toast.error('Selecciona una historia con paciente antes de subir archivos'); return; }
    try {
      await this.pacientesService.uploadDocumento(pacienteId, file, tipo, historiaId);
      this.toast.success('Archivo clinico subido');
      input.value = '';
    } catch (error) { this.toast.error(error instanceof Error ? error.message : 'No se pudo subir archivo'); }
  }

  print(): void { window.print(); }

  private parseJson(value: string): Json | null {
    if (!value.trim()) { return null; }
    try { return JSON.parse(value) as Json; }
    catch { return value; }
  }

  private stringifyJson(value: Json | null): string {
    return value === null ? '' : JSON.stringify(value, null, 2);
  }
}
