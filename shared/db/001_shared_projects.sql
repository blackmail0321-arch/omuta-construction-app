-- Apply in the Supabase SQL editor. No public signup or anonymous data access is granted.
begin;
create table public.shared_accounts (
 user_id uuid primary key references auth.users(id) on delete cascade,
 access text not null check (access in ('editor','viewer'))
);
create table public.shared_projects (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null references auth.users(id),
 local_id text not null check(length(local_id) between 1 and 200),
 title text not null check(length(title) between 1 and 500),
 project_data jsonb not null check(jsonb_typeof(project_data)='object'),
 revision bigint not null default 1,
 updated_at timestamptz not null default now(),
 unique(owner_id,local_id)
);
create table public.shared_memberships (
 project_id uuid references public.shared_projects(id) on delete cascade,
 user_id uuid references auth.users(id) on delete cascade,
 access text not null check(access in ('editor','viewer')),
 primary key(project_id,user_id)
);
create table public.shared_submission_master (
 no integer primary key, name text not null, phase text not null,
 rule text not null, condition text not null, due_text text not null
);
create index on public.shared_memberships(user_id);
alter table public.shared_accounts enable row level security;
alter table public.shared_projects enable row level security;
alter table public.shared_memberships enable row level security;
alter table public.shared_submission_master enable row level security;

create function public.shared_access() returns text language sql stable security definer
set search_path=pg_catalog,public as $$
 select access from public.shared_accounts where user_id=auth.uid()
$$;
create function public.shared_can_manage(p_id uuid) returns boolean language sql stable security definer
set search_path=pg_catalog,public as $$
 select public.shared_access()='editor' and exists(select 1 from public.shared_projects where id=p_id and owner_id=auth.uid())
$$;
create function public.shared_can_edit(p_id uuid) returns boolean language sql stable security definer
set search_path=pg_catalog,public as $$
 select public.shared_access()='editor' and exists(
 select 1 from public.shared_projects p where p.id=p_id and (p.owner_id=auth.uid() or exists(
 select 1 from public.shared_memberships m where m.project_id=p.id and m.user_id=auth.uid() and m.access='editor')))
$$;
create function public.shared_can_read(p_id uuid) returns boolean language sql stable security definer
set search_path=pg_catalog,public as $$
 select public.shared_access() is not null and exists(
 select 1 from public.shared_projects p where p.id=p_id and (p.owner_id=auth.uid() or exists(
 select 1 from public.shared_memberships m where m.project_id=p.id and m.user_id=auth.uid())))
$$;
create policy own_account on public.shared_accounts for select to authenticated using(user_id=auth.uid());
-- Viewers cannot obtain the financial/project JSON even by calling REST directly.
create policy editor_project on public.shared_projects for select to authenticated using(public.shared_can_edit(id));
create policy own_membership on public.shared_memberships for select to authenticated using(user_id=auth.uid() or public.shared_can_manage(project_id));
revoke all on public.shared_accounts,public.shared_projects,public.shared_memberships,public.shared_submission_master from anon,authenticated;
grant select on public.shared_accounts,public.shared_projects,public.shared_memberships to authenticated;

create function public.shared_list_projects() returns table(id uuid,title text,revision bigint,updated_at timestamptz,can_edit boolean,can_manage boolean)
language sql stable security definer set search_path=pg_catalog,public as $$
 select p.id,p.title,p.revision,p.updated_at,public.shared_can_edit(p.id),public.shared_can_manage(p.id)
 from public.shared_projects p where public.shared_can_read(p.id) order by p.updated_at desc
$$;
create function public.shared_get_project(p_id uuid) returns jsonb
language plpgsql stable security definer set search_path=pg_catalog,public as $$
declare v public.shared_projects%rowtype;
begin
 if not coalesce(public.shared_can_edit(p_id),false) then raise exception 'アクセス権限がありません' using errcode='42501'; end if;
 select * into strict v from public.shared_projects where id=p_id;
 return jsonb_build_object('id',v.id,'revision',v.revision,'updated_at',v.updated_at,'project',v.project_data);
