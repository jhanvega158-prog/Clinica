drop function if exists public.eliminar_paciente_completo(uuid);

create function public.eliminar_paciente_completo(paciente_id_param uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Solo un administrador puede eliminar pacientes.' using errcode = '42501';
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
