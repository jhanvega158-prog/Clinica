import { Injectable } from '@angular/core';
import { BaseRepository } from '../repositories/base.repository';
import { Inventario, InventarioInsert, InventarioMovimiento, InventarioUpdate } from '../models/interfaces/database.types';
import { supabaseDynamic } from '../config/supabase';
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

  async movimientos(inventarioId: string): Promise<Array<InventarioMovimiento & { usuario_nombre: string }>> {
    const { data, error } = await supabaseDynamic.from('inventario_movimientos').select('*').eq('inventario_id', inventarioId).order('created_at', { ascending: false });
    this.throwIfError(error);
    const rows = (data ?? []) as InventarioMovimiento[];
    const ids = [...new Set(rows.map((row) => row.usuario_id).filter(Boolean) as string[])];
    const { data: users, error: usersError } = ids.length ? await supabaseDynamic.from('usuarios').select('id,nombres,apellidos').in('id', ids) : { data: [], error: null };
    this.throwIfError(usersError);
    const names = new Map(((users ?? []) as Array<{id:string;nombres:string;apellidos:string}>).map((u) => [u.id, `${u.nombres} ${u.apellidos}`.trim()]));
    return rows.map((row) => ({ ...row, usuario_nombre: row.usuario_id ? names.get(row.usuario_id) ?? 'Usuario no disponible' : 'Sistema' }));
  }

  async deactivate(id: string): Promise<void> { await this.update(id, { activo: false }); }

  async registrarMovimiento(inventarioId: string, tipo: 'entrada'|'salida'|'ajuste', cantidad: number, motivo: string): Promise<void> {
    const { error } = await supabaseDynamic.rpc('registrar_movimiento_inventario', {
      inventario_id_param: inventarioId, tipo_param: tipo, cantidad_param: cantidad, motivo_param: motivo
    });
    this.throwIfError(error);
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
    if ('unidad' in payload && !normalizeWhitespace(payload.unidad ?? '')) { throw new Error('La unidad es obligatoria.'); }
    if ('costo' in payload && payload.costo !== null && payload.costo !== undefined) {
      const value = Number(payload.costo);
      if (!Number.isFinite(value) || value < 0 || !/^\d+(?:\.\d{1,2})?$/.test(String(payload.costo))) throw new Error('El costo debe ser un número no negativo con máximo 2 decimales.');
    }
  }
}
