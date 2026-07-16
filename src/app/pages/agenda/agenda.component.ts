import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Agenda, AgendaInsert, EstadoRegistro } from '../../core/models/interfaces/database.types';
import { AgendaService } from '../../core/services/agenda.service';
import { ToastService } from '../../core/services/toast.service';
import { currentTime, todayIso } from '../../shared/utils/date-utils';

@Component({
  selector: 'app-agenda',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './agenda.component.html'
})
export class AgendaComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly agendaService = inject(AgendaService);
  private readonly toast = inject(ToastService);
  readonly citas = signal<Agenda[]>([]);
  readonly selectedId = signal<string | null>(null);
  readonly loading = this.agendaService.loading;
  readonly form = this.fb.nonNullable.group({
    paciente_id: ['', Validators.required],
    usuario_id: [''],
    fecha: [todayIso(), Validators.required],
    hora_inicio: [currentTime(), Validators.required],
    hora_fin: [''],
    motivo: ['', Validators.required],
    estado: ['pendiente' as EstadoRegistro, Validators.required],
    notas: ['']
  });

  ngOnInit(): void {
    void this.load();
  }

  async load(): Promise<void> {
    try {
      this.citas.set(await this.agendaService.findAll({ orderBy: 'fecha', ascending: false }));
    } catch (error) {
      this.toast.error(error instanceof Error ? error.message : 'No se pudo cargar agenda');
    }
  }

  edit(cita: Agenda): void {
    this.selectedId.set(cita.id);
    this.form.patchValue({ ...cita, usuario_id: cita.usuario_id ?? '', hora_fin: cita.hora_fin ?? '', notas: cita.notas ?? '' });
  }

  clear(): void {
    this.selectedId.set(null);
    this.form.reset({ paciente_id: '', usuario_id: '', fecha: todayIso(), hora_inicio: currentTime(), hora_fin: '', motivo: '', estado: 'pendiente', notas: '' });
  }

  async save(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const raw = this.form.getRawValue();
    const payload: AgendaInsert = {
      paciente_id: raw.paciente_id,
      usuario_id: raw.usuario_id || null,
      fecha: raw.fecha,
      hora_inicio: raw.hora_inicio,
      hora_fin: raw.hora_fin || null,
      motivo: raw.motivo,
      estado: raw.estado,
      notas: raw.notas || null
    };
    try {
      const id = this.selectedId();
      id ? await this.agendaService.update(id, payload) : await this.agendaService.create(payload);
      this.toast.success('Cita guardada');
      this.clear();
      await this.load();
    } catch (error) {
      this.toast.error(error instanceof Error ? error.message : 'No se pudo guardar cita');
    }
  }

  async remove(cita: Agenda): Promise<void> {
    try {
      await this.agendaService.delete(cita.id);
      this.toast.success('Cita eliminada');
      await this.load();
    } catch (error) {
      this.toast.error(error instanceof Error ? error.message : 'No se pudo eliminar cita');
    }
  }
}
