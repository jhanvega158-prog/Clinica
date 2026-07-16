import { Injectable } from '@angular/core';
import { supabase } from '../config/supabase';
import { DashboardCita, DashboardResumen } from '../models/interfaces/database.types';

@Injectable({ providedIn: 'root' })
export class DashboardService {
  async resumen(): Promise<DashboardResumen | null> {
    const { data, error } = await supabase.from('vw_dashboard_resumen').select('*').maybeSingle();
    if (error) {
      throw new Error(error.message);
    }
    return data;
  }

  async citas(): Promise<DashboardCita[]> {
    const { data, error } = await supabase
      .from('vw_dashboard_citas')
      .select('*')
      .order('fecha', { ascending: true })
      .order('hora_inicio', { ascending: true });
    if (error) {
      throw new Error(error.message);
    }
    return data ?? [];
  }
}