end $$;
create function public.shared_save_project(p_id uuid,p_local_id text,p_project jsonb,p_expected_revision bigint) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public as $$
declare v public.shared_projects%rowtype;
begin
 if auth.uid() is null or public.shared_access() is distinct from 'editor' then
  raise exception '編集権限がありません' using errcode='42501';
 end if;
 if jsonb_typeof(p_project) is distinct from 'object' or p_project->>'role' is distinct from 'current'
 or p_project->>'id' is distinct from p_local_id or coalesce(length(btrim(p_project->>'title')),0) not between 1 and 500
 or jsonb_typeof(coalesce(p_project->'items','[]')) is distinct from 'array'
 or jsonb_typeof(coalesce(p_project->'contract','{}')) is distinct from 'object'
 or jsonb_typeof(coalesce(p_project->'submissionRecords','{}')) is distinct from 'object'
 or coalesce(length(p_local_id),0) not between 1 and 200 or octet_length(p_project::text)>10000000 then
  raise exception '工事データを確認してください' using errcode='22023';
 end if;
 if p_id is null then
  if p_expected_revision is not null then raise exception '更新番号を確認してください' using errcode='22023'; end if;
  begin
   insert into public.shared_projects(owner_id,local_id,title,project_data)
    values(auth.uid(),p_local_id,p_project->>'title',p_project) returning * into v;
  exception when unique_violation then raise exception '既に共有されています。一覧から取り込んでください' using errcode='PT409'; end;
 else
  if not coalesce(public.shared_can_edit(p_id),false) then raise exception '編集権限がありません' using errcode='42501'; end if;
  update public.shared_projects as sp set title=p_project->>'title',project_data=p_project,revision=sp.revision+1,updated_at=clock_timestamp()
   where sp.id=p_id and sp.local_id=p_local_id and sp.revision=p_expected_revision returning sp.* into v;
  if not found then raise exception '他の端末で更新されました。共有版を確認してください' using errcode='PT409'; end if;
 end if;
 return jsonb_build_object('id',v.id,'revision',v.revision,'updated_at',v.updated_at);
end $$;
create function public.shared_grant_member(p_id uuid,p_email text,p_access text default 'viewer') returns void
language plpgsql security definer set search_path=pg_catalog,public as $$
declare target uuid;account text;
begin
 if not coalesce(public.shared_can_manage(p_id),false) then raise exception '共有設定の権限がありません' using errcode='42501'; end if;
 if p_access not in ('viewer','editor') then raise exception '権限を確認してください' using errcode='22023'; end if;
 select u.id,a.access into target,account from auth.users u join public.shared_accounts a on a.user_id=u.id where lower(u.email)=lower(btrim(p_email));
 if target is null then raise exception '登録済みの共有相手を指定してください' using errcode='22023'; end if;
 if p_access='editor' and account<>'editor' then raise exception '閲覧専用の利用者に編集権限は付与できません' using errcode='42501'; end if;
 insert into public.shared_memberships values(p_id,target,p_access) on conflict(project_id,user_id) do update set access=excluded.access;
end $$;
create function public.shared_revoke_member(p_id uuid,p_email text) returns void
language plpgsql security definer set search_path=pg_catalog,public as $$
begin
 if not coalesce(public.shared_can_manage(p_id),false) then raise exception '共有設定の権限がありません' using errcode='42501'; end if;
 delete from public.shared_memberships where project_id=p_id and user_id in(select id from auth.users where lower(email)=lower(btrim(p_email)));
end $$;

create function public.shared_safe_date(p text) returns date language plpgsql immutable set search_path=pg_catalog,public as $$
begin return nullif(p,'')::date; exception when others then return null; end $$;
create function public.shared_safe_number(p text) returns numeric language plpgsql immutable set search_path=pg_catalog,public as $$
begin return p::numeric; exception when others then return null; end $$;
create function public.shared_safe_json(p text) returns jsonb language plpgsql immutable set search_path=pg_catalog,public as $$
begin return p::jsonb; exception when others then return null; end $$;
create function public.shared_get_status(p_id uuid,p_month text default to_char(timezone('Asia/Tokyo',now()),'YYYY-MM')) returns jsonb
language plpgsql stable security definer set search_path=pg_catalog,public as $$
declare v public.shared_projects%rowtype;d record;r jsonb;c jsonb;due date;amount numeric;applicable text;state text;priority text;
 rows jsonb='[]';materials jsonb;previous_materials jsonb;today date=timezone('Asia/Tokyo',now())::date;key text;
