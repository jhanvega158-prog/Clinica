export const environment = {
  production: true,
  supabaseUrl: 'https://soquogsepvcrbihyrdjs.supabase.co',
  supabaseAnonKey: 'sb_publishable_pqfyT7KznacBQcDTmf0lww_M6CrldF9',
  storageBuckets: {
    pacientes: 'pacientes',
    radiografias: 'radiografias',
    documentos: 'documentos',
    examenes: 'examenes',
    firmas: 'firmas'
  }
} as const;
