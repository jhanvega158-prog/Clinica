import { Injectable } from '@angular/core';
import { BaseRepository } from '../repositories/base.repository';
import { Tratamiento, TratamientoInsert, TratamientoUpdate } from '../models/interfaces/database.types';

@Injectable({ providedIn: 'root' })
export class TratamientosService extends BaseRepository<Tratamiento, TratamientoInsert, TratamientoUpdate> {
  constructor() {
    super('tratamientos', 'fecha');
  }
}
