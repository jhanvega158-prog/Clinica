-- Clinica VitaDenti - Supabase initial schema
-- Ejecutar en el SQL editor de Supabase con una base vacia.

begin;

create extension if not exists pgcrypto;
create extension if not exists btree_gist;

create type public.estado_registro as enum ('activo', 'inactivo', 'pendiente', 'completado', 'anulado');
create type public.sexo_paciente as enum ('Femenino', 'Masculino', 'Otro', 'No especificado');
create type public.tipo_documento_clinico as enum ('foto', 'radiografia', 'documento', 'examen', 'consentimiento', 'firma');
create type public.estado_cita as enum ('pendiente', 'confirmada', 'atendida', 'cancelada', 'reagendada', 'no_asistio');
create type public.tipo_recordatorio as enum ('recordatorio', 'seguimiento');
create type public.estado_recordatorio as enum ('pendiente', 'enviado', 'fallido');
create type public.tipo_diagnostico as enum ('presuntivo', 'definitivo', 'diferencial');
create type public.estado_tratamiento as enum ('pendiente', 'en_proceso', 'completado', 'suspendido', 'anulado');
create type public.estado_factura as enum ('pendiente', 'pagada', 'anulada');
create type public.denticion as enum ('permanente', 'temporal');
create type public.figura_pieza as enum ('cuadrada', 'circular');
create type public.cpo_resultado as (
  cariadas integer,
  perdidas integer,
  obturadas integer,
  total integer
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table public.roles (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique,
  nombre text not null,
  descripcion text,
  activo boolean not null default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table public.permisos (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique,
  modulo text not null,
  accion text not null,
  descripcion text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table public.rol_permisos (
  rol_id uuid not null references public.roles(id) on delete cascade,
  permiso_id uuid not null references public.permisos(id) on delete cascade,
  created_at timestamptz default now(),
  primary key (rol_id, permiso_id)
);

create table public.usuarios (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique references auth.users(id) on delete set null,
  email text not null unique,
  nombres text not null,
  apellidos text not null,
  rol text not null default 'Odontologo',
  telefono text,
  activo boolean not null default true,
  ultimo_acceso timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table public.usuario_roles (
  usuario_id uuid not null references public.usuarios(id) on delete cascade,
  rol_id uuid not null references public.roles(id) on delete restrict,
  created_at timestamptz default now(),
  primary key (usuario_id, rol_id)
);

create or replace function public.current_usuario_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from public.usuarios where auth_user_id = auth.uid() limit 1
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.usuarios u
    left join public.usuario_roles ur on ur.usuario_id = u.id
    left join public.roles r on r.id = ur.rol_id
    where u.auth_user_id = auth.uid()
      and u.activo
      and (lower(u.rol) in ('administrador', 'admin') or lower(r.codigo) in ('administrador', 'admin'))
  )
$$;

create table public.especialidades (
  id uuid primary key default gen_random_uuid(),
  nombre text not null unique,
  descripcion text,
  activa boolean not null default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table public.odontologos (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null unique references public.usuarios(id) on delete cascade,
  numero_registro text,
  firma_url text,
  activo boolean not null default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table public.odontologo_especialidades (
  odontologo_id uuid not null references public.odontologos(id) on delete cascade,
  especialidad_id uuid not null references public.especialidades(id) on delete restrict,
  created_at timestamptz default now(),
  primary key (odontologo_id, especialidad_id)
);

create table public.seguros (
  id uuid primary key default gen_random_uuid(),
  nombre text not null unique,
  ruc text,
  telefono text,
  email text,
  activo boolean not null default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table public.pacientes (
  id uuid primary key default gen_random_uuid(),
  numero_historia text not null unique,
  cedula text not null unique,
  nombres text not null,
  apellidos text not null,
  fecha_nacimiento date,
  sexo public.sexo_paciente not null default 'No especificado',
  telefono text,
  email text,
  direccion text,
  ocupacion text,
  contacto_emergencia text,
  telefono_emergencia text,
  alergias text,
  antecedentes text,
  foto_url text,
  activo boolean not null default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table public.paciente_seguros (
  id uuid primary key default gen_random_uuid(),
  paciente_id uuid not null references public.pacientes(id) on delete cascade,
  seguro_id uuid not null references public.seguros(id) on delete restrict,
  numero_poliza text,
  cobertura text,
  fecha_inicio date,
  fecha_fin date,
  activo boolean not null default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (paciente_id, seguro_id, numero_poliza)
);

create table public.historias_clinicas (
  id uuid primary key default gen_random_uuid(),
  paciente_id uuid not null references public.pacientes(id) on delete cascade,
  usuario_id uuid references public.usuarios(id) on delete set null,
  numero_formulario text,
  fecha_apertura date not null default current_date,
  motivo_consulta text,
  enfermedad_actual text,
  antecedentes_personales jsonb,
  antecedentes_familiares jsonb,
  signos_vitales jsonb,
  examen_estomatognatico jsonb,
  diagnosticos jsonb,
  plan_tratamiento text,
  observaciones text,
  estado public.estado_registro not null default 'activo',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table public.constantes_vitales (
  id uuid primary key default gen_random_uuid(),
  historia_id uuid not null references public.historias_clinicas(id) on delete cascade,
  paciente_id uuid not null references public.pacientes(id) on delete cascade,
  temperatura numeric(4,1),
  pulso integer,
  frecuencia_respiratoria integer,
  presion_sistolica integer,
  presion_diastolica integer,
  registrada_por uuid references public.usuarios(id) on delete set null,
  fecha_registro timestamptz not null default now(),
  observaciones text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  check (temperatura is null or temperatura between 30 and 45),
  check (pulso is null or pulso between 20 and 240),
  check (frecuencia_respiratoria is null or frecuencia_respiratoria between 5 and 80)
);

create table public.examen_estomatognatico_items (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique,
  nombre text not null,
  orden integer not null,
  activo boolean not null default true
);

create table public.examen_estomatognatico (
  id uuid primary key default gen_random_uuid(),
  historia_id uuid not null references public.historias_clinicas(id) on delete cascade,
  item_id uuid not null references public.examen_estomatognatico_items(id) on delete restrict,
  normal boolean not null default true,
  patologico boolean not null default false,
  observaciones text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (historia_id, item_id)
);

create table public.indicadores_salud_bucal (
  id uuid primary key default gen_random_uuid(),
  historia_id uuid not null unique references public.historias_clinicas(id) on delete cascade,
  higiene_placa boolean not null default false,
  higiene_calculo boolean not null default false,
  higiene_gingivitis boolean not null default false,
  periodontal_leve boolean not null default false,
  periodontal_moderada boolean not null default false,
  periodontal_severa boolean not null default false,
  oclusion_clase_i boolean not null default false,
  oclusion_clase_ii boolean not null default false,
  oclusion_clase_iii boolean not null default false,
  fluorosis_leve boolean not null default false,
  fluorosis_moderada boolean not null default false,
  fluorosis_severa boolean not null default false,
  observaciones text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table public.piezas_dentales (
  id uuid primary key default gen_random_uuid(),
  numero integer not null unique,
  denticion public.denticion not null,
  cuadrante integer not null check (cuadrante between 1 and 8),
  posicion integer not null check (posicion between 1 and 8),
  arcada text not null check (arcada in ('superior', 'inferior')),
  lado text not null check (lado in ('derecha', 'izquierda')),
  figura public.figura_pieza not null,
  etiqueta text,
  orden_msp integer not null unique,
  activo boolean not null default true
);

create table public.estados_piezas (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique,
  nombre text not null,
  color text,
  descripcion text,
  activo boolean not null default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table public.odontogramas (
  id uuid primary key default gen_random_uuid(),
  paciente_id uuid not null references public.pacientes(id) on delete cascade,
  historia_id uuid references public.historias_clinicas(id) on delete cascade,
  tipo text not null default 'inicial' check (tipo in ('inicial', 'evolucion')),
  estado public.estado_registro not null default 'activo',
  observaciones text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table public.odontograma_detalles (
  id uuid primary key default gen_random_uuid(),
  odontograma_id uuid not null references public.odontogramas(id) on delete cascade,
  pieza integer not null references public.piezas_dentales(numero) on delete restrict,
  estado_pieza_id uuid references public.estados_piezas(id) on delete restrict,
  superficie text,
  condicion text not null,
  movilidad integer,
  recesion integer,
  notas text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  check (movilidad is null or movilidad between 0 and 3),
  check (recesion is null or recesion between 0 and 9)
);

create unique index ux_odontograma_detalle_estado
on public.odontograma_detalles (odontograma_id, pieza, estado_pieza_id)
where estado_pieza_id is not null;

create table public.odontograma_cpo_manual (
  id uuid primary key default gen_random_uuid(),
  odontograma_id uuid not null unique references public.odontogramas(id) on delete cascade,
  cariadas integer not null default 0,
  perdidas integer not null default 0,
  obturadas integer not null default 0,
  ceo integer not null default 0,
  total integer not null default 0,
  observaciones text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  check (cariadas >= 0 and perdidas >= 0 and obturadas >= 0 and ceo >= 0 and total >= 0)
);

create table public.piezas_examinadas (
  id uuid primary key default gen_random_uuid(),
  historia_id uuid not null references public.historias_clinicas(id) on delete cascade,
  pieza integer not null references public.piezas_dentales(numero) on delete restrict,
  examinada boolean not null default false,
  observaciones text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (historia_id, pieza)
);

create table public.diagnosticos (
  id uuid primary key default gen_random_uuid(),
  historia_id uuid not null references public.historias_clinicas(id) on delete cascade,
  paciente_id uuid not null references public.pacientes(id) on delete cascade,
  codigo_cie text,
  descripcion text not null,
  tipo public.tipo_diagnostico not null default 'definitivo',
  observaciones text,
  activo boolean not null default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table public.tratamientos (
  id uuid primary key default gen_random_uuid(),
  paciente_id uuid not null references public.pacientes(id) on delete cascade,
  historia_id uuid references public.historias_clinicas(id) on delete cascade,
  diagnostico_id uuid references public.diagnosticos(id) on delete set null,
  diagnostico text not null,
  procedimiento text not null,
  prescripcion text,
  fecha date not null default current_date,
  estado public.estado_registro not null default 'pendiente',
  costo numeric(12,2),
  notas text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table public.sesiones_tratamiento (
  id uuid primary key default gen_random_uuid(),
  tratamiento_id uuid not null references public.tratamientos(id) on delete cascade,
  paciente_id uuid not null references public.pacientes(id) on delete cascade,
  historia_id uuid references public.historias_clinicas(id) on delete cascade,
  diagnostico_id uuid references public.diagnosticos(id) on delete set null,
  fecha date not null default current_date,
  procedimiento text not null,
  prescripcion text,
  firma_url text,
  odontologo_id uuid references public.odontologos(id) on delete set null,
  usuario_id uuid references public.usuarios(id) on delete set null,
  estado public.estado_tratamiento not null default 'pendiente',
  observaciones text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table public.medicamentos (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  principio_activo text,
  presentacion text,
  concentracion text,
  activo boolean not null default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (nombre, presentacion, concentracion)
);

create table public.recetas (
  id uuid primary key default gen_random_uuid(),
  paciente_id uuid not null references public.pacientes(id) on delete cascade,
  historia_id uuid references public.historias_clinicas(id) on delete cascade,
  sesion_id uuid references public.sesiones_tratamiento(id) on delete set null,
  odontologo_id uuid references public.odontologos(id) on delete set null,
  fecha date not null default current_date,
  indicaciones_generales text,
  estado public.estado_registro not null default 'activo',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table public.receta_medicamentos (
  id uuid primary key default gen_random_uuid(),
  receta_id uuid not null references public.recetas(id) on delete cascade,
  medicamento_id uuid references public.medicamentos(id) on delete set null,
  medicamento_nombre text not null,
  dosis text not null,
  frecuencia text,
  duracion text,
  via text,
  instrucciones text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table public.citas (
  id uuid primary key default gen_random_uuid(),
  paciente_id uuid not null references public.pacientes(id) on delete cascade,
  usuario_id uuid references public.usuarios(id) on delete set null,
  odontologo_id uuid references public.usuarios(id) on delete set null,
  fecha date not null,
  hora_inicio time not null,
  hora_fin time,
  motivo text not null,
  estado public.estado_cita not null default 'pendiente',
  notas text,
  cita_origen_id uuid references public.citas(id) on delete set null,
  inicio timestamp generated always as (fecha::timestamp + hora_inicio) stored,
  fin timestamp generated always as (fecha::timestamp + coalesce(hora_fin, (hora_inicio + interval '30 minutes')::time)) stored,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  check (hora_fin is null or hora_fin > hora_inicio)
);

alter table public.citas
  add constraint citas_no_solapadas
  exclude using gist (
    coalesce(odontologo_id, usuario_id) with =,
    tsrange(inicio, fin, '[)') with &&
  )
  where (estado in ('pendiente', 'confirmada', 'atendida') and coalesce(odontologo_id, usuario_id) is not null);

create view public.agenda
with (security_invoker = true) as
select id, paciente_id, usuario_id, fecha, hora_inicio, hora_fin, motivo, estado, notas, created_at, updated_at
from public.citas;

create table public.recordatorios_whatsapp (
  id uuid primary key default gen_random_uuid(),
  cita_id uuid not null references public.citas(id) on delete cascade,
  paciente_id uuid not null references public.pacientes(id) on delete cascade,
  usuario_id uuid references public.usuarios(id) on delete set null,
  tipo public.tipo_recordatorio not null default 'recordatorio',
  telefono text,
  mensaje text not null,
  estado public.estado_recordatorio not null default 'enviado',
  enviado_at timestamptz default now(),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table public.examenes (
  id uuid primary key default gen_random_uuid(),
  paciente_id uuid not null references public.pacientes(id) on delete cascade,
  historia_id uuid references public.historias_clinicas(id) on delete cascade,
  tipo text not null,
  nombre text not null,
  descripcion text,
  fecha_examen date default current_date,
  resultado text,
  solicitado_por uuid references public.usuarios(id) on delete set null,
  estado public.estado_registro not null default 'pendiente',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table public.archivos_clinicos (
  id uuid primary key default gen_random_uuid(),
  paciente_id uuid not null references public.pacientes(id) on delete cascade,
  historia_id uuid references public.historias_clinicas(id) on delete cascade,
  examen_id uuid references public.examenes(id) on delete set null,
  tipo public.tipo_documento_clinico not null default 'documento',
  nombre text not null,
  bucket text not null default 'documentos',
  path text not null,
  url text not null,
  mime_type text,
  size bigint,
  usuario_id uuid references public.usuarios(id) on delete set null,
  eliminado boolean not null default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (bucket, path)
);

create view public.documentos_clinicos
with (security_invoker = true) as
select id, paciente_id, historia_id, tipo, nombre, path, url, mime_type, size, created_at, updated_at
from public.archivos_clinicos
where eliminado = false;

create or replace function public.documentos_clinicos_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.archivos_clinicos (
    id, paciente_id, historia_id, tipo, nombre, bucket, path, url, mime_type, size, usuario_id
  )
  values (
    coalesce(new.id, gen_random_uuid()),
    new.paciente_id,
    new.historia_id,
    new.tipo,
    new.nombre,
    case when new.tipo = 'radiografia' then 'radiografias' else 'documentos' end,
    new.path,
    new.url,
    new.mime_type,
    new.size,
    public.current_usuario_id()
  )
  returning id, paciente_id, historia_id, tipo, nombre, path, url, mime_type, size, created_at, updated_at
  into new;
  return new;
end;
$$;

create or replace function public.documentos_clinicos_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.archivos_clinicos set eliminado = true, updated_at = now() where id = old.id;
  return old;
end;
$$;

drop trigger if exists documentos_clinicos_insert_trigger on public.documentos_clinicos;
create trigger documentos_clinicos_insert_trigger
instead of insert on public.documentos_clinicos
for each row execute function public.documentos_clinicos_insert();

drop trigger if exists documentos_clinicos_delete_trigger on public.documentos_clinicos;
create trigger documentos_clinicos_delete_trigger
instead of delete on public.documentos_clinicos
for each row execute function public.documentos_clinicos_delete();

create table public.facturas (
  id uuid primary key default gen_random_uuid(),
  paciente_id uuid not null references public.pacientes(id) on delete restrict,
  numero text not null unique,
  fecha date not null default current_date,
  subtotal numeric(12,2) not null default 0,
  impuesto numeric(12,2) not null default 0,
  descuento numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0,
  estado public.estado_registro not null default 'pendiente',
  observaciones text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table public.factura_items (
  id uuid primary key default gen_random_uuid(),
  factura_id uuid not null references public.facturas(id) on delete cascade,
  descripcion text not null,
  cantidad numeric(12,2) not null default 1,
  precio_unitario numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table public.inventario (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique,
  nombre text not null,
  categoria text,
  stock numeric(12,2) not null default 0,
  stock_minimo numeric(12,2) not null default 0,
  unidad text,
  costo numeric(12,2),
  vencimiento date,
  activo boolean not null default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table public.inventario_movimientos (
  id uuid primary key default gen_random_uuid(),
  inventario_id uuid not null references public.inventario(id) on delete cascade,
  tipo text not null check (tipo in ('entrada', 'salida', 'ajuste')),
  cantidad numeric(12,2) not null,
  motivo text,
  usuario_id uuid references public.usuarios(id) on delete set null,
  created_at timestamptz default now()
);

create table public.configuracion_sistema (
  id uuid primary key default gen_random_uuid(),
  clave text not null unique,
  valor jsonb not null,
  descripcion text,
  editable boolean not null default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table public.auditoria (
  id bigserial primary key,
  tabla text not null,
  operacion text not null,
  registro_id uuid,
  usuario_id uuid,
  auth_user_id uuid,
  datos_anteriores jsonb,
  datos_nuevos jsonb,
  created_at timestamptz not null default now()
);

create or replace function public.registrar_auditoria()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if tg_op = 'DELETE' then
    v_id = old.id;
  else
    v_id = new.id;
  end if;

  insert into public.auditoria(tabla, operacion, registro_id, usuario_id, auth_user_id, datos_anteriores, datos_nuevos)
  values (
    tg_table_name,
    tg_op,
    v_id,
    public.current_usuario_id(),
    auth.uid(),
    case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) else null end,
    case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) else null end
  );

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.usuarios(auth_user_id, email, nombres, apellidos, rol)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'nombres', split_part(coalesce(new.email, ''), '@', 1), 'Usuario'),
    coalesce(new.raw_user_meta_data->>'apellidos', ''),
    coalesce(new.raw_user_meta_data->>'rol', 'Odontologo')
  )
  on conflict (auth_user_id) do update set
    email = excluded.email,
    updated_at = now();
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_auth_user();

insert into public.roles (codigo, nombre, descripcion) values
('admin', 'Administrador', 'Acceso total al sistema'),
('odontologo', 'Odontologo', 'Atencion clinica y agenda'),
('asistente', 'Asistente', 'Gestion operativa de pacientes y agenda'),
('recepcion', 'Recepcion', 'Agenda, pacientes y recordatorios')
on conflict (codigo) do nothing;

insert into public.especialidades (nombre) values
('Odontologia general'),
('Endodoncia'),
('Ortodoncia'),
('Periodoncia'),
('Cirugia oral'),
('Odontopediatria'),
('Rehabilitacion oral')
on conflict (nombre) do nothing;

insert into public.examen_estomatognatico_items (codigo, nombre, orden) values
('labios', 'Labios', 1),
('mejillas', 'Mejillas', 2),
('maxilar_superior', 'Maxilar superior', 3),
('maxilar_inferior', 'Maxilar inferior', 4),
('lengua', 'Lengua', 5),
('paladar', 'Paladar', 6),
('piso_boca', 'Piso de boca', 7),
('carrillos', 'Carrillos', 8),
('glandulas_salivales', 'Glandulas salivales', 9),
('orofaringe', 'Orofaringe', 10),
('atm', 'ATM', 11),
('ganglios', 'Ganglios', 12)
on conflict (codigo) do nothing;

insert into public.estados_piezas (codigo, nombre, color) values
('recesion', 'Recesion', '#8b5cf6'),
('movilidad', 'Movilidad', '#f59e0b'),
('caries', 'Caries', '#ef4444'),
('restauracion', 'Restauracion', '#3b82f6'),
('extraccion_indicada', 'Extraccion indicada', '#111827'),
('corona', 'Corona', '#eab308'),
('puente', 'Puente', '#14b8a6'),
('sellante', 'Sellante', '#22c55e'),
('endodoncia', 'Endodoncia', '#a855f7'),
('implante', 'Implante', '#64748b'),
('fractura', 'Fractura', '#f97316'),
('ausente', 'Ausente', '#6b7280'),
('otros', 'Otros', '#0f766e')
on conflict (codigo) do nothing;

insert into public.piezas_dentales (numero, denticion, cuadrante, posicion, arcada, lado, figura, etiqueta, orden_msp) values
(18,'permanente',1,8,'superior','derecha','cuadrada','18',1),(17,'permanente',1,7,'superior','derecha','cuadrada','17',2),(16,'permanente',1,6,'superior','derecha','cuadrada','16',3),(15,'permanente',1,5,'superior','derecha','cuadrada','15',4),(14,'permanente',1,4,'superior','derecha','cuadrada','14',5),(13,'permanente',1,3,'superior','derecha','cuadrada','13',6),(12,'permanente',1,2,'superior','derecha','cuadrada','12',7),(11,'permanente',1,1,'superior','derecha','cuadrada','11',8),
(21,'permanente',2,1,'superior','izquierda','cuadrada','21',9),(22,'permanente',2,2,'superior','izquierda','cuadrada','22',10),(23,'permanente',2,3,'superior','izquierda','cuadrada','23',11),(24,'permanente',2,4,'superior','izquierda','cuadrada','24',12),(25,'permanente',2,5,'superior','izquierda','cuadrada','25',13),(26,'permanente',2,6,'superior','izquierda','cuadrada','26',14),(27,'permanente',2,7,'superior','izquierda','cuadrada','27',15),(28,'permanente',2,8,'superior','izquierda','cuadrada','28',16),
(48,'permanente',4,8,'inferior','derecha','cuadrada','48',17),(47,'permanente',4,7,'inferior','derecha','cuadrada','47',18),(46,'permanente',4,6,'inferior','derecha','cuadrada','46',19),(45,'permanente',4,5,'inferior','derecha','cuadrada','45',20),(44,'permanente',4,4,'inferior','derecha','cuadrada','44',21),(43,'permanente',4,3,'inferior','derecha','cuadrada','43',22),(42,'permanente',4,2,'inferior','derecha','cuadrada','42',23),(41,'permanente',4,1,'inferior','derecha','cuadrada','41',24),
(31,'permanente',3,1,'inferior','izquierda','cuadrada','31',25),(32,'permanente',3,2,'inferior','izquierda','cuadrada','32',26),(33,'permanente',3,3,'inferior','izquierda','cuadrada','33',27),(34,'permanente',3,4,'inferior','izquierda','cuadrada','34',28),(35,'permanente',3,5,'inferior','izquierda','cuadrada','35',29),(36,'permanente',3,6,'inferior','izquierda','cuadrada','36',30),(37,'permanente',3,7,'inferior','izquierda','cuadrada','37',31),(38,'permanente',3,8,'inferior','izquierda','cuadrada','38',32),
(55,'temporal',5,5,'superior','derecha','circular','55',33),(54,'temporal',5,4,'superior','derecha','circular','54',34),(53,'temporal',5,3,'superior','derecha','circular','53',35),(52,'temporal',5,2,'superior','derecha','circular','52',36),(51,'temporal',5,1,'superior','derecha','circular','51',37),
(61,'temporal',6,1,'superior','izquierda','circular','61',38),(62,'temporal',6,2,'superior','izquierda','circular','62',39),(63,'temporal',6,3,'superior','izquierda','circular','63',40),(64,'temporal',6,4,'superior','izquierda','circular','64',41),(65,'temporal',6,5,'superior','izquierda','circular','65',42),
(85,'temporal',8,5,'inferior','derecha','circular','85',43),(84,'temporal',8,4,'inferior','derecha','circular','84',44),(83,'temporal',8,3,'inferior','derecha','circular','83',45),(82,'temporal',8,2,'inferior','derecha','circular','82',46),(81,'temporal',8,1,'inferior','derecha','circular','81',47),
(71,'temporal',7,1,'inferior','izquierda','circular','71',48),(72,'temporal',7,2,'inferior','izquierda','circular','72',49),(73,'temporal',7,3,'inferior','izquierda','circular','73',50),(74,'temporal',7,4,'inferior','izquierda','circular','74',51),(75,'temporal',7,5,'inferior','izquierda','circular','75',52)
on conflict (numero) do nothing;

insert into public.configuracion_sistema (clave, valor, descripcion) values
('clinica', '{"nombre":"Clinica VitaDenti","pais":"Ecuador","zona_horaria":"America/Guayaquil"}', 'Datos generales de la clinica'),
('agenda', '{"duracion_minutos":30,"recordatorio_minutos":1440}', 'Parametros por defecto de agenda'),
('whatsapp', '{"prefijo_ecuador":"593"}', 'Parametros de mensajes de WhatsApp')
on conflict (clave) do nothing;

create or replace function public.calcular_cpo(paciente_id_param uuid)
returns public.cpo_resultado
language sql
stable
as $$
  with latest as (
    select c.cariadas, c.perdidas, c.obturadas, c.total
    from public.odontogramas o
    left join public.odontograma_cpo_manual c on c.odontograma_id = o.id
    where o.paciente_id = paciente_id_param
    order by o.created_at desc
    limit 1
  )
  select row(
    coalesce(latest.cariadas, 0),
    coalesce(latest.perdidas, 0),
    coalesce(latest.obturadas, 0),
    coalesce(latest.total, 0)
  )::public.cpo_resultado
  from (select 1) seed
  left join latest on true
$$;

create view public.vw_dashboard_resumen
with (security_invoker = true) as
select
  (select count(*)::integer from public.pacientes where activo) as pacientes_activos,
  (select count(*)::integer from public.citas where fecha = current_date and estado in ('pendiente','confirmada','atendida')) as citas_hoy,
  (select count(*)::integer from public.tratamientos where estado in ('pendiente','activo')) as tratamientos_pendientes,
  (select coalesce(sum(total),0)::numeric from public.facturas where date_trunc('month', fecha) = date_trunc('month', current_date) and estado <> 'anulado') as facturacion_mes,
  (select count(*)::integer from public.inventario where activo and stock <= stock_minimo) as inventario_bajo;

create view public.vw_dashboard_citas
with (security_invoker = true) as
select
  c.id,
  concat_ws(' ', p.apellidos, p.nombres) as paciente,
  c.fecha,
  c.hora_inicio,
  c.motivo,
  c.estado::text as estado
from public.citas c
join public.pacientes p on p.id = c.paciente_id
where c.fecha >= current_date
order by c.fecha, c.hora_inicio
limit 20;

create index idx_pacientes_nombre on public.pacientes (apellidos, nombres);
create index idx_historias_paciente on public.historias_clinicas (paciente_id, created_at desc);
create index idx_citas_fecha on public.citas (fecha, hora_inicio);
create index idx_citas_paciente on public.citas (paciente_id, fecha desc);
create index idx_recordatorios_cita on public.recordatorios_whatsapp (cita_id, tipo);
create index idx_archivos_paciente on public.archivos_clinicos (paciente_id, historia_id);
create index idx_odontograma_paciente on public.odontogramas (paciente_id, created_at desc);
create index idx_diagnosticos_historia on public.diagnosticos (historia_id);
create index idx_tratamientos_paciente on public.tratamientos (paciente_id, fecha desc);
create index idx_auditoria_tabla_fecha on public.auditoria (tabla, created_at desc);

do $$
declare
  t text;
begin
  foreach t in array array[
    'roles','permisos','usuarios','especialidades','odontologos','seguros','pacientes','paciente_seguros',
    'historias_clinicas','constantes_vitales','examen_estomatognatico','indicadores_salud_bucal',
    'estados_piezas','odontogramas','odontograma_detalles','odontograma_cpo_manual','piezas_examinadas',
    'diagnosticos','tratamientos','sesiones_tratamiento','medicamentos','recetas','receta_medicamentos',
    'citas','recordatorios_whatsapp','examenes','archivos_clinicos','facturas','factura_items',
    'inventario','configuracion_sistema'
  ] loop
    execute format('drop trigger if exists set_updated_at_%I on public.%I', t, t);
    execute format('create trigger set_updated_at_%I before update on public.%I for each row execute function public.set_updated_at()', t, t);
  end loop;
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array[
    'roles','permisos','usuarios','especialidades','odontologos','seguros','pacientes','paciente_seguros',
    'historias_clinicas','constantes_vitales','examen_estomatognatico','indicadores_salud_bucal',
    'estados_piezas','odontogramas','odontograma_detalles','odontograma_cpo_manual','piezas_examinadas',
    'diagnosticos','tratamientos','sesiones_tratamiento','medicamentos','recetas','receta_medicamentos',
    'citas','recordatorios_whatsapp','examenes','archivos_clinicos','facturas','factura_items',
    'inventario','inventario_movimientos','configuracion_sistema'
  ] loop
    execute format('drop trigger if exists auditar_%I on public.%I', t, t);
    execute format('create trigger auditar_%I after insert or update or delete on public.%I for each row execute function public.registrar_auditoria()', t, t);
  end loop;
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array[
    'roles','permisos','rol_permisos','usuarios','usuario_roles','especialidades','odontologos','odontologo_especialidades',
    'seguros','pacientes','paciente_seguros','historias_clinicas','constantes_vitales','examen_estomatognatico_items',
    'examen_estomatognatico','indicadores_salud_bucal','piezas_dentales','estados_piezas','odontogramas',
    'odontograma_detalles','odontograma_cpo_manual','piezas_examinadas','diagnosticos','tratamientos',
    'sesiones_tratamiento','medicamentos','recetas','receta_medicamentos','citas','recordatorios_whatsapp',
    'examenes','archivos_clinicos','facturas','factura_items','inventario','inventario_movimientos',
    'configuracion_sistema','auditoria'
  ] loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array[
    'roles','permisos','rol_permisos','usuarios','usuario_roles','especialidades','odontologos','odontologo_especialidades',
    'seguros','pacientes','paciente_seguros','historias_clinicas','constantes_vitales','examen_estomatognatico_items',
    'examen_estomatognatico','indicadores_salud_bucal','piezas_dentales','estados_piezas','odontogramas',
    'odontograma_detalles','odontograma_cpo_manual','piezas_examinadas','diagnosticos','tratamientos',
    'sesiones_tratamiento','medicamentos','recetas','receta_medicamentos','citas','recordatorios_whatsapp',
    'examenes','archivos_clinicos','facturas','factura_items','inventario','inventario_movimientos',
    'configuracion_sistema'
  ] loop
    execute format('drop policy if exists "%s_select_authenticated" on public.%I', t, t);
    execute format('create policy "%s_select_authenticated" on public.%I for select to authenticated using (true)', t, t);
    execute format('drop policy if exists "%s_insert_authenticated" on public.%I', t, t);
    execute format('create policy "%s_insert_authenticated" on public.%I for insert to authenticated with check (true)', t, t);
    execute format('drop policy if exists "%s_update_authenticated" on public.%I', t, t);
    execute format('create policy "%s_update_authenticated" on public.%I for update to authenticated using (true) with check (true)', t, t);
    execute format('drop policy if exists "%s_delete_admin" on public.%I', t, t);
    execute format('create policy "%s_delete_admin" on public.%I for delete to authenticated using (public.is_admin())', t, t);
  end loop;

  drop policy if exists "auditoria_select_admin" on public.auditoria;
  create policy "auditoria_select_admin" on public.auditoria for select to authenticated using (public.is_admin());
end;
$$;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
('pacientes', 'pacientes', false, 10485760, array['image/png','image/jpeg','image/webp']),
('radiografias', 'radiografias', false, 52428800, array['image/png','image/jpeg','image/webp','application/pdf']),
('documentos', 'documentos', false, 52428800, array[
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'image/png','image/jpeg','image/webp'
]),
('examenes', 'examenes', false, 52428800, array[
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'image/png','image/jpeg','image/webp'
]),
('firmas', 'firmas', false, 5242880, array['image/png','image/jpeg','image/webp'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "clinical_storage_select" on storage.objects;
create policy "clinical_storage_select"
on storage.objects for select to authenticated
using (bucket_id in ('pacientes','radiografias','documentos','examenes','firmas'));

drop policy if exists "clinical_storage_insert" on storage.objects;
create policy "clinical_storage_insert"
on storage.objects for insert to authenticated
with check (bucket_id in ('pacientes','radiografias','documentos','examenes','firmas'));

drop policy if exists "clinical_storage_update" on storage.objects;
create policy "clinical_storage_update"
on storage.objects for update to authenticated
using (bucket_id in ('pacientes','radiografias','documentos','examenes','firmas'))
with check (bucket_id in ('pacientes','radiografias','documentos','examenes','firmas'));

drop policy if exists "clinical_storage_delete_admin" on storage.objects;
create policy "clinical_storage_delete_admin"
on storage.objects for delete to authenticated
using (bucket_id in ('pacientes','radiografias','documentos','examenes','firmas') and public.is_admin());

grant usage on schema public to anon, authenticated, service_role;
grant select on all tables in schema public to anon;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;
grant execute on all functions in schema public to authenticated;

commit;
