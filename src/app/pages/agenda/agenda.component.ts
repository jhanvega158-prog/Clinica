import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Agenda, AgendaInsert, EstadoCita } from '../../core/models/interfaces/database.types';
import { AgendaCalendario, AgendaService } from '../../core/services/agenda.service';
import { AuthService } from '../../core/services/auth.service';
import { PacientesService } from '../../core/services/pacientes.service';
import { ToastService } from '../../core/services/toast.service';
import { currentTime, todayIso } from '../../shared/utils/date-utils';
import { ValidationFeedbackDirective } from '../../shared/directives/validation-feedback.directive';
import {
  allowedValues,
  ecuadorianCedula,
  emptyToNull,
  isValidUuid,
  maxTrimLength,
  normalizeWhitespace,
  notPastDate,
  requiredTrim,
  timeRange
} from '../../shared/utils/validation.utils';

@Component({
  selector: 'app-agenda',
  standalone: true,
  imports: [ReactiveFormsModule, ValidationFeedbackDirective],
  templateUrl: './agenda.component.html'
})
export class AgendaComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly agendaService = inject(AgendaService);
  private readonly pacientesService = inject(PacientesService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  readonly citas = signal<AgendaCalendario[]>([]);
  readonly selectedId = signal<string | null>(null);
  readonly loading = this.agendaService.loading;
  readonly pacienteInfo = signal<string | null>(null);
  readonly pacienteError = signal<string | null>(null);
  readonly buscandoPaciente = signal(false);
  readonly form = this.fb.nonNullable.group({
    cedula: ['', [requiredTrim(), ecuadorianCedula()]],
    paciente_id: ['', Validators.required],
    usuario_id: [''],
    fecha: [todayIso(), [Validators.required, notPastDate()]],
    hora_inicio: [currentTime(), Validators.required],
    hora_fin: [''],
    motivo: ['', [requiredTrim(), maxTrimLength(180)]],
    estado: ['pendiente' as EstadoCita, [Validators.required, allowedValues(['pendiente', 'confirmada', 'atendida', 'cancelada', 'reagendada', 'no_asistio'] as const)]],
    notas: ['', [maxTrimLength(300)]]
  }, { validators: [timeRange()] });

  ngOnInit(): void {
    void this.load();
  }

  async load(): Promise<void> {
    try {
      const citas = await this.agendaService.calendario();
      this.citas.set(citas);
    } catch (error) {
      this.toast.error(error instanceof Error ? error.message : 'No se pudo cargar agenda');
    }
  }

  pacienteDisplayValue(): string {
    return this.pacienteInfo() ?? 'Sin paciente seleccionado';
  }

  async edit(cita: Agenda): Promise<void> {
    this.selectedId.set(cita.id);
    this.form.patchValue({
      cedula: '',
      paciente_id: cita.paciente_id,
      usuario_id: cita.usuario_id ?? '',
      fecha: cita.fecha,
      hora_inicio: cita.hora_inicio,
      hora_fin: cita.hora_fin ?? '',
      motivo: cita.motivo,
      estado: cita.estado,
      notas: cita.notas ?? ''
    });
    this.pacienteInfo.set(null);
    this.pacienteError.set(null);
    try {
      const paciente = await this.pacientesService.findById(cita.paciente_id);
      if (paciente) {
        this.form.controls.cedula.setValue(paciente.cedula);
        this.pacienteInfo.set(`${paciente.apellidos} ${paciente.nombres}`);
      }
    } catch {
      // Se mantiene sin datos si no se puede recuperar el paciente.
    }
  }

  clear(): void {
    this.selectedId.set(null);
    this.form.reset({ cedula: '', paciente_id: '', usuario_id: '', fecha: todayIso(), hora_inicio: currentTime(), hora_fin: '', motivo: '', estado: 'pendiente', notas: '' });
    this.form.markAsPristine();
    this.form.markAsUntouched();
    this.pacienteInfo.set(null);
    this.pacienteError.set(null);
  }

  async save(): Promise<void> {
    if (this.loading()) {
      return;
    }
    this.normalizeForm();
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const raw = this.form.getRawValue();
    if (!raw.paciente_id) {
      this.pacienteError.set('Busca un paciente por cédula antes de guardar la cita.');
      return;
    }
    const payload: AgendaInsert = {
      paciente_id: raw.paciente_id,
      usuario_id: isValidUuid(raw.usuario_id) ? raw.usuario_id : null,
      fecha: raw.fecha,
      hora_inicio: raw.hora_inicio,
      hora_fin: raw.hora_fin || null,
      motivo: normalizeWhitespace(raw.motivo),
      estado: raw.estado,
      notas: emptyToNull(raw.notas)
    };
    try {
      const id = this.selectedId();
      if (await this.agendaService.existeSolapamiento(payload, id)) {
        this.toast.error('El odontólogo ya tiene una cita en ese horario.');
        return;
      }
      id ? await this.agendaService.update(id, payload) : await this.agendaService.create(payload);
      this.toast.success('Cita guardada');
      this.clear();
      await this.load();
      window.dispatchEvent(new Event('citas-updated'));
    } catch (error) {
      this.toast.error(error instanceof Error ? error.message : 'No se pudo guardar cita');
    }
  }

  async remove(cita: Agenda): Promise<void> {
    if (!window.confirm('¿Está seguro de eliminar esta cita?')) {
      return;
    }

    try {
      await this.agendaService.delete(cita.id);
      this.toast.success('Cita eliminada');
      await this.load();
      window.dispatchEvent(new Event('citas-updated'));
    } catch (error) {
      this.toast.error(error instanceof Error ? error.message : 'No se pudo eliminar cita');
    }
  }

  async cambiarEstado(cita: Agenda, estado: EstadoCita): Promise<void> {
    try {
      await this.agendaService.update(cita.id, { estado });
      this.toast.success('Estado actualizado');
      await this.load();
      window.dispatchEvent(new Event('citas-updated'));
    } catch (error) {
      this.toast.error(error instanceof Error ? error.message : 'No se pudo actualizar la cita');
    }
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
        result.paciente.sexo ? `Sexo: ${result.paciente.sexo}` : null,
        result.paciente.fecha_nacimiento ? `Nac.: ${result.paciente.fecha_nacimiento}` : null,
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

  async reagendar(cita: Agenda): Promise<void> {
    await this.edit(cita);
    this.form.controls.estado.setValue('reagendada');
    this.toast.info('Ajusta la fecha u hora y guarda la cita');
  }

  async enviarWhatsApp(cita: AgendaCalendario): Promise<void> {
    if (!cita.paciente_telefono) {
      this.toast.error('Primero registra un telefono para el paciente');
      return;
    }

    const tipo = cita.estado === 'atendida' ? 'seguimiento' : 'recordatorio';
    const mensaje = tipo === 'seguimiento' ? this.mensajeSeguimiento(cita) : this.mensajeRecordatorio(cita);
    const phone = this.normalizePhone(cita.paciente_telefono);
    window.open(`https://web.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(mensaje)}`, '_blank', 'noopener');

    try {
      await this.agendaService.registrarRecordatorio({
        cita_id: cita.id,
        paciente_id: cita.paciente_id,
        usuario_id: this.usuarioActualId(),
        tipo,
        telefono: cita.paciente_telefono,
        mensaje,
        estado: 'enviado',
        enviado_at: new Date().toISOString()
      });
      this.toast.success(tipo === 'seguimiento' ? 'Seguimiento registrado' : 'Recordatorio registrado');
      await this.load();
    } catch (error) {
      this.toast.error(error instanceof Error ? error.message : 'No se pudo registrar el recordatorio');
    }
  }

  actionLabel(cita: AgendaCalendario): string {
    return cita.estado === 'atendida' ? 'Enviar seguimiento' : 'Enviar recordatorio';
  }

  private mensajeRecordatorio(cita: AgendaCalendario): string {
    const doctor = cita.odontologo_nombre || this.profileName() || 'Odontologo';
    return `Hola ${cita.paciente_nombre} 👋

Le recordamos que tiene una cita odontologica programada en Clinica VitaDenti.

📅 Fecha: ${cita.fecha}
🕒 Hora: ${cita.hora_inicio}
👨‍⚕️ Odontologo: ${doctor}
📍 Clinica VitaDenti

Por favor, llegue 10 minutos antes de su cita.

Si necesita cancelar o reagendar su cita, puede responder a este mensaje o comunicarse con nosotros.

¡Gracias por confiar en Clinica VitaDenti! 🦷`;
  }

  private mensajeSeguimiento(cita: AgendaCalendario): string {
    const doctor = cita.odontologo_nombre || this.profileName() || 'Odontologo';
    return `Hola ${cita.paciente_nombre} 👋

Gracias por asistir a su cita odontologica en Clinica VitaDenti.

👨‍⚕️ Odontologo: ${doctor}
📅 Fecha de atencion: ${cita.fecha}

Esperamos que se encuentre bien despues de su tratamiento. Si presenta molestias, dudas o necesita una nueva cita, puede responder a este mensaje.

¡Gracias por confiar en Clinica VitaDenti! 🦷`;
  }

  private normalizePhone(phone: string): string {
    const digits = phone.replace(/\D/g, '');
    if (digits.startsWith('593')) {
      return digits;
    }
    if (digits.startsWith('0')) {
      return `593${digits.slice(1)}`;
    }
    return digits.length <= 9 ? `593${digits}` : digits;
  }

  private profileName(): string | null {
    const profile = this.auth.profile();
    return profile ? `${profile.nombres} ${profile.apellidos}`.trim() : null;
  }

  private usuarioActualId(): string | null {
    const id = this.auth.profile()?.id;
    return id && this.validUuid(id) ? id : null;
  }

  private validUuid(value: string | null | undefined): boolean {
    return isValidUuid(value);
  }

  private normalizeForm(): void {
    const raw = this.form.getRawValue();
    this.form.patchValue({
      cedula: normalizeWhitespace(raw.cedula),
      usuario_id: normalizeWhitespace(raw.usuario_id),
      motivo: normalizeWhitespace(raw.motivo),
      notas: normalizeWhitespace(raw.notas)
    }, { emitEvent: false });
  }
}
