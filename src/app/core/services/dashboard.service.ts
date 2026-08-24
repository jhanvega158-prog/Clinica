import { Injectable } from '@angular/core';
import { supabase } from '../config/supabase';
import { DashboardCita, DashboardResumen } from '../models/interfaces/database.types';

interface CitaDashboardRow {
  id: string;
  paciente_id: string;
  fecha: string | null;
  hora_inicio: string | null;
  motivo: string | null;
  estado: string | null;
}

@Injectable({ providedIn: 'root' })
export class DashboardService {
  async resumen(): Promise<DashboardResumen | null> {
    const [pacientesResult, tratamientosResult, facturasResult, inventarioResult, citasResult] = await Promise.all([
      supabase.from('pacientes').select('*', { count: 'exact', head: true }).eq('activo', true),
      supabase.from('tratamientos').select('*', { count: 'exact', head: true }).in('estado', ['pendiente', 'activo']),
      supabase.from('facturas').select('total'),
      supabase.from('inventario').select('*', { count: 'exact', head: true }).eq('activo', true),
      this.citas()
    ]);

    if (pacientesResult.error) {
      throw new Error(pacientesResult.error.message);
    }
    if (tratamientosResult.error) {
      throw new Error(tratamientosResult.error.message);
    }
    if (facturasResult.error) {
      throw new Error(facturasResult.error.message);
    }
    if (inventarioResult.error) {
      throw new Error(inventarioResult.error.message);
    }

    const facturacionMes = (facturasResult.data ?? []).reduce((total: number, item: { total?: number | string | null }) => {
      const value = Number(item.total ?? 0);
      return total + (Number.isFinite(value) ? value : 0);
    }, 0);

    const inventarioBajo = (inventarioResult.data ?? []).filter((item: { stock?: number | null; stock_minimo?: number | null }) => {
      const stock = Number(item.stock ?? 0);
      const stockMinimo = Number(item.stock_minimo ?? 0);
      return stock <= stockMinimo;
    }).length;

    const hoy = new Date().toISOString().slice(0, 10);
    const citasHoy = (citasResult as DashboardCita[]).filter((cita) => cita.fecha === hoy).length;

    return {
      pacientes_activos: pacientesResult.count ?? 0,
      citas_hoy: citasHoy,
      tratamientos_pendientes: tratamientosResult.count ?? 0,
      facturacion_mes: facturacionMes,
      inventario_bajo: inventarioBajo
    };
  }

  async citas(): Promise<DashboardCita[]> {
    const { data, error } = await supabase.from('citas').select('*').order('fecha', { ascending: true }).order('hora_inicio', { ascending: true });
    if (error) {
      throw new Error(error.message);
    }

    const citas = (data ?? []) as CitaDashboardRow[];
    const visible = citas.filter((cita) => this.esVisibleEnDashboard(cita));

    if (!visible.length) {
      return [];
    }

    const pacienteIds = [...new Set(visible.map((cita) => cita.paciente_id))];
    const { data: pacientes, error: pacientesError } = await supabase
      .from('pacientes')
      .select('id,nombres,apellidos')
      .in('id', pacienteIds);

    if (pacientesError) {
      throw new Error(pacientesError.message);
    }

    const pacientesMap = new Map((pacientes ?? []).map((paciente: { id: string; nombres: string; apellidos: string }) => [paciente.id, paciente]));

    return visible.map((cita) => {
      const paciente = pacientesMap.get(cita.paciente_id);
      return {
        id: cita.id,
        paciente: paciente ? `${paciente.apellidos} ${paciente.nombres}`.trim() : 'Paciente no encontrado',
        fecha: cita.fecha,
        hora_inicio: cita.hora_inicio,
        motivo: cita.motivo,
        estado: cita.estado
      };
    });
  }

  private esVisibleEnDashboard(cita: CitaDashboardRow): boolean {
    if (!cita.fecha) {
      return false;
    }

    if (['cancelada', 'atendida', 'reagendada', 'no_asistio'].includes(cita.estado ?? '')) {
      return false;
    }

    const hoy = new Date().toISOString().slice(0, 10);
    if (cita.fecha < hoy) {
      return false;
    }

    if (cita.fecha === hoy) {
      const ahora = new Date();
      const [hora, minutos] = (cita.hora_inicio ?? '00:00').split(':').map(Number);
      const citaMinutos = hora * 60 + minutos;
      const ahoraMinutos = ahora.getHours() * 60 + ahora.getMinutes();
      return citaMinutos >= ahoraMinutos;
    }

    return true;
  }
}
