export const environment = {
  production: true,
  supabaseUrl: 'https://REEMPLAZA_TU_PROYECTO.supabase.co',
  supabaseAnonKey: 'REEMPLAZA_TU_SUPABASE_ANON_KEY',
  storageBuckets: {
    pacientes: 'pacientes',
    radiografias: 'radiografias',
    documentos: 'documentos'
  }
} as const;
