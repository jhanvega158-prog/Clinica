-- VitaDenti: server-side validation and relational/financial integrity hardening.
create extension if not exists btree_gist;

alter table public.pacientes
  add constraint pacientes_cedula_formato check (cedula ~ '^[0-9]{10}$') not valid,
  add constraint pacientes_nombres_validos check (btrim(nombres) ~ '^[[:alpha:]ÁÉÍÓÚÜÑáéíóúüñ]+([ -][[:alpha:]ÁÉÍÓÚÜÑáéíóúüñ]+)*$' and char_length(btrim(nombres)) between 2 and 80) not valid,
  add constraint pacientes_apellidos_validos check (btrim(apellidos) ~ '^[[:alpha:]ÁÉÍÓÚÜÑáéíóúüñ]+([ -][[:alpha:]ÁÉÍÓÚÜÑáéíóúüñ]+)*$' and char_length(btrim(apellidos)) between 2 and 80) not valid,
  add constraint pacientes_telefono_valido check (telefono is null or telefono ~ '^(09[0-9]{8}|[0-9]{7,9})$') not valid,
  add constraint pacientes_email_valido check (email is null or email ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]{2,}$') not valid,
  add constraint pacientes_direccion_valida check (direccion is null or char_length(btrim(direccion)) between 5 and 160) not valid;

create unique index if not exists ux_pacientes_email_normalizado
  on public.pacientes (lower(btrim(email))) where email is not null;

update public.historias_clinicas
set motivo_consulta = 'Sin motivo registrado (dato legado)'
where motivo_consulta is null or btrim(motivo_consulta) = '';

alter table public.historias_clinicas
  alter column motivo_consulta set not null,
  add constraint historias_motivo_no_vacio check (char_length(btrim(motivo_consulta)) between 2 and 500) not valid;

alter table public.tratamientos
  add constraint tratamientos_diagnostico_no_vacio check (char_length(btrim(diagnostico)) between 2 and 400) not valid,
  add constraint tratamientos_procedimiento_no_vacio check (char_length(btrim(procedimiento)) between 2 and 600) not valid,
  add constraint tratamientos_costo_valido check (costo is null or costo >= 0) not valid;

alter table public.facturas
  add constraint facturas_importes_validos check (subtotal >= 0 and impuesto >= 0 and descuento >= 0 and descuento <= subtotal and total >= 0) not valid;

alter table public.factura_items
  add column if not exists tratamiento_id uuid references public.tratamientos(id) on delete set null,
  add column if not exists descuento numeric(12,2) not null default 0,
  add constraint factura_items_descripcion_no_vacia check (char_length(btrim(descripcion)) between 2 and 180) not valid,
  add constraint factura_items_cantidad_positiva check (cantidad > 0) not valid,
  add constraint factura_items_precio_valido check (precio_unitario >= 0) not valid,
  add constraint factura_items_descuento_valido check (descuento >= 0 and descuento <= round(cantidad * precio_unitario, 2)) not valid,
  add constraint factura_items_total_valido check (total = round(cantidad * precio_unitario - descuento, 2) and total >= 0) not valid;

create or replace view public.detalle_facturas
with (security_invoker = true) as
select id, factura_id, tratamiento_id, descripcion, cantidad, precio_unitario, descuento,
       total, created_at, updated_at
from public.factura_items;

create or replace function public.normalizar_datos_vitadenti()
returns trigger language plpgsql set search_path = public as $$
begin
  if tg_table_name = 'pacientes' then
    new.numero_historia := btrim(new.numero_historia);
    new.cedula := btrim(new.cedula);
    new.nombres := regexp_replace(btrim(new.nombres), '\s+', ' ', 'g');
    new.apellidos := regexp_replace(btrim(new.apellidos), '\s+', ' ', 'g');
    new.email := nullif(lower(btrim(new.email)), '');
    new.telefono := nullif(btrim(new.telefono), '');
    new.direccion := nullif(regexp_replace(btrim(new.direccion), '\s+', ' ', 'g'), '');
    if new.fecha_nacimiento is not null and (new.fecha_nacimiento >= current_date or new.fecha_nacimiento < current_date - interval '120 years') then
      raise exception using errcode = '23514', message = 'La fecha de nacimiento no es válida.';
    end if;
  elsif tg_table_name = 'tratamientos' then
    new.diagnostico := regexp_replace(btrim(new.diagnostico), '\s+', ' ', 'g');
    new.procedimiento := regexp_replace(btrim(new.procedimiento), '\s+', ' ', 'g');
    if new.fecha > current_date then
      raise exception using errcode = '23514', message = 'La fecha del tratamiento no puede ser futura.';
    end if;
  elsif tg_table_name = 'historias_clinicas' then
    new.motivo_consulta := regexp_replace(btrim(new.motivo_consulta), '\s+', ' ', 'g');
    if new.fecha_apertura > current_date then
      raise exception using errcode = '23514', message = 'La fecha de apertura no puede ser futura.';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists pacientes_normalizar on public.pacientes;
