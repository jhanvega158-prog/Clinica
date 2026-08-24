-- VitaDenti authenticated access for patient photos and clinical files.
begin;

-- Backfill a public profile when an Auth user was created before the trigger.
insert into public.usuarios (auth_user_id, email, nombres, apellidos, rol, activo)
select u.id, u.email,
       coalesce(nullif(u.raw_user_meta_data->>'nombres', ''), split_part(u.email, '@', 1)),
       coalesce(u.raw_user_meta_data->>'apellidos', ''),
       coalesce(nullif(u.raw_user_meta_data->>'rol', ''), 'Odontologo'), true
from auth.users u
where u.email is not null
on conflict (email) do update set
  auth_user_id = excluded.auth_user_id,
  activo = true,
  updated_at = now();

alter table public.pacientes enable row level security;
alter table public.archivos_clinicos enable row level security;

drop policy if exists "pacientes_select_authenticated" on public.pacientes;
drop policy if exists "pacientes_insert_authenticated" on public.pacientes;
drop policy if exists "pacientes_update_authenticated" on public.pacientes;
create policy "pacientes_select_authenticated" on public.pacientes for select to authenticated using (true);
create policy "pacientes_insert_authenticated" on public.pacientes for insert to authenticated with check (true);
create policy "pacientes_update_authenticated" on public.pacientes for update to authenticated using (true) with check (true);

drop policy if exists "archivos_clinicos_select_authenticated" on public.archivos_clinicos;
drop policy if exists "archivos_clinicos_insert_authenticated" on public.archivos_clinicos;
drop policy if exists "archivos_clinicos_update_authenticated" on public.archivos_clinicos;
create policy "archivos_clinicos_select_authenticated" on public.archivos_clinicos for select to authenticated using (true);
create policy "archivos_clinicos_insert_authenticated" on public.archivos_clinicos for insert to authenticated with check (true);
create policy "archivos_clinicos_update_authenticated" on public.archivos_clinicos for update to authenticated using (true) with check (true);

grant select, insert, update on public.pacientes to authenticated;
grant select, insert, update on public.archivos_clinicos to authenticated;
grant select on public.documentos_clinicos to authenticated;
revoke insert, update, delete on public.pacientes from anon;
revoke insert, update, delete on public.archivos_clinicos from anon;

update storage.buckets set public = false
where id in ('pacientes', 'radiografias', 'documentos');

drop policy if exists "vitadenti_dev_storage_select" on storage.objects;
drop policy if exists "vitadenti_dev_storage_insert" on storage.objects;
drop policy if exists "vitadenti_dev_storage_update" on storage.objects;
drop policy if exists "vitadenti_dev_storage_delete" on storage.objects;
drop policy if exists "clinical_storage_select" on storage.objects;
drop policy if exists "clinical_storage_insert" on storage.objects;
drop policy if exists "clinical_storage_update" on storage.objects;
drop policy if exists "clinical_storage_delete_admin" on storage.objects;

create policy "clinical_storage_select" on storage.objects
for select to authenticated
using (bucket_id in ('pacientes', 'radiografias', 'documentos'));

create policy "clinical_storage_insert" on storage.objects
for insert to authenticated
with check (bucket_id in ('pacientes', 'radiografias', 'documentos'));

create policy "clinical_storage_update" on storage.objects
for update to authenticated
using (bucket_id in ('pacientes', 'radiografias', 'documentos'))
with check (bucket_id in ('pacientes', 'radiografias', 'documentos'));

create policy "clinical_storage_delete" on storage.objects
for delete to authenticated
using (bucket_id in ('pacientes', 'radiografias', 'documentos'));

commit;
