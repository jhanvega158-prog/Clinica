import { Injectable } from '@angular/core';
import { BaseRepository } from '../repositories/base.repository';
import { supabaseDynamic } from '../config/supabase';
import {
  Agenda,
  AgendaInsert,
  AgendaUpdate,
  EstadoRecordatorio,
  TipoRecordatorio
} from '../models/interfaces/database.types';
import { normalizeWhitespace } from '../../shared/utils/validation.utils';

export interface AgendaCalendario extends Agenda {
  paciente_nombre: string;
  paciente_telefono: string | null;
  odontologo_nombre: string | null;
  recordatorio_enviado: boolean;
  seguimiento_enviado: boolean;
}

export interface RecordatorioWhatsappInsert {
  cita_id: string;
  paciente_id: string;
  usuario_id: string | null;
  tipo: TipoRecordatorio;
  telefono: string | null;
  mensaje: string;
  estado: EstadoRecordatorio;
  enviado_at: string;
}

@Injectable({ providedIn: 'root' })
export class AgendaService extends BaseRepository<Agenda, AgendaInsert, AgendaUpdate> {
  constructor() {
    super('agenda', 'fecha');
  }

  override async create(payload: AgendaInsert): Promise<Agenda> {
    this.validatePayload(payload);
    return super.create(payload);
  }

  override async update(id: string, payload: AgendaUpdate): Promise<Agenda> {
    this.validatePayload(payload);
    return super.update(id, payload);
  }

  async porPaciente(pacienteId: string): Promise<Agenda[]> {
    return this.findAll({ filters: [{ column: 'paciente_id', value: pacienteId }], orderBy: 'fecha', ascending: false });
  }

  async calendario(): Promise<AgendaCalendario[]> {
    const citas = await this.findAll({ orderBy: 'fecha', ascending: true });
    if (!citas.length) {
      return [];
    }

    const visibles = citas.filter((cita) => this.esVisibleEnAgenda(cita));
    if (!visibles.length) {
      return [];
    }

    const pacienteIds = [...new Set(visibles.map((cita) => cita.paciente_id))];
    const usuarioIds = [...new Set(visibles.map((cita) => cita.usuario_id).filter(Boolean) as string[])];
    const citaIds = visibles.map((cita) => cita.id);

    const [{ data: pacientes, error: pacientesError }, { data: usuarios, error: usuariosError }, { data: recordatorios, error: recordatoriosError }] =
      await Promise.all([
        supabaseDynamic.from('pacientes').select('id,nombres,apellidos,telefono').in('id', pacienteIds),
        usuarioIds.length
          ? supabaseDynamic.from('usuarios').select('id,nombres,apellidos').in('id', usuarioIds)
          : Promise.resolve({ data: [], error: null }),
        supabaseDynamic.from('recordatorios_whatsapp').select('id,cita_id,tipo,estado,enviado_at').in('cita_id', citaIds)
      ]);

    this.throwIfError(pacientesError);
    this.throwIfError(usuariosError);
    this.throwIfError(recordatoriosError);

    const pacientesMap = new Map(
      (pacientes ?? []).map((paciente: { id: string; nombres: string; apellidos: string; telefono: string | null }) => [
        paciente.id,
        paciente
      ])
    );
    const usuariosMap = new Map(
      (usuarios ?? []).map((usuario: { id: string; nombres: string; apellidos: string }) => [usuario.id, usuario])
    );
    const recordatoriosPorCita = new Map<string, Array<{ tipo: TipoRecordatorio; estado: EstadoRecordatorio }>>();

    for (const recordatorio of (recordatorios ?? []) as Array<{ cita_id: string; tipo: TipoRecordatorio; estado: EstadoRecordatorio }>) {
      const current = recordatoriosPorCita.get(recordatorio.cita_id) ?? [];
      current.push(recordatorio);
      recordatoriosPorCita.set(recordatorio.cita_id, current);
    }

    return visibles.map((cita) => {
      const paciente = pacientesMap.get(cita.paciente_id);
      const odontologo = cita.usuario_id ? usuariosMap.get(cita.usuario_id) : null;
      const enviados = recordatoriosPorCita.get(cita.id) ?? [];

      return {
        ...cita,
        paciente_nombre: paciente ? `${paciente.apellidos} ${paciente.nombres}`.trim() : 'Paciente no encontrado',
        paciente_telefono: paciente?.telefono ?? null,
        odontologo_nombre: cita.odontologo_nombre || (odontologo ? `${odontologo.nombres} ${odontologo.apellidos}`.trim() : null),
        recordatorio_enviado: enviados.some((item) => item.tipo === 'recordatorio' && item.estado === 'enviado'),
        seguimiento_enviado: enviados.some((item) => item.tipo === 'seguimiento' && item.estado === 'enviado')
      };
    });
  }