create trigger pacientes_normalizar before insert or update on public.pacientes
for each row execute function public.normalizar_datos_vitadenti();
drop trigger if exists tratamientos_normalizar on public.tratamientos;
create trigger tratamientos_normalizar before insert or update on public.tratamientos
for each row execute function public.normalizar_datos_vitadenti();
drop trigger if exists historias_normalizar on public.historias_clinicas;
create trigger historias_normalizar before insert or update on public.historias_clinicas
for each row execute function public.normalizar_datos_vitadenti();

create or replace function public.validar_relacion_clinica()
returns trigger language plpgsql set search_path = public as $$
declare related_patient uuid;
begin
  if new.historia_id is not null then
    select paciente_id into related_patient from public.historias_clinicas where id = new.historia_id;
    if related_patient is null or related_patient <> new.paciente_id then
      raise exception using errcode = '23514', message = 'La historia clínica no corresponde al paciente indicado.';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists odontogramas_relacion_clinica on public.odontogramas;
create trigger odontogramas_relacion_clinica before insert or update on public.odontogramas
for each row execute function public.validar_relacion_clinica();
drop trigger if exists tratamientos_relacion_clinica on public.tratamientos;
create trigger tratamientos_relacion_clinica before insert or update on public.tratamientos
for each row execute function public.validar_relacion_clinica();

create or replace function public.validar_cita_profesional()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.usuario_id is null then
    raise exception using errcode = '23514', message = 'La cita debe tener un odontólogo asignado.';
  end if;
  if new.fecha < current_date and new.estado in ('pendiente','confirmada','reagendada') then
    raise exception using errcode = '23514', message = 'No se pueden programar citas en fechas pasadas.';
  end if;
  if not exists (
    select 1 from public.usuarios u
    left join public.odontologos o on o.usuario_id = u.id
    where u.id = new.usuario_id and u.activo and coalesce(o.activo, true)
  ) then
    raise exception using errcode = '23514', message = 'El odontólogo no existe o está inactivo.';
  end if;
  return new;
end $$;

drop trigger if exists citas_validar_profesional on public.citas;
create trigger citas_validar_profesional before insert or update on public.citas
for each row execute function public.validar_cita_profesional();

create or replace function public.calcular_item_factura()
returns trigger language plpgsql set search_path = public as $$
begin
  new.descripcion := regexp_replace(btrim(new.descripcion), '\s+', ' ', 'g');
  new.cantidad := round(new.cantidad, 2);
  new.precio_unitario := round(new.precio_unitario, 2);
  new.descuento := round(new.descuento, 2);
  new.total := round(new.cantidad * new.precio_unitario - new.descuento, 2);
  return new;
end $$;

create or replace function public.recalcular_factura()
returns trigger language plpgsql set search_path = public as $$
declare target_id uuid;
begin
  target_id := coalesce(new.factura_id, old.factura_id);
  update public.facturas f set
    subtotal = x.subtotal,
    descuento = x.descuento,
    impuesto = round(greatest(x.subtotal - x.descuento, 0) * 0.15, 2),
    total = round(greatest(x.subtotal - x.descuento, 0) * 1.15, 2),
    updated_at = now()
  from (select coalesce(sum(cantidad * precio_unitario), 0)::numeric(12,2) subtotal,
               coalesce(sum(descuento), 0)::numeric(12,2) descuento
        from public.factura_items where factura_id = target_id) x
  where f.id = target_id;
  return coalesce(new, old);
end $$;

drop trigger if exists factura_items_calcular on public.factura_items;
create trigger factura_items_calcular before insert or update on public.factura_items
for each row execute function public.calcular_item_factura();
drop trigger if exists factura_items_recalcular on public.factura_items;
create trigger factura_items_recalcular after insert or update or delete on public.factura_items
for each row execute function public.recalcular_factura();

create index if not exists ix_pacientes_busqueda on public.pacientes (lower(apellidos), lower(nombres));
create index if not exists ix_historias_paciente_fecha on public.historias_clinicas (paciente_id, fecha_apertura desc);
create index if not exists ix_citas_profesional_fecha on public.citas (usuario_id, fecha, hora_inicio);
create index if not exists ix_facturas_paciente_fecha on public.facturas (paciente_id, fecha desc);

grant select, insert, update, delete on public.detalle_facturas to authenticated;
