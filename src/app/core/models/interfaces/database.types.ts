export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type EntityId = string;
export type EstadoRegistro = 'activo' | 'inactivo' | 'pendiente' | 'completado' | 'anulado';
export type EstadoCita = 'pendiente' | 'confirmada' | 'atendida' | 'cancelada' | 'reagendada' | 'no_asistio';
export type EstadoTratamiento = 'pendiente' | 'en_proceso' | 'completado' | 'suspendido' | 'anulado';
export type EstadoRecordatorio = 'pendiente' | 'enviado' | 'fallido';
export type TipoRecordatorio = 'recordatorio' | 'seguimiento';
export type SexoPaciente = 'Femenino' | 'Masculino' | 'Otro' | 'No especificado';
export type TipoDocumentoClinico = 'foto' | 'radiografia' | 'documento' | 'examen' | 'consentimiento' | 'firma';
export type TipoDiagnostico = 'presuntivo' | 'definitivo' | 'diferencial';
export type Denticion = 'permanente' | 'temporal';
export type FiguraPieza = 'cuadrada' | 'circular';

export interface Auditable {
  id: EntityId;
  created_at: string | null;
  updated_at: string | null;
}

export interface Rol extends Auditable {
  codigo: string;
  nombre: string;
  descripcion: string | null;
  activo: boolean;
}

export interface Permiso extends Auditable {
  codigo: string;
  modulo: string;
  accion: string;
  descripcion: string | null;
}

export interface Usuario extends Auditable {
  auth_user_id: string | null;
  email: string;
  nombres: string;
  apellidos: string;
  rol: string;
  telefono: string | null;
  activo: boolean;
  ultimo_acceso?: string | null;
}

export interface Especialidad extends Auditable {
  nombre: string;
  descripcion: string | null;
  activa: boolean;
}

export interface Odontologo extends Auditable {
  usuario_id: EntityId;
  numero_registro: string | null;
  firma_url: string | null;
  activo: boolean;
}

export interface Seguro extends Auditable {
  nombre: string;
  ruc: string | null;
  telefono: string | null;
  email: string | null;
  activo: boolean;
}

export interface Paciente extends Auditable {
  numero_historia: string;
  cedula: string;
  nombres: string;
  apellidos: string;
  fecha_nacimiento: string | null;
  sexo: SexoPaciente;
  telefono: string | null;
  email: string | null;
  direccion: string | null;
  ocupacion: string | null;
  contacto_emergencia: string | null;
  telefono_emergencia: string | null;
  alergias: string | null;
  antecedentes: string | null;
  foto_url: string | null;
  activo: boolean;
}

export interface PacienteSeguro extends Auditable {
  paciente_id: EntityId;
  seguro_id: EntityId;
  numero_poliza: string | null;
  cobertura: string | null;
  fecha_inicio: string | null;
  fecha_fin: string | null;
  activo: boolean;
}

export interface HistoriaClinica extends Auditable {
  paciente_id: EntityId;
  usuario_id: EntityId | null;
  numero_formulario?: string | null;
  fecha_apertura?: string;
  motivo_consulta: string | null;
  enfermedad_actual: string | null;
  antecedentes_personales: Json | null;
  antecedentes_familiares: Json | null;
  signos_vitales: Json | null;
  examen_estomatognatico: Json | null;
  diagnosticos: Json | null;
  plan_tratamiento: string | null;
  observaciones: string | null;
  estado: EstadoRegistro;
}

export interface ConstanteVital extends Auditable {
  historia_id: EntityId;
  paciente_id: EntityId;
  temperatura: number | null;
  pulso: number | null;
  frecuencia_respiratoria: number | null;
  presion_sistolica: number | null;
  presion_diastolica: number | null;
  registrada_por: EntityId | null;
  fecha_registro: string;
  observaciones: string | null;
}

export interface ExamenEstomatognaticoItem {
  id: EntityId;
  codigo: string;
  nombre: string;
  orden: number;
  activo: boolean;
}

