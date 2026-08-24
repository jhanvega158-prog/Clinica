alter table public.facturas
  add column if not exists iva_porcentaje numeric(5,2);

update public.facturas
set iva_porcentaje = case
  when greatest(subtotal - descuento, 0) > 0
    then round(impuesto / greatest(subtotal - descuento, 0) * 100, 2)
  else 0
end
where iva_porcentaje is null;

alter table public.facturas
  alter column iva_porcentaje set default 0,
  alter column iva_porcentaje set not null;

alter table public.facturas
  drop constraint if exists facturas_iva_porcentaje_valido;

alter table public.facturas
  add constraint facturas_iva_porcentaje_valido
  check (iva_porcentaje between 0 and 100);

create or replace function public.recalcular_factura()
returns trigger language plpgsql set search_path = public as $$
declare target_id uuid;
begin
  target_id := coalesce(new.factura_id, old.factura_id);
  update public.facturas f set
    subtotal = x.subtotal,
    descuento = x.descuento,
    impuesto = round(greatest(x.subtotal - x.descuento, 0) * f.iva_porcentaje / 100, 2),
    total = round(
      greatest(x.subtotal - x.descuento, 0)
      + greatest(x.subtotal - x.descuento, 0) * f.iva_porcentaje / 100,
      2
    ),
    updated_at = now()
  from (select coalesce(sum(cantidad * precio_unitario), 0)::numeric(12,2) subtotal,
               coalesce(sum(descuento), 0)::numeric(12,2) descuento
        from public.factura_items where factura_id = target_id) x
  where f.id = target_id;
  return coalesce(new, old);
end $$;