begin
 if not coalesce(public.shared_can_read(p_id),false) then raise exception 'アクセス権限がありません' using errcode='42501'; end if;
 if p_month !~ '^\d{4}-(0[1-9]|1[0-2])$' or p_month is null then raise exception '対象月を確認してください' using errcode='22023'; end if;
 select * into strict v from public.shared_projects where id=p_id;
 c=coalesce(v.project_data->'contract','{}');amount=public.shared_safe_number(c->>'contractAmount');
 select coalesce(jsonb_object_agg(item->>'id',jsonb_build_array(item->>'name',item->>'spec',item->'quantity',item->>'unit',item->>'state')),'{}')
 into materials from jsonb_array_elements(coalesce(v.project_data->'items','[]')) item where item->>'state'='adopted' and item->>'category'='新設';
 for d in select * from public.shared_submission_master order by no loop
  key=d.no::text||case when d.rule in ('monthly','monthlyReport') then ':'||p_month else '' end;
  r=coalesce(v.project_data->'submissionRecords'->key,'{}');state=coalesce(r->>'status','未提出');
  if d.no in (9,20,21) and state='確認済み' then
   select coalesce(jsonb_object_agg(k,public.shared_safe_json(val#>>'{}')),'{}') into previous_materials
    from jsonb_each(coalesce(r->'materialSnapshots','{}')) entry(k,val);
   if previous_materials is distinct from materials then state='要再確認'; end if;
  end if;
  due=public.shared_safe_date(r->>'dueDate');
  if due is null then
   due=case
    when d.rule='kentai' then public.shared_safe_date(c->>'startDate')+case when c->>'kentai'='electronic' then 40 else 30 end
    when d.rule='beforeStart' then public.shared_safe_date(c->>'startDate')-1
    when d.rule='complete' then public.shared_safe_date(c->>'completionDate')
    when d.rule ~ '^(contract|complete|subcontract|change)\+\d+$' then
     public.shared_safe_date(c->>(case split_part(d.rule,'+',1) when 'contract' then 'contractDate' when 'complete' then 'completionDate' when 'subcontract' then 'subcontractDate' else 'changeDate' end))+split_part(d.rule,'+',2)::int
    else null end;
  end if;
  applicable=case
   when c->>'checked' is distinct from 'true' then '条件未確認'
   when d.condition='always' then '対象'
   when d.condition='corins' then case when amount is null then '金額未入力' when amount<5000000 then '対象外' else '対象' end
   when d.condition in ('subcontract','supervision','designated','asbestos') then case c->>d.condition when 'yes' then '対象' when 'no' then '対象外' else '要判断' end
   when d.condition='advance' then case when amount<5000000 then '対象外' when c->>'advance'='yes' then '対象' when c->>'advance'='no' then '対象外' else '要判断' end
   when d.condition='change' then case when nullif(c->>'changeDate','') is not null then '対象' else '必要時に判断' end
   when d.condition='changeCorins' then case when amount<5000000 then '対象外' when nullif(c->>'changeDate','') is null then '必要時に判断' when amount is null then '金額未入力' else '対象' end
   when d.condition='recycle' then case when c->>'equipmentOnly'='yes' and amount is not null then case when amount>=100000000 then '対象' else '対象外' end else '要判断' end
   else '必要時に判断' end;
  priority=case when state='対象外' or applicable='対象外' then '対象外'
   when state in ('差戻し','要再確認','確認済み') then state when state='提出済' then '未確認'
   when due<today then '期限超過' when due<=today+7 then '7日以内' else '未提出' end;
  -- Explicit allowlist: no settings, prices, adopted items, contract amount, attachment URLs or history.
  rows=rows||jsonb_build_array(jsonb_build_object('no',d.no,'name',d.name,'phase',d.phase,'state',state,'priority',priority,
   'applicability',applicable,'due_date',due,'due_text',d.due_text,'submitted_at',r->>'submittedAt','confirmed_at',r->>'confirmedAt','note',coalesce(r->>'note','')));
 end loop;
 return jsonb_build_object('id',v.id,'title',v.title,'revision',v.revision,'updated_at',v.updated_at,'month',p_month,'rows',rows);
end $$;
-- SECURITY DEFINER functions must not retain PostgreSQL's default PUBLIC execution grant.
revoke all on function public.shared_access(),public.shared_can_manage(uuid),public.shared_can_edit(uuid),public.shared_can_read(uuid),
 public.shared_list_projects(),public.shared_get_project(uuid),public.shared_save_project(uuid,text,jsonb,bigint),
 public.shared_grant_member(uuid,text,text),public.shared_revoke_member(uuid,text),public.shared_get_status(uuid,text),
 public.shared_safe_date(text),public.shared_safe_number(text),public.shared_safe_json(text) from public,anon,authenticated;
grant execute on function public.shared_access(),public.shared_can_manage(uuid),public.shared_can_edit(uuid),public.shared_can_read(uuid),
 public.shared_list_projects(),public.shared_get_project(uuid),public.shared_save_project(uuid,text,jsonb,bigint),
 public.shared_grant_member(uuid,text,text),public.shared_revoke_member(uuid,text),public.shared_get_status(uuid,text) to authenticated;

insert into public.shared_submission_master(no,name,phase,rule,condition,due_text) values
(1,'工程表及び現場代理人等届（工事）','着工前','contract+7','always','契約締結日から7日以内'),
(2,'受注時工事登録内容確認書','着工前','contract+10','corins','契約締結日から10日以内'),
(3,'建退共証紙購入報告書','着工前','kentai','always','着工後30日以内（電子申請方式は40日以内）'),
(4,'施工計画書','着工前','beforeStart','always','着工前'),
(5,'保険証券（写し）※組立保険等','着工前','beforeStart','always','着工前'),
(6,'実施工程表','着工前','beforeStart','always','着工前'),
(7,'安全・訓練等の活動計画書','着工前','beforeStart','always','着工前'),
(8,'施工体制台帳（写し）','着工前','manual','subcontract','下請契約後速やかに（追加・変更時随時）'),
(9,'承諾図','工事中','manual','always','施工前'),
(10,'施工図','工事中','manual','always','施工前'),
(11,'建設廃棄物処理計画書','工事中','manual','always','施工前'),
(12,'安全・訓練等の活動報告書','工事中','monthly','always','毎月'),
(13,'2週間工程表','工事中','manual','always','工程会議'),
(14,'月間工程表','工事中','manual','always','工程会議'),
(15,'打合せ議事録','工事中','manual','always','工程会議・随時'),
(16,'検査報告書','工事中','manual','always','随時'),
(18,'完成写真','完成時','complete','always','完成時'),
(19,'工事写真','完成時','complete','always','完成時'),
(20,'施工記録図書','完成時','complete','always','完成時'),
(21,'完成図書','完成時','complete','always','完成時'),
(22,'完成図面','完成時','complete','always','完成時'),
(23,'竣工時工事登録内容確認書','完成時','complete+10','corins','工事完成日から10日以内'),
(24,'工事完成届','完成時','complete','always','完成時'),
(27,'工事目的物引渡書','完成時','manual','always','請求時'),
(28,'工事請負金請求書','完成時','manual','always','工事完成承認後'),
(29,'工事概況報告書','監理あり','monthlyReport','supervision','毎月上旬（前月分）'),
(30,'前金払申請書','必要時','contract+30','advance','契約締結日から30日以内'),
(31,'下請契約報告書','必要時','subcontract+5','subcontract','下請業者決定後5日以内'),
(32,'変更下請契約報告書','必要時','manual','optional','下請業者決定後5日以内'),
(33,'変更工程表','必要時','change+7','change','変更契約締結日から7日以内'),
(34,'変更時工事登録内容確認書','必要時','change+10','changeCorins','変更契約締結日から10日以内'),
(35,'工期遅延願','必要時','manual','optional','随時'),
(36,'事故（災害）報告書','必要時','manual','optional','事由発生後速やかに'),
(37,'現場代理人等変更届','必要時','manual','optional','事由発生後速やかに'),
(38,'専任を要する現場代理人の兼任申請書','必要時','manual','optional','事由発生後速やかに'),
(39,'部分払申請書','必要時','manual','optional','随時'),
(40,'中間前払金申請書','必要時','manual','optional','随時'),
(41,'指定部分に係る完成届','必要時','manual','designated','指定部分完成時'),
(42,'事前調査結果報告書','必要時','beforeStart','asbestos','着工前'),
(43,'建設リサイクル法に伴う通知','必要時','manual','recycle','随時'),
(44,'段階確認願','必要時','manual','optional','随時'),
(45,'変更記録','必要時','manual','optional','随時・設計変更時'),
(46,'その他','必要時','manual','optional','随時');
commit;