export interface ExamenEstomatognatico extends Auditable {
  historia_id: EntityId;
  item_id: EntityId;
  normal: boolean;
  patologico: boolean;
  observaciones: string | null;
}

export interface IndicadorSaludBucal extends Auditable {
  historia_id: EntityId;
  higiene_placa: boolean;
  higiene_calculo: boolean;
  higiene_gingivitis: boolean;
  periodontal_leve: boolean;
  periodontal_moderada: boolean;
  periodontal_severa: boolean;
  oclusion_clase_i: boolean;
  oclusion_clase_ii: boolean;
  oclusion_clase_iii: boolean;
  fluorosis_leve: boolean;
  fluorosis_moderada: boolean;
  fluorosis_severa: boolean;
  observaciones: string | null;
}

export interface PiezaDental {
  id: EntityId;
  numero: number;
  denticion: Denticion;
  cuadrante: number;
  posicion: number;
  arcada: 'superior' | 'inferior';
  lado: 'derecha' | 'izquierda';
  figura: FiguraPieza;
  etiqueta: string | null;
  orden_msp: number;
  activo: boolean;
}

export interface EstadoPieza extends Auditable {
  codigo: string;
  nombre: string;
  color: string | null;
  descripcion: string | null;
  activo: boolean;
}

export interface Odontograma extends Auditable {
  paciente_id: EntityId;
  historia_id: EntityId | null;
  tipo: 'inicial' | 'evolucion';
  estado: EstadoRegistro;
  observaciones: string | null;
}

export interface OdontogramaDetalle extends Auditable {
  odontograma_id: EntityId;
  pieza: number;
  estado_pieza_id?: EntityId | null;
  superficie: string | null;
  condicion: string;
  movilidad: number | null;
  recesion: number | null;
  notas: string | null;
}

export interface OdontogramaCpoManual extends Auditable {
  odontograma_id: EntityId;
  cariadas: number;
  perdidas: number;
  obturadas: number;
  ceo: number;
  total: number;
  observaciones: string | null;
}

export interface PiezaExaminada extends Auditable {
  historia_id: EntityId;
  pieza: number;
  examinada: boolean;
  observaciones: string | null;
}

export interface Diagnostico extends Auditable {
  historia_id: EntityId;
  paciente_id: EntityId;
  codigo_cie: string | null;
  descripcion: string;
  tipo: TipoDiagnostico;
  observaciones: string | null;
  activo: boolean;
}

export interface Tratamiento extends Auditable {
  paciente_id: EntityId;
  historia_id: EntityId | null;
  diagnostico_id?: EntityId | null;
  diagnostico: string;
  procedimiento: string;
  prescripcion: string | null;
  fecha: string;
  estado: EstadoRegistro;
  costo: number | null;
  notas: string | null;
}

export interface SesionTratamiento extends Auditable {
  tratamiento_id: EntityId;
  paciente_id: EntityId;
  historia_id: EntityId | null;
  diagnostico_id: EntityId | null;
  fecha: string;
  procedimiento: string;
  prescripcion: string | null;
  firma_url: string | null;
  odontologo_id: EntityId | null;
  usuario_id: EntityId | null;
  estado: EstadoTratamiento;
  observaciones: string | null;
}

export interface Medicamento extends Auditable {
  nombre: string;
  principio_activo: string | null;
  presentacion: string | null;
  concentracion: string | null;
  activo: boolean;
}

export interface Receta extends Auditable {
  paciente_id: EntityId;
  historia_id: EntityId | null;
  sesion_id: EntityId | null;
  odontologo_id: EntityId | null;
  fecha: string;
  indicaciones_generales: string | null;
  estado: EstadoRegistro;
}

export interface RecetaMedicamento extends Auditable {
  receta_id: EntityId;
  medicamento_id: EntityId | null;
  medicamento_nombre: string;
  dosis: string;
  frecuencia: string | null;
  duracion: string | null;
  via: string | null;
  instrucciones: string | null;
}

