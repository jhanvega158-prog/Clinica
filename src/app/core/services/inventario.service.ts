import { Injectable } from '@angular/core';
import { BaseRepository } from '../repositories/base.repository';
import { Inventario, InventarioInsert, InventarioUpdate } from '../models/interfaces/database.types';
import { normalizeWhitespace } from '../../shared/utils/validation.utils';

@Injectable({ providedIn: 'root' })
export class InventarioService extends BaseRepository<Inventario, InventarioInsert, InventarioUpdate> {
  constructor() {
    super('inventario', 'nombre');
  }

  override async create(payload: InventarioInsert): Promise<Inventario> {
    this.validatePayload(payload);
    return super.create(payload);
  }

  override async update(id: string, payload: InventarioUpdate): Promise<Inventario> {
    this.validatePayload(payload);
    return super.update(id, payload);
  }

  async bajoStock(): Promise<Inventario[]> {
    const items = await this.findAll({ orderBy: 'nombre', ascending: true });
    return items.filter((item) => item.stock <= item.stock_minimo);
  }

  private validatePayload(payload: InventarioInsert | InventarioUpdate): void {
    if ('codigo' in payload && !normalizeWhitespace(payload.codigo ?? '')) { throw new Error('El código es obligatorio.'); }
    if ('nombre' in payload && !normalizeWhitespace(payload.nombre ?? '')) { throw new Error('El nombre del producto es obligatorio.'); }
    if ('categoria' in payload && !normalizeWhitespace(payload.categoria ?? '')) { throw new Error('La categoría es obligatoria.'); }
    for (const field of ['stock', 'stock_minimo'] as const) {
      if (field in payload && (!Number.isInteger(Number(payload[field])) || Number(payload[field]) < 0)) {
        throw new Error(field === 'stock' ? 'El stock no puede ser negativo.' : 'El valor ingresado no puede ser negativo.');
      }
    }
    if ('costo' in payload && payload.costo !== null && payload.costo !== undefined && Number(payload.costo) < 0) {
      throw new Error('El valor ingresado no puede ser negativo.');
    }
  }
}
