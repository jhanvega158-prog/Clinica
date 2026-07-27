import { Injectable } from '@angular/core';
import { BaseRepository } from '../repositories/base.repository';
import { supabaseDynamic } from '../config/supabase';
import {
  HistoriaClinica,
  HistoriaClinicaInsert,
  HistoriaClinicaUpdate
} from '../models/interfaces/database.types';
import { normalizeWhitespace } from '../../shared/utils/validation.utils';

@Injectable({ providedIn: 'root' })
export class HistoriaService extends BaseRepository<HistoriaClinica, HistoriaClinicaInsert, HistoriaClinicaUpdate> {
  constructor() {
    super('historias_clinicas');
  }

  override async create(payload: HistoriaClinicaInsert): Promise<HistoriaClinica> {
    this.validatePayload(payload);
    return super.create(payload);
  }

  override async update(id: string, payload: HistoriaClinicaUpdate): Promise<HistoriaClinica> {
    this.validatePayload(payload);
    return super.update(id, payload);
  }

  async porPaciente(pacienteId: string): Promise<HistoriaClinica[]> {
    return this.findAll({ filters: [{ column: 'paciente_id', value: pacienteId }], orderBy: 'created_at' });
  }

  async ensureActiveForPaciente(pacienteId: string): Promise<HistoriaClinica> {
    const { data, error } = await supabaseDynamic
      .from('historias_clinicas')
      .select('*')
      .eq('paciente_id', pacienteId)
      .eq('estado', 'activo')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    this.throwIfError(error);

    if (data) {
      return data as HistoriaClinica;
    }

    const payload: HistoriaClinicaInsert = {
      paciente_id: pacienteId,
      usuario_id: null,
      numero_formulario: null,
      motivo_consulta: 'Creada automáticamente desde el odontograma',
      enfermedad_actual: null,
      antecedentes_personales: null,
      antecedentes_familiares: null,
      signos_vitales: null,
      examen_estomatognatico: null,
      diagnosticos: null,
      plan_tratamiento: null,
      observaciones: 'Historia clínica creada automáticamente desde el odontograma.',
      estado: 'activo'
    };

    const { data: created, error: createError } = await supabaseDynamic
      .from('historias_clinicas')
      .insert(payload)
      .select('*')
      .single();

    this.throwIfError(createError);
    return created as HistoriaClinica;
  }

  private validatePayload(payload: HistoriaClinicaInsert | HistoriaClinicaUpdate): void {
    if ('paciente_id' in payload && !payload.paciente_id) {
      throw new Error('Seleccione un paciente.');
    }
    if ('motivo_consulta' in payload && !normalizeWhitespace(payload.motivo_consulta ?? '')) {
      throw new Error('El motivo de consulta es obligatorio.');
    }
    if (payload.estado === 'completado' && !payload.diagnosticos) {
      throw new Error('El diagnóstico es obligatorio.');
    }
  }
}