export interface Agenda extends Auditable {
  paciente_id: EntityId;
  usuario_id: EntityId | null;
  fecha: string;
  hora_inicio: string;
  hora_fin: string | null;
  motivo: string;
  estado: EstadoCita;
  notas: string | null;
}

export interface Cita extends Agenda {
  odontologo_id: EntityId | null;
  cita_origen_id: EntityId | null;
  inicio?: string;
  fin?: string;
}

export interface RecordatorioWhatsapp extends Auditable {
  cita_id: EntityId;
  paciente_id: EntityId;
  usuario_id: EntityId | null;
  tipo: TipoRecordatorio;
  telefono: string | null;
  mensaje: string;
  estado: EstadoRecordatorio;
  enviado_at: string | null;
}

export interface Examen extends Auditable {
  paciente_id: EntityId;
  historia_id: EntityId | null;
  tipo: string;
  nombre: string;
  descripcion: string | null;
  fecha_examen: string | null;
  resultado: string | null;
  solicitado_por: EntityId | null;
  estado: EstadoRegistro;
}

export interface ArchivoClinico extends Auditable {
  paciente_id: EntityId;
  historia_id: EntityId | null;
  examen_id: EntityId | null;
  tipo: TipoDocumentoClinico;
  nombre: string;
  bucket: string;
  path: string;
  url: string;
  mime_type: string | null;
  size: number | null;
  usuario_id: EntityId | null;
  eliminado: boolean;
}

export type DocumentoClinico = Pick<
  ArchivoClinico,
  'id' | 'paciente_id' | 'historia_id' | 'tipo' | 'nombre' | 'bucket' | 'path' | 'url' | 'mime_type' | 'size' | 'created_at' | 'updated_at'
>;

export type EstadoFactura = 'pendiente' | 'completado' | 'anulado';

export interface Factura extends Auditable {
  paciente_id: EntityId;
  numero: string;
  fecha: string;
  subtotal: number;
  impuesto: number;
  descuento: number;
  total: number;
  estado: EstadoFactura;
  observaciones: string | null;
}

export interface DetalleFactura {
  id: EntityId;
  factura_id: EntityId;
  tratamiento_id: EntityId | null;
  descripcion: string;
  cantidad: number;
  precio_unitario: number;
  descuento: number;
  total: number;
  created_at: string | null;
}

export type FacturaItem = DetalleFactura;

export interface Inventario extends Auditable {
  codigo: string;
  nombre: string;
  categoria: string | null;
  stock: number;
  stock_minimo: number;
  unidad: string | null;
  costo: number | null;
  vencimiento: string | null;
  activo: boolean;
}

export interface InventarioMovimiento {
  id: EntityId;
  inventario_id: EntityId;
  tipo: 'entrada' | 'salida' | 'ajuste';
  cantidad: number;
  motivo: string | null;
  usuario_id: EntityId | null;
  created_at: string | null;
}

export interface ConfiguracionSistema extends Auditable {
  clave: string;
  valor: Json;
  descripcion: string | null;
  editable: boolean;
}

export interface Auditoria {
  id: number;
  tabla: string;
  operacion: string;
  registro_id: EntityId | null;
  usuario_id: EntityId | null;
  auth_user_id: EntityId | null;
  datos_anteriores: Json | null;
  datos_nuevos: Json | null;
  created_at: string;
}

export interface DashboardResumen {
  pacientes_activos: number | null;
  citas_hoy: number | null;
  tratamientos_pendientes: number | null;
  facturacion_mes: number | null;
  inventario_bajo: number | null;
}

export interface DashboardCita {
  id: EntityId;
  paciente: string | null;
  fecha: string | null;
  hora_inicio: string | null;
  motivo: string | null;
  estado: string | null;
}

