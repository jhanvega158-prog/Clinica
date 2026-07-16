import { SupabaseClient, createClient } from '@supabase/supabase-js';
import { environment } from '../../../environments/environment';
import { Database } from '../models/interfaces/database.types';

export const supabase = createClient<Database>(
  environment.supabaseUrl,
  environment.supabaseAnonKey,
  {
    auth: {
      autoRefreshToken: true,
      detectSessionInUrl: true,
      persistSession: true
    }
  }
);

export const supabaseDynamic = supabase as unknown as SupabaseClient;
