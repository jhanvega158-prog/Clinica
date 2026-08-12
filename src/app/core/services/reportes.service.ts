import { Injectable } from '@angular/core';
import { supabaseDynamic } from '../config/supabase';
import { Cita, Factura, Inventario, Paciente, Tratamiento, Usuario } from '../models/interfaces/database.types';

export interface ReporteFiltros { desde: string; hasta: string; odontologoId: string; estado: string; }
export interface ReporteCita extends Cita { paciente_nombre: string; paciente_documento: string; odontologo_nombre: string; }
export interface FiltrosTablaCitas { desde: string; hasta: string; estado: string; paciente: string; }
export interface ReporteDatos {
  pacientes: Paciente[]; citas: ReporteCita[]; tratamientos: Tratamiento[];
  facturas: Factura[]; inventario: Inventario[]; odontologos: Usuario[];
}

@Injectable({ providedIn: 'root' })
export class ReportesService {
  async cargar(filtros: ReporteFiltros): Promise<ReporteDatos> {
    let citasQuery = supabaseDynamic.from('citas').select('*').gte('fecha', filtros.desde).lte('fecha', filtros.hasta);
    if (filtros.odontologoId) citasQuery = citasQuery.eq('usuario_id', filtros.odontologoId);
    if (filtros.estado) citasQuery = citasQuery.eq('estado', filtros.estado);
    const [pacientesResult, citasResult, tratamientosResult, facturasResult, inventarioResult, usuariosResult] = await Promise.all([
      supabaseDynamic.from('pacientes').select('*'),
      citasQuery.order('fecha').order('hora_inicio'),
      supabaseDynamic.from('tratamientos').select('*').gte('fecha', filtros.desde).lte('fecha', filtros.hasta),
      supabaseDynamic.from('facturas').select('*').gte('fecha', filtros.desde).lte('fecha', filtros.hasta),
      supabaseDynamic.from('inventario').select('*').eq('activo', true).order('nombre'),
      supabaseDynamic.from('usuarios').select('*').eq('activo', true).order('apellidos')
    ]);
    const results = [pacientesResult, citasResult, tratamientosResult, facturasResult, inventarioResult, usuariosResult];
    const failed = results.find((result) => result.error);
    if (failed?.error) { console.error('Error al cargar reportes de Supabase:', failed.error); throw new Error(failed.error.message); }
    const pacientes = (pacientesResult.data ?? []) as Paciente[];
    const usuarios = (usuariosResult.data ?? []) as Usuario[];
    const pacientesMap = new Map(pacientes.map((p) => [p.id, `${p.apellidos} ${p.nombres}`.trim()]));
    const usuariosMap = new Map(usuarios.map((u) => [u.id, `${u.nombres} ${u.apellidos}`.trim()]));
    const citas = ((citasResult.data ?? []) as Cita[]).map((cita) => ({ ...cita,
      paciente_nombre: pacientesMap.get(cita.paciente_id) ?? 'Paciente no encontrado',
      paciente_documento: pacientes.find((p) => p.id === cita.paciente_id)?.cedula ?? '',
      odontologo_nombre: cita.usuario_id ? usuariosMap.get(cita.usuario_id) ?? 'Profesional no encontrado' : 'Sin asignar'
    }));
    return { pacientes, citas, tratamientos: (tratamientosResult.data ?? []) as Tratamiento[],
      facturas: (facturasResult.data ?? []) as Factura[], inventario: (inventarioResult.data ?? []) as Inventario[], odontologos: usuarios };
  }

  async cargarCitasTabla(filtros: FiltrosTablaCitas): Promise<ReporteCita[]> {
    const term = filtros.paciente.trim();
    let pacientesQuery = supabaseDynamic.from('pacientes').select('id,nombres,apellidos,cedula');
    if (term) {
      const safe = term.replace(/[%_,()]/g, ' ').trim();
      pacientesQuery = pacientesQuery.or(`nombres.ilike.%${safe}%,apellidos.ilike.%${safe}%,cedula.ilike.%${safe}%`);
    }
    const { data: pacientes, error: pacientesError } = await pacientesQuery;
    if (pacientesError) { console.error('Error buscando pacientes para reporte de citas:', pacientesError); throw new Error(pacientesError.message); }
    const patientRows = (pacientes ?? []) as Array<{id:string;nombres:string;apellidos:string;cedula:string}>;
    if (term && !patientRows.length) return [];
    let query = supabaseDynamic.from('citas').select('*').gte('fecha', filtros.desde).lte('fecha', filtros.hasta);
    if (filtros.estado) query = query.eq('estado', filtros.estado);
    if (term) query = query.in('paciente_id', patientRows.map((p) => p.id));
    const { data: citas, error: citasError } = await query.order('fecha', { ascending: false }).order('hora_inicio', { ascending: false });
    if (citasError) { console.error('Error cargando tabla de citas:', citasError); throw new Error(citasError.message); }
    const citaRows = (citas ?? []) as Cita[];
    const userIds = [...new Set(citaRows.map((c) => c.usuario_id).filter(Boolean) as string[])];
    const { data: usuarios, error: usersError } = userIds.length
      ? await supabaseDynamic.from('usuarios').select('id,nombres,apellidos').in('id', userIds)
      : { data: [], error: null };
    if (usersError) { console.error('Error cargando odontólogos de citas:', usersError); throw new Error(usersError.message); }
    const patientsMap = new Map(patientRows.map((p) => [p.id, p]));
    const usersMap = new Map(((usuarios ?? []) as Array<{id:string;nombres:string;apellidos:string}>).map((u) => [u.id, `${u.nombres} ${u.apellidos}`.trim()]));
    return citaRows.map((cita) => { const p = patientsMap.get(cita.paciente_id); return { ...cita,
      paciente_nombre: p ? `${p.apellidos} ${p.nombres}`.trim() : 'Paciente no encontrado', paciente_documento: p?.cedula ?? '',
      odontologo_nombre: cita.usuario_id ? usersMap.get(cita.usuario_id) ?? 'Profesional no encontrado' : 'Sin asignar' }; });
  }
}
