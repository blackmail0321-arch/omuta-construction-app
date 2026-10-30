-- Supabase Storage migration. Apply after 002. Bucket is private; no public URLs.
begin;
insert into storage.buckets(id,name,public,file_size_limit) values('omuta-reference-originals','omuta-reference-originals',false,30000000)
 on conflict(id) do update set public=false,file_size_limit=30000000;
create table public.reference_files (
 reference_id uuid not null references public.reference_library(id),file_id text not null,
 name text not null,byte_size bigint not null check(byte_size between 0 and 30000000),
 sha256 text not null check(sha256 ~ '^[a-f0-9]{64}$'),created_at timestamptz not null default now(),
 primary key(reference_id,file_id)
);
alter table public.reference_files enable row level security;
revoke all on public.reference_files from public,anon,authenticated;
create function public.reference_can_access_file(p_path text) returns boolean language sql stable security definer set search_path=pg_catalog,public as $$
 select coalesce(public.reference_is_admin(),false) and split_part(p_path,'/',1)=auth.uid()::text and
 p_path ~ '^[a-f0-9-]+/[a-f0-9-]+/[a-f0-9]{64}$' and exists(select 1 from public.reference_library r where r.id::text=split_part(p_path,'/',2) and r.owner_id=auth.uid())
$$;
create policy reference_original_read on storage.objects for select to authenticated using(bucket_id='omuta-reference-originals' and public.reference_can_access_file(name));
create policy reference_original_insert on storage.objects for insert to authenticated with check(bucket_id='omuta-reference-originals' and public.reference_can_access_file(name));
-- Restrictive guards also constrain broad permissive policies that may already exist.
create policy reference_original_owner_guard on storage.objects as restrictive for all to authenticated
 using(bucket_id<>'omuta-reference-originals' or public.reference_can_access_file(name))
 with check(bucket_id<>'omuta-reference-originals' or public.reference_can_access_file(name));
create policy reference_original_anon_guard on storage.objects as restrictive for all to anon
 using(bucket_id<>'omuta-reference-originals') with check(bucket_id<>'omuta-reference-originals');
create policy reference_original_no_update on storage.objects as restrictive for update to authenticated
 using(bucket_id<>'omuta-reference-originals') with check(bucket_id<>'omuta-reference-originals');
create policy reference_original_no_delete on storage.objects as restrictive for delete to authenticated
 using(bucket_id<>'omuta-reference-originals');
-- Originals remain immutable and are retained.
create function public.reference_record_file(p_id uuid,p_file_id text,p_name text,p_size bigint,p_sha256 text) returns void language plpgsql security definer set search_path=pg_catalog,public as $$
begin
 if not coalesce(public.reference_is_admin(),false) or not exists(select 1 from public.reference_library where id=p_id and owner_id=auth.uid()) then raise exception '原本の管理権限がありません' using errcode='42501'; end if;
 if coalesce(length(p_file_id),0) not between 1 and 500 or coalesce(length(p_name),0) not between 1 and 500 or p_size is null or p_size not between 0 and 30000000 or p_sha256 is null or p_sha256 !~ '^[a-f0-9]{64}$' then raise exception '原本ファイルを確認してください' using errcode='22023'; end if;
 if not exists(select 1 from storage.objects where bucket_id='omuta-reference-originals' and name=auth.uid()::text||'/'||p_id::text||'/'||p_sha256) then raise exception '原本ファイルの保存を確認してください' using errcode='22023'; end if;
 insert into public.reference_files(reference_id,file_id,name,byte_size,sha256) values(p_id,p_file_id,p_name,p_size,p_sha256) on conflict do nothing;
 if not exists(select 1 from public.reference_files where reference_id=p_id and file_id=p_file_id and name=p_name and byte_size=p_size and sha256=p_sha256) then raise exception '原本の内容が異なります' using errcode='PT409'; end if;
end $$;
create function public.reference_list_files(p_id uuid) returns table(file_id text,name text,byte_size bigint,sha256 text,created_at timestamptz)
language plpgsql stable security definer set search_path=pg_catalog,public as $$
begin
 if not coalesce(public.reference_is_admin(),false) or not exists(select 1 from public.reference_library where id=p_id and owner_id=auth.uid()) then raise exception '原本の管理権限がありません' using errcode='42501'; end if;
 return query select f.file_id,f.name,f.byte_size,f.sha256,f.created_at from public.reference_files f where f.reference_id=p_id order by f.created_at;
end $$;
revoke all on function public.reference_can_access_file(text),public.reference_record_file(uuid,text,text,bigint,text),public.reference_list_files(uuid) from public,anon,authenticated;
grant execute on function public.reference_can_access_file(text),public.reference_record_file(uuid,text,text,bigint,text),public.reference_list_files(uuid) to authenticated;
commit;