export interface CpoResultado {
  cariadas: number;
  perdidas: number;
  obturadas: number;
  total: number;
}

export type InsertOf<T extends object> =
  T extends Auditable
    ? Omit<T, 'id' | 'created_at' | 'updated_at'> & Partial<Pick<T, 'id' | 'created_at' | 'updated_at'>>
    : Partial<T>;
export type UpdateOf<T extends object> = Partial<InsertOf<T>>;

export interface Database {
  public: {
    Tables: {
      roles: { Row: Rol; Insert: InsertOf<Rol>; Update: UpdateOf<Rol> };
      permisos: { Row: Permiso; Insert: InsertOf<Permiso>; Update: UpdateOf<Permiso> };
      usuarios: { Row: Usuario; Insert: InsertOf<Usuario>; Update: UpdateOf<Usuario> };
      especialidades: { Row: Especialidad; Insert: InsertOf<Especialidad>; Update: UpdateOf<Especialidad> };
      odontologos: { Row: Odontologo; Insert: InsertOf<Odontologo>; Update: UpdateOf<Odontologo> };
      seguros: { Row: Seguro; Insert: InsertOf<Seguro>; Update: UpdateOf<Seguro> };
      pacientes: { Row: Paciente; Insert: InsertOf<Paciente>; Update: UpdateOf<Paciente> };
      paciente_seguros: { Row: PacienteSeguro; Insert: InsertOf<PacienteSeguro>; Update: UpdateOf<PacienteSeguro> };
      historias_clinicas: { Row: HistoriaClinica; Insert: InsertOf<HistoriaClinica>; Update: UpdateOf<HistoriaClinica> };
      constantes_vitales: { Row: ConstanteVital; Insert: InsertOf<ConstanteVital>; Update: UpdateOf<ConstanteVital> };
      examen_estomatognatico_items: { Row: ExamenEstomatognaticoItem; Insert: InsertOf<ExamenEstomatognaticoItem>; Update: UpdateOf<ExamenEstomatognaticoItem> };
      examen_estomatognatico: { Row: ExamenEstomatognatico; Insert: InsertOf<ExamenEstomatognatico>; Update: UpdateOf<ExamenEstomatognatico> };
      indicadores_salud_bucal: { Row: IndicadorSaludBucal; Insert: InsertOf<IndicadorSaludBucal>; Update: UpdateOf<IndicadorSaludBucal> };
      piezas_dentales: { Row: PiezaDental; Insert: InsertOf<PiezaDental>; Update: UpdateOf<PiezaDental> };
      estados_piezas: { Row: EstadoPieza; Insert: InsertOf<EstadoPieza>; Update: UpdateOf<EstadoPieza> };
      odontogramas: { Row: Odontograma; Insert: InsertOf<Odontograma>; Update: UpdateOf<Odontograma> };
      odontograma_detalles: { Row: OdontogramaDetalle; Insert: InsertOf<OdontogramaDetalle>; Update: UpdateOf<OdontogramaDetalle> };
      odontograma_cpo_manual: { Row: OdontogramaCpoManual; Insert: InsertOf<OdontogramaCpoManual>; Update: UpdateOf<OdontogramaCpoManual> };
      piezas_examinadas: { Row: PiezaExaminada; Insert: InsertOf<PiezaExaminada>; Update: UpdateOf<PiezaExaminada> };
      diagnosticos: { Row: Diagnostico; Insert: InsertOf<Diagnostico>; Update: UpdateOf<Diagnostico> };
      tratamientos: { Row: Tratamiento; Insert: InsertOf<Tratamiento>; Update: UpdateOf<Tratamiento> };
      sesiones_tratamiento: { Row: SesionTratamiento; Insert: InsertOf<SesionTratamiento>; Update: UpdateOf<SesionTratamiento> };
      medicamentos: { Row: Medicamento; Insert: InsertOf<Medicamento>; Update: UpdateOf<Medicamento> };
      recetas: { Row: Receta; Insert: InsertOf<Receta>; Update: UpdateOf<Receta> };
      receta_medicamentos: { Row: RecetaMedicamento; Insert: InsertOf<RecetaMedicamento>; Update: UpdateOf<RecetaMedicamento> };
      citas: { Row: Cita; Insert: InsertOf<Cita>; Update: UpdateOf<Cita> };
      agenda: { Row: Agenda; Insert: InsertOf<Agenda>; Update: UpdateOf<Agenda> };
      recordatorios_whatsapp: { Row: RecordatorioWhatsapp; Insert: InsertOf<RecordatorioWhatsapp>; Update: UpdateOf<RecordatorioWhatsapp> };
      examenes: { Row: Examen; Insert: InsertOf<Examen>; Update: UpdateOf<Examen> };
      archivos_clinicos: { Row: ArchivoClinico; Insert: InsertOf<ArchivoClinico>; Update: UpdateOf<ArchivoClinico> };
      documentos_clinicos: { Row: DocumentoClinico; Insert: InsertOf<DocumentoClinico>; Update: UpdateOf<DocumentoClinico> };
      facturas: { Row: Factura; Insert: InsertOf<Factura>; Update: UpdateOf<Factura> };
      detalle_facturas: { Row: DetalleFactura; Insert: Omit<DetalleFactura, 'id' | 'created_at'>; Update: Partial<Omit<DetalleFactura, 'id' | 'created_at'>> };
      inventario: { Row: Inventario; Insert: InsertOf<Inventario>; Update: UpdateOf<Inventario> };
      inventario_movimientos: { Row: InventarioMovimiento; Insert: InsertOf<InventarioMovimiento>; Update: UpdateOf<InventarioMovimiento> };
      configuracion_sistema: { Row: ConfiguracionSistema; Insert: InsertOf<ConfiguracionSistema>; Update: UpdateOf<ConfiguracionSistema> };
      auditoria: { Row: Auditoria; Insert: InsertOf<Auditoria>; Update: UpdateOf<Auditoria> };
    };
    Views: {
      vw_dashboard_resumen: { Row: DashboardResumen };
      vw_dashboard_citas: { Row: DashboardCita };
    };
    Functions: {
      calcular_cpo: {
        Args: { paciente_id_param: string };
        Returns: CpoResultado;
      };
    };
  };
}

