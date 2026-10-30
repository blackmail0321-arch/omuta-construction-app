-- Apply after 001_shared_projects.sql. No existing project is changed or removed.
begin;
create table public.reference_library_admins (
 user_id uuid primary key references auth.users(id) on delete cascade
);
create table public.reference_library (
 id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users(id),
 local_id text not null, title text not null, edition text not null default '',
 project_data jsonb not null, revision bigint not null default 1, updated_at timestamptz not null default now(),
 unique(owner_id,local_id), check(length(title) between 1 and 500), check(jsonb_typeof(project_data)='object')
);
-- Releases contain only the explicitly approved material fields, never the original project JSON.
create table public.reference_releases (
 id uuid primary key default gen_random_uuid(), reference_id uuid not null references public.reference_library(id),
 owner_id uuid not null references auth.users(id), source_revision bigint not null,
 title text not null, edition text not null, summary text not null, materials jsonb not null,
 created_at timestamptz not null default now(), active boolean not null default true
);
create table public.reference_permissions (
 release_id uuid not null references public.reference_releases(id), user_id uuid not null references auth.users(id),
 primary key(release_id,user_id)
);
create table public.reference_usage (
 event_id uuid primary key, user_id uuid not null references auth.users(id),
 release_id uuid not null references public.reference_releases(id), local_project_id text not null,
 action text not null check(action in ('candidate_imported')), created_at timestamptz not null default now()
);
alter table public.reference_library_admins enable row level security;
alter table public.reference_library enable row level security;
alter table public.reference_releases enable row level security;
alter table public.reference_permissions enable row level security;
alter table public.reference_usage enable row level security;
revoke all on public.reference_library_admins,public.reference_library,public.reference_releases,public.reference_permissions,public.reference_usage from public,anon,authenticated;

create function public.reference_is_admin() returns boolean language sql stable security definer set search_path=pg_catalog,public as $$
 select public.shared_access()='editor' and exists(select 1 from public.reference_library_admins where user_id=auth.uid())
$$;
create function public.reference_can_use(p_id uuid) returns boolean language sql stable security definer set search_path=pg_catalog,public as $$
 select public.shared_access()='editor' and exists(select 1 from public.reference_releases r where r.id=p_id and r.active and
 (r.owner_id=auth.uid() or exists(select 1 from public.reference_permissions p where p.release_id=r.id and p.user_id=auth.uid())))
$$;
create function public.reference_list_private() returns table(id uuid,local_id text,title text,edition text,revision bigint,updated_at timestamptz)
language plpgsql stable security definer set search_path=pg_catalog,public as $$
begin
 if not coalesce(public.reference_is_admin(),false) then raise exception '資料管理の権限がありません' using errcode='42501'; end if;
 return query select r.id,r.local_id,r.title,r.edition,r.revision,r.updated_at from public.reference_library r where r.owner_id=auth.uid() order by r.updated_at desc;
end $$;
create function public.reference_get_private(p_id uuid) returns jsonb language plpgsql stable security definer set search_path=pg_catalog,public as $$
declare r public.reference_library%rowtype;
begin
 if not coalesce(public.reference_is_admin(),false) then raise exception '資料管理の権限がありません' using errcode='42501'; end if;
 select * into r from public.reference_library where id=p_id and owner_id=auth.uid();
 if not found then raise exception '資料管理の権限がありません' using errcode='42501'; end if;
 return jsonb_build_object('id',r.id,'revision',r.revision,'project',r.project_data,'edition',r.edition);