  async existeSolapamiento(payload: AgendaInsert, excludeId: string | null = null): Promise<boolean> {
    const citas = await this.findAll({ filters: [{ column: 'fecha', value: payload.fecha }], orderBy: 'hora_inicio', ascending: true });
    const start = this.timeToMinutes(payload.hora_inicio);
    const end = this.timeToMinutes(payload.hora_fin ?? '') || start + 30;

    return citas.some((cita) => {
      if (excludeId && cita.id === excludeId) {
        return false;
      }
      if (!this.esVisibleEnAgenda(cita)) {
        return false;
      }
      if (payload.usuario_id && cita.usuario_id && payload.usuario_id !== cita.usuario_id) {
        return false;
      }

      const citaStart = this.timeToMinutes(cita.hora_inicio);
      const citaEnd = this.timeToMinutes(cita.hora_fin ?? '') || citaStart + 30;
      return start < citaEnd && end > citaStart;
    });
  }

  async registrarRecordatorio(payload: RecordatorioWhatsappInsert): Promise<void> {
    const { error } = await supabaseDynamic.from('recordatorios_whatsapp').insert(payload);
    this.throwIfError(error);
  }

  private esVisibleEnAgenda(cita: Agenda): boolean {
    const hoy = new Date().toISOString().slice(0, 10);
    if (['cancelada', 'atendida', 'reagendada', 'no_asistio'].includes(cita.estado)) {
      return false;
    }

    if (cita.fecha < hoy) {
      return false;
    }

    if (cita.fecha === hoy) {
      const ahora = new Date();
      const [hora, minutos] = (cita.hora_inicio ?? '00:00').split(':').map(Number);
      const citaMinutos = hora * 60 + minutos;
      const ahoraMinutos = ahora.getHours() * 60 + ahora.getMinutes();
      return citaMinutos >= ahoraMinutos;
    }

    return true;
  }

  private timeToMinutes(value: string): number {
    const [hours, minutes] = value.split(':').map(Number);
    if (Number.isNaN(hours) || Number.isNaN(minutes)) {
      return 0;
    }
    return hours * 60 + minutes;
  }

  private validatePayload(payload: AgendaInsert | AgendaUpdate): void {
    if ('paciente_id' in payload && !payload.paciente_id) {
      throw new Error('Seleccione un paciente.');
    }
    if ('fecha' in payload && !payload.fecha) {
      throw new Error('La fecha es obligatoria.');
    }
    if ('hora_inicio' in payload && !payload.hora_inicio) {
      throw new Error('La hora de inicio es obligatoria.');
    }
    if ('hora_inicio' in payload && 'hora_fin' in payload && payload.hora_inicio && payload.hora_fin && this.timeToMinutes(payload.hora_fin) <= this.timeToMinutes(payload.hora_inicio)) {
      throw new Error('La hora final debe ser posterior a la hora inicial.');
    }
    if ('motivo' in payload && !normalizeWhitespace(payload.motivo)) {
      throw new Error('El motivo es obligatorio.');
    }
    if ('estado' in payload && payload.estado && !['pendiente', 'confirmada', 'atendida', 'cancelada', 'reagendada', 'no_asistio'].includes(payload.estado)) {
      throw new Error('Seleccione una opción válida.');
    }
  }
}
