import { Injectable } from '@angular/core';
import { BaseRepository } from '../repositories/base.repository';
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
}
