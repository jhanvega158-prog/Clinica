import { Injectable } from '@angular/core';
import { BaseRepository } from '../repositories/base.repository';
import { supabaseDynamic } from '../config/supabase';
import {
  HistoriaClinica,
  HistoriaClinicaInsert,
  HistoriaClinicaUpdate
} from '../models/interfaces/database.types';

@Injectable({ providedIn: 'root' })
export class HistoriaService extends BaseRepository<HistoriaClinica, HistoriaClinicaInsert, HistoriaClinicaUpdate> {
  constructor() {
    super('historias_clinicas');
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
}
