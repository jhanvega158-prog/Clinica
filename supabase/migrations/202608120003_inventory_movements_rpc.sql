begin;

create or replace function public.registrar_movimiento_inventario(
  inventario_id_param uuid,
  tipo_param text,
  cantidad_param numeric,
  motivo_param text
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  producto public.inventario%rowtype;
  nuevo_stock numeric(12,2);
begin
  if tipo_param not in ('entrada', 'salida', 'ajuste') then
    raise exception using errcode = '23514', message = 'El tipo de movimiento no es válido.';
  end if;
  if cantidad_param is null or cantidad_param < 0 or trunc(cantidad_param) <> cantidad_param then
    raise exception using errcode = '23514', message = 'La cantidad debe ser un entero mayor o igual a cero.';
  end if;
  if tipo_param <> 'ajuste' and cantidad_param = 0 then
    raise exception using errcode = '23514', message = 'La cantidad debe ser mayor que cero.';
  end if;
  if motivo_param is null or btrim(motivo_param) = '' then
    raise exception using errcode = '23514', message = 'El motivo es obligatorio.';
  end if;

  select * into producto from public.inventario where id = inventario_id_param for update;
  if not found then raise exception using errcode = 'P0002', message = 'El producto no existe.'; end if;
  if not producto.activo then raise exception using errcode = '23514', message = 'No se pueden registrar movimientos en un producto inactivo.'; end if;

  nuevo_stock := case tipo_param
    when 'entrada' then producto.stock + cantidad_param
    when 'salida' then producto.stock - cantidad_param
    else cantidad_param
  end;
  if nuevo_stock < 0 then
    raise exception using errcode = '23514', message = 'La salida no puede superar el stock disponible.';
  end if;

  update public.inventario set stock = nuevo_stock, updated_at = now() where id = inventario_id_param;
  insert into public.inventario_movimientos(inventario_id, tipo, cantidad, motivo, usuario_id)
  values (inventario_id_param, tipo_param, cantidad_param, btrim(motivo_param), public.current_usuario_id());
end;
$$;

grant execute on function public.registrar_movimiento_inventario(uuid,text,numeric,text) to authenticated;
commit;
