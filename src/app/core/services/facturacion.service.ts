import { Injectable } from '@angular/core';
import { supabase } from '../config/supabase';
import { BaseRepository } from '../repositories/base.repository';
import { Factura, FacturaInsert, FacturaItem, FacturaUpdate } from '../models/interfaces/database.types';
import { normalizeWhitespace } from '../../shared/utils/validation.utils';

@Injectable({ providedIn: 'root' })
export class FacturacionService extends BaseRepository<Factura, FacturaInsert, FacturaUpdate> {
  constructor() {
    super('facturas', 'fecha');
  }

  override async create(payload: FacturaInsert): Promise<Factura> {
    this.validatePayload(payload);
    return super.create(payload);
  }

  override async update(id: string, payload: FacturaUpdate): Promise<Factura> {
    this.validatePayload(payload);
    return super.update(id, payload);
  }

  async items(facturaId: string): Promise<FacturaItem[]> {
    const { data, error } = await supabase
      .from('factura_items')
      .select('*')
      .eq('factura_id', facturaId)
      .order('created_at', { ascending: true });
    this.throwIfError(error);
    return data ?? [];
  }

  private validatePayload(payload: FacturaInsert | FacturaUpdate): void {
    if ('paciente_id' in payload && !payload.paciente_id) { throw new Error('Seleccione un paciente.'); }
    if ('numero' in payload && !normalizeWhitespace(payload.numero ?? '')) { throw new Error('El número de factura es obligatorio.'); }
    for (const field of ['subtotal', 'impuesto', 'descuento', 'total'] as const) {
      if (field in payload && payload[field] !== null && payload[field] !== undefined && Number(payload[field]) < 0) {
        throw new Error('El valor ingresado no puede ser negativo.');
      }
    }
    if ('subtotal' in payload && 'descuento' in payload && Number(payload.descuento) > Number(payload.subtotal)) {
      throw new Error('El descuento no puede superar el subtotal.');
    }
  }
}
