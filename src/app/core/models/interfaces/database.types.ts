export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type EntityId = string;
export type EstadoRegistro = 'activo' | 'inactivo' | 'pendiente' | 'completado' | 'anulado';
export type SexoPaciente = 'Femenino' | 'Masculino' | 'Otro' | 'No especificado';
export type TipoDocumentoClinico = 'foto' | 'radiografia' | 'documento';

export interface Auditable {
  id: EntityId;
  created_at: string | null;
  updated_at: string | null;
}

export interface Usuario extends Auditable {
  auth_user_id: string;
  email: string;
  nombres: string;
  apellidos: string;
  rol: string;
  telefono: string | null;
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

export interface HistoriaClinica extends Auditable {
  paciente_id: EntityId;
  usuario_id: EntityId | null;
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

export interface Agenda extends Auditable {
  paciente_id: EntityId;
  usuario_id: EntityId | null;
  fecha: string;
  hora_inicio: string;
  hora_fin: string | null;
  motivo: string;
  estado: EstadoRegistro;
  notas: string | null;
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
  superficie: string | null;
  condicion: string;
  movilidad: number | null;
  recesion: number | null;
  notas: string | null;
}

export interface Tratamiento extends Auditable {
  paciente_id: EntityId;
  historia_id: EntityId | null;
  diagnostico: string;
  procedimiento: string;
  prescripcion: string | null;
  fecha: string;
  estado: EstadoRegistro;
  costo: number | null;
  notas: string | null;
}

export interface Factura extends Auditable {
  paciente_id: EntityId;
  numero: string;
  fecha: string;
  subtotal: number;
  impuesto: number;
  descuento: number;
  total: number;
  estado: EstadoRegistro;
  observaciones: string | null;
}

export interface FacturaItem extends Auditable {
  factura_id: EntityId;
  descripcion: string;
  cantidad: number;
  precio_unitario: number;
  total: number;
}

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

export interface DocumentoClinico extends Auditable {
  paciente_id: EntityId;
  historia_id: EntityId | null;
  tipo: TipoDocumentoClinico;
  nombre: string;
  path: string;
  url: string;
  mime_type: string | null;
  size: number | null;
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

export type InsertOf<T extends Auditable> = Omit<T, 'id' | 'created_at' | 'updated_at'> &
  Partial<Pick<T, 'id' | 'created_at' | 'updated_at'>>;
export type UpdateOf<T extends Auditable> = Partial<InsertOf<T>>;

export interface Database {
  public: {
    Tables: {
      usuarios: { Row: Usuario; Insert: InsertOf<Usuario>; Update: UpdateOf<Usuario> };
      pacientes: { Row: Paciente; Insert: InsertOf<Paciente>; Update: UpdateOf<Paciente> };
      historias_clinicas: { Row: HistoriaClinica; Insert: InsertOf<HistoriaClinica>; Update: UpdateOf<HistoriaClinica> };
      agenda: { Row: Agenda; Insert: InsertOf<Agenda>; Update: UpdateOf<Agenda> };
      odontogramas: { Row: Odontograma; Insert: InsertOf<Odontograma>; Update: UpdateOf<Odontograma> };
      odontograma_detalles: { Row: OdontogramaDetalle; Insert: InsertOf<OdontogramaDetalle>; Update: UpdateOf<OdontogramaDetalle> };
      tratamientos: { Row: Tratamiento; Insert: InsertOf<Tratamiento>; Update: UpdateOf<Tratamiento> };
      facturas: { Row: Factura; Insert: InsertOf<Factura>; Update: UpdateOf<Factura> };
      factura_items: { Row: FacturaItem; Insert: InsertOf<FacturaItem>; Update: UpdateOf<FacturaItem> };
      inventario: { Row: Inventario; Insert: InsertOf<Inventario>; Update: UpdateOf<Inventario> };
      documentos_clinicos: { Row: DocumentoClinico; Insert: InsertOf<DocumentoClinico>; Update: UpdateOf<DocumentoClinico> };
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
