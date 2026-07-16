import { Injectable } from '@angular/core';
import { supabase } from '../config/supabase';
import { BaseRepository } from '../repositories/base.repository';
import { Factura, FacturaInsert, FacturaItem, FacturaUpdate } from '../models/interfaces/database.types';

@Injectable({ providedIn: 'root' })
export class FacturacionService extends BaseRepository<Factura, FacturaInsert, FacturaUpdate> {
  constructor() {
    super('facturas', 'fecha');
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
}
