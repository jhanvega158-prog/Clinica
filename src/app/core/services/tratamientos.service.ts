import { Injectable } from '@angular/core';
import { BaseRepository } from '../repositories/base.repository';
import { Tratamiento, TratamientoInsert, TratamientoUpdate } from '../models/interfaces/database.types';
import { normalizeWhitespace } from '../../shared/utils/validation.utils';

@Injectable({ providedIn: 'root' })
export class TratamientosService extends BaseRepository<Tratamiento, TratamientoInsert, TratamientoUpdate> {
  constructor() {
    super('tratamientos', 'fecha');
  }

  override async create(payload: TratamientoInsert): Promise<Tratamiento> {
    this.validatePayload(payload);
    return super.create(payload);
  }

  override async update(id: string, payload: TratamientoUpdate): Promise<Tratamiento> {
    this.validatePayload(payload);
    return super.update(id, payload);
  }

  private validatePayload(payload: TratamientoInsert | TratamientoUpdate): void {
    if ('paciente_id' in payload && !payload.paciente_id) { throw new Error('Seleccione un paciente.'); }
    if ('diagnostico' in payload && !normalizeWhitespace(payload.diagnostico ?? '')) { throw new Error('El diagnóstico es obligatorio.'); }
    if ('procedimiento' in payload && !normalizeWhitespace(payload.procedimiento ?? '')) { throw new Error('El tratamiento es obligatorio.'); }
    if ('costo' in payload && payload.costo !== null && payload.costo !== undefined) {
      const costo = Number(payload.costo);
      if (!Number.isFinite(costo) || costo < 0 || !/^\d+(?:\.\d{1,2})?$/.test(String(payload.costo))) {
        throw new Error('El costo debe ser un número no negativo con máximo 2 decimales.');
      }
    }
    if ('estado' in payload && payload.estado && !['pendiente', 'activo', 'completado', 'anulado'].includes(payload.estado)) { throw new Error('Seleccione una opción válida.'); }
  }
}
