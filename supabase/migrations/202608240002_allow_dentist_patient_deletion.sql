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
    where u.auth_user_id = auth.uid()
      and u.activo
      and (
        lower(translate(coalesce(u.rol, ''), 'óÓ', 'oO')) in ('administrador', 'admin', 'odontologo')
        or lower(translate(coalesce(r.codigo, ''), 'óÓ', 'oO')) in ('administrador', 'admin', 'odontologo')
      )
  ) then
    raise exception 'Solo un administrador o un odontólogo activo puede eliminar pacientes.'
      using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.pacientes
    where id = paciente_id_param
  ) then
    raise exception 'El paciente no existe.' using errcode = 'P0002';
  end if;

  -- Esta es la única relación directa con ON DELETE RESTRICT.
  -- Los items de cada factura se eliminan por ON DELETE CASCADE.
  delete from public.facturas
  where paciente_id = paciente_id_param;

  -- Las demás relaciones clínicas se eliminan mediante sus ON DELETE CASCADE.
  delete from public.pacientes
  where id = paciente_id_param;
end;
$$;

revoke all on function public.eliminar_paciente_completo(uuid) from public;
grant execute on function public.eliminar_paciente_completo(uuid) to authenticated;

notify pgrst, 'reload schema';
