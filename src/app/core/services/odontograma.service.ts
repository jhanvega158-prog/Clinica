import { Injectable } from '@angular/core';
import { supabase, supabaseDynamic } from '../config/supabase';
import { BaseRepository } from '../repositories/base.repository';
import {
  CpoResultado,
  Odontograma,
  OdontogramaDetalle,
  OdontogramaDetalleInsert,
  OdontogramaDetalleUpdate,
  OdontogramaInsert,
  OdontogramaUpdate
} from '../models/interfaces/database.types';

@Injectable({ providedIn: 'root' })
export class OdontogramaService extends BaseRepository<Odontograma, OdontogramaInsert, OdontogramaUpdate> {
  constructor() {
    super('odontogramas');
  }

  async detalles(odontogramaId: string): Promise<OdontogramaDetalle[]> {
    const { data, error } = await supabase
      .from('odontograma_detalles')
      .select('*')
      .eq('odontograma_id', odontogramaId)
      .order('pieza', { ascending: true });
    this.throwIfError(error);
    return data ?? [];
  }

  async guardarDetalle(payload: OdontogramaDetalleInsert): Promise<OdontogramaDetalle> {
    const { data, error } = await supabaseDynamic
      .from('odontograma_detalles')
      .insert(payload)
      .select('*')
      .single();
    this.throwIfError(error);
    return data as unknown as OdontogramaDetalle;
  }

  async actualizarDetalle(id: string, payload: OdontogramaDetalleUpdate): Promise<OdontogramaDetalle> {
    const { data, error } = await supabaseDynamic
      .from('odontograma_detalles')
      .update(payload)
      .eq('id', id)
      .select('*')
      .single();
    this.throwIfError(error);
    return data as unknown as OdontogramaDetalle;
  }

  async eliminarDetalle(id: string): Promise<void> {
    const { error } = await supabase.from('odontograma_detalles').delete().eq('id', id);
    this.throwIfError(error);
  }

  async calcularCpo(pacienteId: string): Promise<CpoResultado> {
    const { data, error } = await supabaseDynamic.rpc('calcular_cpo', { paciente_id_param: pacienteId });
    this.throwIfError(error);
    return data as unknown as CpoResultado;
  }
}