end $$;
create function public.reference_save_private(p_local_id text,p_project jsonb,p_edition text,p_expected_revision bigint default null) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public as $$
declare r public.reference_library%rowtype;
begin
 if not coalesce(public.reference_is_admin(),false) then raise exception '資料管理の権限がありません' using errcode='42501'; end if;
 if jsonb_typeof(p_project) is distinct from 'object' or p_project->>'id' is distinct from p_local_id or
 coalesce(length(p_local_id),0) not between 1 and 200 or coalesce(length(btrim(p_project->>'title')),0) not between 1 and 500 or
 jsonb_typeof(p_project->'items') is distinct from 'array' or octet_length(p_project::text)>10000000 or coalesce(length(p_edition),0)>500 then
 raise exception '資料を確認してください' using errcode='22023'; end if;
 if p_expected_revision is null then
  insert into public.reference_library(owner_id,local_id,title,edition,project_data) values(auth.uid(),p_local_id,p_project->>'title',coalesce(p_edition,''),p_project)
  on conflict(owner_id,local_id) do nothing returning * into r;
  if r.id is null then
   select * into r from public.reference_library where owner_id=auth.uid() and local_id=p_local_id;
   if r.project_data is distinct from p_project or r.edition is distinct from coalesce(p_edition,'') then raise exception '資料が変更されています' using errcode='PT409'; end if;
  end if;
 else
  update public.reference_library set title=p_project->>'title',edition=coalesce(p_edition,''),project_data=p_project,revision=revision+1,updated_at=clock_timestamp()
   where owner_id=auth.uid() and local_id=p_local_id and revision=p_expected_revision returning * into r;
  if not found then raise exception '資料が変更されています' using errcode='PT409'; end if;
 end if;
 return jsonb_build_object('id',r.id,'revision',r.revision);
end $$;
create function public.reference_publish(p_id uuid,p_revision bigint,p_summary text,p_material_ids jsonb) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public as $$
declare r public.reference_library%rowtype;safe jsonb;rid uuid;
begin
 if not coalesce(public.reference_is_admin(),false) then raise exception '資料管理の権限がありません' using errcode='42501'; end if;
 select * into r from public.reference_library where id=p_id and owner_id=auth.uid() for update;
 if not found then raise exception '資料管理の権限がありません' using errcode='42501'; end if;
 if p_revision is distinct from r.revision then raise exception '資料が変更されています' using errcode='PT409'; end if;
 if jsonb_typeof(p_material_ids) is distinct from 'array' or jsonb_array_length(p_material_ids) not between 1 and 500 or coalesce(length(p_summary),0)>2000 then raise exception '提案する明細を選んでください' using errcode='22023'; end if;
 select jsonb_agg(jsonb_build_object('id',m->>'id','name',m->>'name','spec',coalesce(m->>'spec',''),'quantity',m->'quantity',
 'unit',m->>'unit','unitPrice',case when m->>'mode'='compose' then 'null'::jsonb else m->'unitPrice' end)) into safe from jsonb_array_elements(r.project_data->'items') m
 where p_material_ids ? (m->>'id');
 if safe is null or jsonb_array_length(safe)<>(select count(distinct value) from jsonb_array_elements_text(p_material_ids)) then raise exception '提案する明細を確認してください' using errcode='22023'; end if;
 insert into public.reference_releases(reference_id,owner_id,source_revision,title,edition,summary,materials)
 values(r.id,auth.uid(),r.revision,r.title,r.edition,coalesce(p_summary,''),safe) returning id into rid;
 return jsonb_build_object('id',rid,'source_revision',r.revision);
end $$;
create function public.reference_set_recipient(p_id uuid,p_email text,p_enabled boolean) returns void
language plpgsql security definer set search_path=pg_catalog,public as $$
declare target uuid;
begin
 if not coalesce(public.reference_is_admin(),false) or not exists(select 1 from public.reference_releases where id=p_id and owner_id=auth.uid()) then raise exception '資料管理の権限がありません' using errcode='42501'; end if;
 select u.id into target from auth.users u join public.shared_accounts a on a.user_id=u.id where lower(u.email)=lower(btrim(p_email)) and a.access='editor';
 if target is null or p_enabled is null then raise exception '登録済みの編集利用者を指定してください' using errcode='22023'; end if;
 if p_enabled then insert into public.reference_permissions values(p_id,target) on conflict do nothing;
 else delete from public.reference_permissions where release_id=p_id and user_id=target; end if;
end $$;
create function public.reference_disable_release(p_id uuid) returns void language plpgsql security definer set search_path=pg_catalog,public as $$
begin
 if not coalesce(public.reference_is_admin(),false) then raise exception '資料管理の権限がありません' using errcode='42501'; end if;
 update public.reference_releases set active=false where id=p_id and owner_id=auth.uid();
 if not found then raise exception '資料管理の権限がありません' using errcode='42501'; end if;
end $$;
create function public.reference_list_releases() returns table(id uuid,title text,edition text,summary text,source_revision bigint,created_at timestamptz,can_manage boolean)
language sql stable security definer set search_path=pg_catalog,public as $$
 select r.id,r.title,r.edition,r.summary,r.source_revision,r.created_at,(r.owner_id=auth.uid() and coalesce(public.reference_is_admin(),false)) from public.reference_releases r where coalesce(public.reference_can_use(r.id),false) order by r.created_at desc
