export const environment = {
  production: false,
  supabaseUrl: 'https://wvwzzvijxorutkkdiwas.supabase.co',
  supabaseAnonKey: 'sb_publishable_9dTFdSDAlP4cpmNH_ZJCGw_OVForXeP',
  storageBuckets: {
    pacientes: 'pacientes',
    radiografias: 'radiografias',
    documentos: 'documentos'
  }
} as const;
