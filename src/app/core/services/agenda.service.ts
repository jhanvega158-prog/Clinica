import { Injectable } from '@angular/core';
import { BaseRepository } from '../repositories/base.repository';
import { Agenda, AgendaInsert, AgendaUpdate } from '../models/interfaces/database.types';

@Injectable({ providedIn: 'root' })
export class AgendaService extends BaseRepository<Agenda, AgendaInsert, AgendaUpdate> {
  constructor() {
    super('agenda', 'fecha');
  }

  async porPaciente(pacienteId: string): Promise<Agenda[]> {
    return this.findAll({ filters: [{ column: 'paciente_id', value: pacienteId }], orderBy: 'fecha', ascending: false });
  }
}
