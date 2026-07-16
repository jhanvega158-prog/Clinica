import { Injectable } from '@angular/core';
import { BaseRepository } from '../repositories/base.repository';
import { Inventario, InventarioInsert, InventarioUpdate } from '../models/interfaces/database.types';

@Injectable({ providedIn: 'root' })
export class InventarioService extends BaseRepository<Inventario, InventarioInsert, InventarioUpdate> {
  constructor() {
    super('inventario', 'nombre');
  }

  async bajoStock(): Promise<Inventario[]> {
    const items = await this.findAll({ orderBy: 'nombre', ascending: true });
    return items.filter((item) => item.stock <= item.stock_minimo);
  }
}
