import { Injectable } from '@angular/core';
import { BaseRepository } from '../repositories/base.repository';
import { DetalleFactura, EstadoFactura, Factura, FacturaInsert, FacturaUpdate } from '../models/interfaces/database.types';
import { supabaseDynamic } from '../config/supabase';

export interface FacturaCabeceraPayload {
  numero: string;
  paciente_id: string;
  fecha: string;
  estado: EstadoFactura;
  iva_porcentaje: number;
  observaciones: string | null;
}

export interface DetalleFacturaPayload {
  tratamiento_id: string | null;
  descripcion: string;
  cantidad: number;
  precio_unitario: number;
  descuento: number;
  total: number;
}

@Injectable({ providedIn: 'root' })
export class FacturacionService extends BaseRepository<Factura, FacturaInsert, FacturaUpdate> {
  constructor() { super('facturas', 'fecha'); }

  async siguienteNumero(): Promise<string> {
    const { data, error } = await supabaseDynamic.rpc('generar_numero_factura');
    this.throwIfError(error);
    return String(data);
  }

  async detalles(facturaId: string): Promise<DetalleFactura[]> {
    const { data, error } = await supabaseDynamic.from('detalle_facturas').select('*').eq('factura_id', facturaId).order('created_at', { ascending: true });
    this.throwIfError(error);
    return (data ?? []) as DetalleFactura[];
  }

  async guardarConDetalles(facturaId: string | null, payload: FacturaCabeceraPayload, detalles: DetalleFacturaPayload[]): Promise<Factura> {
    let id = facturaId;
    let created = false;
    if (id) {
      const payloadFactura = { ...payload, subtotal: 0, impuesto: 0, descuento: 0, total: 0 };
      const { error: errorFactura } = await supabaseDynamic.from('facturas').update(payloadFactura).eq('id', id);
      if (errorFactura) console.error('Error creando factura:', JSON.stringify(errorFactura, null, 2));
      this.throwIfError(errorFactura);
      const { error: deleteError } = await supabaseDynamic.from('detalle_facturas').delete().eq('factura_id', id);
      this.throwIfError(deleteError);
    } else {
      const numeroFacturaGenerado = await this.siguienteNumero();
      const payloadFactura = {
        numero: numeroFacturaGenerado,
        paciente_id: payload.paciente_id,
        fecha: payload.fecha,
        estado: payload.estado,
        subtotal: 0,
        impuesto: 0,
        iva_porcentaje: payload.iva_porcentaje,
        descuento: 0,
        total: 0,
        observaciones: payload.observaciones
      };
      const { data: facturaCreada, error: errorFactura } = await supabaseDynamic.from('facturas').insert(payloadFactura).select('id').single();
      if (errorFactura) console.error('Error creando factura:', JSON.stringify(errorFactura, null, 2));
      this.throwIfError(errorFactura);
      id = (facturaCreada as { id: string }).id;
      created = true;
    }

    const rows = detalles.map((detalle) => ({ factura_id: id, ...detalle }));
    const { error: errorDetalle } = await supabaseDynamic.from('detalle_facturas').insert(rows);
    if (errorDetalle) {
      console.error('Error guardando detalles:', JSON.stringify(errorDetalle, null, 2));
      if (created && id) await supabaseDynamic.from('facturas').delete().eq('id', id);
      this.throwIfError(errorDetalle);
    }

    const subtotal = this.money(detalles.reduce((sum, detalle) => sum + detalle.cantidad * detalle.precio_unitario, 0));
    const descuento = this.money(detalles.reduce((sum, detalle) => sum + detalle.descuento, 0));
    const baseImponible = Math.max(subtotal - descuento, 0);
    const impuesto = this.money(baseImponible * payload.iva_porcentaje / 100);
    const total = this.money(baseImponible + impuesto);
    const { error: totalsError } = await supabaseDynamic.from('facturas').update({
      subtotal, descuento, impuesto, total, iva_porcentaje: payload.iva_porcentaje
    }).eq('id', id);
    this.throwIfError(totalsError);

    const { data: recalculated, error: reloadError } = await supabaseDynamic.from('facturas').select('*').eq('id', id).single();
    this.throwIfError(reloadError);
    return recalculated as Factura;
  }

  async cargarCompleta(id: string): Promise<{ factura: Factura; detalles: DetalleFactura[] }> {
    const [{ data, error }, detalles] = await Promise.all([
      supabaseDynamic.from('facturas').select('*').eq('id', id).single(),
      this.detalles(id)
    ]);
    this.throwIfError(error);
    return { factura: data as Factura, detalles };
  }

  async cambiarEstado(id: string, estado: EstadoFactura): Promise<Factura> {
    const { data, error } = await supabaseDynamic.from('facturas').update({ estado }).eq('id', id).select('*').single();
    this.throwIfError(error);
    return data as Factura;
  }

  private money(value: number): number {
    return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
  }
}