$$;
create function public.reference_search(p_query text default '') returns table(id uuid,title text,edition text,summary text,source_revision bigint,material_count integer)
language sql stable security definer set search_path=pg_catalog,public as $$
 select r.id,r.title,r.edition,r.summary,r.source_revision,jsonb_array_length(r.materials) from public.reference_releases r
 where coalesce(public.reference_can_use(r.id),false) and (coalesce(btrim(p_query),'')='' or strpos(lower(r.title||' '||r.summary||' '||r.materials::text),lower(left(btrim(p_query),200)))>0) order by r.created_at desc limit 30
$$;
create function public.reference_get_suggestion(p_id uuid) returns jsonb language plpgsql stable security definer set search_path=pg_catalog,public as $$
declare r public.reference_releases%rowtype;
begin
 if not coalesce(public.reference_can_use(p_id),false) then raise exception '資料の利用権限がありません' using errcode='42501'; end if;
 select * into strict r from public.reference_releases where id=p_id;
 return jsonb_build_object('id',r.id,'title',r.title,'edition',r.edition,'summary',r.summary,'source_revision',r.source_revision,'materials',r.materials);
end $$;
create function public.reference_check_archive(p_local_id text) returns void language plpgsql stable security definer set search_path=pg_catalog,public as $$
begin
 if not coalesce(public.reference_is_admin(),false) then raise exception '資料管理の権限がありません' using errcode='42501'; end if;
 if exists(select 1 from public.shared_projects p where p.local_id=p_local_id and public.shared_can_read(p.id) and
 (p.owner_id<>auth.uid() or exists(select 1 from public.shared_memberships m where m.project_id=p.id))) then
 raise exception '共有中の工事です。所有者が既存の共有権限を確認・解除してから保管してください' using errcode='22023'; end if;
end $$;
create function public.reference_record_usage(p_event_id uuid,p_id uuid,p_local_project_id text) returns void language plpgsql security definer set search_path=pg_catalog,public as $$
begin
 if not coalesce(public.reference_can_use(p_id),false) then raise exception '資料の利用権限がありません' using errcode='42501'; end if;
 if coalesce(length(p_local_project_id),0) not between 1 and 200 then raise exception '工事を確認してください' using errcode='22023'; end if;
 insert into public.reference_usage(event_id,user_id,release_id,local_project_id,action) values(p_event_id,auth.uid(),p_id,p_local_project_id,'candidate_imported') on conflict do nothing;
 if not exists(select 1 from public.reference_usage where event_id=p_event_id and user_id=auth.uid() and release_id=p_id and local_project_id=p_local_project_id) then raise exception '利用記録を確認してください' using errcode='22023'; end if;
end $$;
create function public.reference_list_usage() returns table(event_id uuid,release_id uuid,local_project_id text,action text,created_at timestamptz)
language sql stable security definer set search_path=pg_catalog,public as $$
 select u.event_id,u.release_id,u.local_project_id,u.action,u.created_at from public.reference_usage u where u.user_id=auth.uid() order by u.created_at desc limit 200
$$;
-- No direct table API grants. Every RPC checks the authenticated actor server-side.
revoke all on function public.reference_is_admin(),public.reference_can_use(uuid),public.reference_list_private(),public.reference_get_private(uuid),
 public.reference_save_private(text,jsonb,text,bigint),public.reference_publish(uuid,bigint,text,jsonb),public.reference_set_recipient(uuid,text,boolean),
 public.reference_disable_release(uuid),public.reference_list_releases(),public.reference_search(text),public.reference_get_suggestion(uuid),
 public.reference_check_archive(text),public.reference_record_usage(uuid,uuid,text),public.reference_list_usage() from public,anon,authenticated;
grant execute on function public.reference_is_admin(),public.reference_list_private(),public.reference_get_private(uuid),
 public.reference_save_private(text,jsonb,text,bigint),public.reference_publish(uuid,bigint,text,jsonb),public.reference_set_recipient(uuid,text,boolean),
 public.reference_disable_release(uuid),public.reference_list_releases(),public.reference_search(text),public.reference_get_suggestion(uuid),
 public.reference_check_archive(text),public.reference_record_usage(uuid,uuid,text),public.reference_list_usage() to authenticated;
commit;
