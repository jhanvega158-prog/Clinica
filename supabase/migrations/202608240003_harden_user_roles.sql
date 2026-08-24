create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  requested_role text;
begin
  requested_role := lower(translate(coalesce(new.raw_user_meta_data->>'rol', 'Usuario'), 'óÓ', 'oO'));
  insert into public.usuarios(auth_user_id, email, nombres, apellidos, rol, activo)
  values (
    new.id, new.email,
    coalesce(nullif(new.raw_user_meta_data->>'nombres', ''), split_part(coalesce(new.email, ''), '@', 1), 'Usuario'),
    coalesce(new.raw_user_meta_data->>'apellidos', ''),
    case when requested_role in ('odontologo', 'dentist') then 'Odontologo' else 'Usuario' end,
    true
  )
  on conflict (auth_user_id) do update set
    email = excluded.email, nombres = excluded.nombres, apellidos = excluded.apellidos,
    rol = excluded.rol, activo = true, updated_at = now();
  return new;
end;
$$;

drop function if exists public.eliminar_paciente_completo(uuid);
create function public.eliminar_paciente_completo(paciente_id_param uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1
    from public.usuarios u
    left join public.usuario_roles ur on ur.usuario_id = u.id
    left join public.roles r on r.id = ur.rol_id
    where u.auth_user_id = auth.uid() and u.activo
      and (
        lower(translate(coalesce(u.rol, ''), 'óÓ', 'oO')) in ('administrador', 'admin')
        or lower(translate(coalesce(r.codigo, ''), 'óÓ', 'oO')) in ('administrador', 'admin')
        or (
          (
            lower(translate(coalesce(u.rol, ''), 'óÓ', 'oO')) in ('odontologo', 'dentist')
            or lower(translate(coalesce(r.codigo, ''), 'óÓ', 'oO')) in ('odontologo', 'dentist')
          )
          and exists (select 1 from public.odontologos o where o.usuario_id = u.id and o.activo)
        )
      )
  ) then
    raise exception 'Solo un administrador o un odontólogo activo puede eliminar pacientes.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.pacientes where id = paciente_id_param) then
    raise exception 'El paciente no existe.' using errcode = 'P0002';
  end if;
  delete from public.facturas where paciente_id = paciente_id_param;
  delete from public.pacientes where id = paciente_id_param;
end;
$$;
revoke all on function public.eliminar_paciente_completo(uuid) from public;
grant execute on function public.eliminar_paciente_completo(uuid) to authenticated;
notify pgrst, 'reload schema';