export type PacienteInsert = Database['public']['Tables']['pacientes']['Insert'];
export type PacienteUpdate = Database['public']['Tables']['pacientes']['Update'];
export type HistoriaClinicaInsert = Database['public']['Tables']['historias_clinicas']['Insert'];
export type HistoriaClinicaUpdate = Database['public']['Tables']['historias_clinicas']['Update'];
export type AgendaInsert = Database['public']['Tables']['agenda']['Insert'];
export type AgendaUpdate = Database['public']['Tables']['agenda']['Update'];
export type OdontogramaInsert = Database['public']['Tables']['odontogramas']['Insert'];
export type OdontogramaUpdate = Database['public']['Tables']['odontogramas']['Update'];
export type OdontogramaDetalleInsert = Database['public']['Tables']['odontograma_detalles']['Insert'];
export type OdontogramaDetalleUpdate = Database['public']['Tables']['odontograma_detalles']['Update'];
export type TratamientoInsert = Database['public']['Tables']['tratamientos']['Insert'];
export type TratamientoUpdate = Database['public']['Tables']['tratamientos']['Update'];
export type FacturaInsert = Database['public']['Tables']['facturas']['Insert'];
export type FacturaUpdate = Database['public']['Tables']['facturas']['Update'];
export type InventarioInsert = Database['public']['Tables']['inventario']['Insert'];
export type InventarioUpdate = Database['public']['Tables']['inventario']['Update'];
export type DocumentoClinicoInsert = Database['public']['Tables']['documentos_clinicos']['Insert'];
