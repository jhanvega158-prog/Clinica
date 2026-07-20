import { Injectable } from '@angular/core';
import { supabase, supabaseDynamic } from '../config/supabase';
import { BaseRepository } from '../repositories/base.repository';
import {
  CpoResultado,
  IndicadorSaludBucal,
  Odontograma,
  OdontogramaCpoManual,
  OdontogramaDetalle,
  OdontogramaDetalleInsert,
  OdontogramaDetalleUpdate,
  OdontogramaInsert,
  OdontogramaUpdate,
  PiezaExaminada
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

  async findByHistoriaId(historiaId: string): Promise<Odontograma | null> {
    const { data, error } = await supabaseDynamic
      .from('odontogramas')
      .select('*')
      .eq('historia_id', historiaId)
      .maybeSingle();
    this.throwIfError(error);
    return (data as Odontograma | null) ?? null;
  }

  async ensureForHistoria(pacienteId: string, historiaId: string): Promise<Odontograma> {
    const existing = await this.findByHistoriaId(historiaId);
    if (existing) {
      return existing;
    }

    const payload: OdontogramaInsert = {
      paciente_id: pacienteId,
      historia_id: historiaId,
      tipo: 'inicial',
      estado: 'activo',
      observaciones: 'Creado automáticamente desde la historia clínica.'
    };

    return this.create(payload);
  }

  async guardarDetalle(payload: OdontogramaDetalleInsert): Promise<OdontogramaDetalle> {
    const { data: existingData, error: existingError } = await supabaseDynamic
      .from('odontograma_detalles')
      .select('*')
      .eq('odontograma_id', payload.odontograma_id)
      .eq('pieza', payload.pieza)
      .maybeSingle();
    this.throwIfError(existingError);

    if (existingData) {
      await supabaseDynamic.from('odontograma_detalles').delete().eq('id', existingData.id);
    }

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

  async cargarCpoManual(odontogramaId: string): Promise<OdontogramaCpoManual | null> {
    const { data, error } = await supabaseDynamic
      .from('odontograma_cpo_manual')
      .select('*')
      .eq('odontograma_id', odontogramaId)
      .maybeSingle();
    this.throwIfError(error);
    return (data as OdontogramaCpoManual | null) ?? null;
  }

  async guardarCpoManual(odontogramaId: string, payload: Omit<OdontogramaCpoManual, 'id' | 'created_at' | 'updated_at' | 'odontograma_id'>): Promise<OdontogramaCpoManual> {
    const { data, error } = await supabaseDynamic
      .from('odontograma_cpo_manual')
      .upsert({ ...payload, odontograma_id: odontogramaId }, { onConflict: 'odontograma_id' })
      .select('*')
      .single();
    this.throwIfError(error);
    return data as unknown as OdontogramaCpoManual;
  }

  async cargarIndicadores(historiaId: string): Promise<IndicadorSaludBucal | null> {
    const { data, error } = await supabaseDynamic
      .from('indicadores_salud_bucal')
      .select('*')
      .eq('historia_id', historiaId)
      .maybeSingle();
    this.throwIfError(error);
    return (data as IndicadorSaludBucal | null) ?? null;
  }

  async guardarIndicadores(historiaId: string, payload: Omit<IndicadorSaludBucal, 'id' | 'created_at' | 'updated_at' | 'historia_id'>): Promise<IndicadorSaludBucal> {
    const { data, error } = await supabaseDynamic
      .from('indicadores_salud_bucal')
      .upsert({ ...payload, historia_id: historiaId }, { onConflict: 'historia_id' })
      .select('*')
      .single();
    this.throwIfError(error);
    return data as unknown as IndicadorSaludBucal;
  }

  async cargarPiezasExaminadas(historiaId: string): Promise<PiezaExaminada[]> {
    const { data, error } = await supabaseDynamic
      .from('piezas_examinadas')
      .select('*')
      .eq('historia_id', historiaId)
      .order('pieza', { ascending: true });
    this.throwIfError(error);
    return (data ?? []) as PiezaExaminada[];
  }

  async guardarPiezasExaminadas(historiaId: string, piezas: number[]): Promise<PiezaExaminada[]> {
    await supabaseDynamic.from('piezas_examinadas').delete().eq('historia_id', historiaId);
    if (!piezas.length) {
      return [];
    }

    const rows = piezas.map((pieza) => ({ historia_id: historiaId, pieza, examinada: true }));
    const { data, error } = await supabaseDynamic.from('piezas_examinadas').insert(rows).select('*');
    this.throwIfError(error);
    return (data ?? []) as PiezaExaminada[];
  }
}
