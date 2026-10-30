-- Run only as the database administrator after 002 and 003.
-- Replace OWNER_EMAIL_HERE with the owner's EXISTING Supabase editor account email.
-- This never creates accounts, elevates a viewer, or changes an existing work project.
do $$
declare target uuid; matches integer;
begin
 select count(*) into matches from auth.users u join public.shared_accounts a on a.user_id=u.id
  where lower(u.email)=lower('OWNER_EMAIL_HERE') and a.access='editor';
 if matches<>1 then raise exception '所有者の登録済み編集アカウントを1件確認してから指定してください'; end if;
 select u.id into target from auth.users u join public.shared_accounts a on a.user_id=u.id
  where lower(u.email)=lower('OWNER_EMAIL_HERE') and a.access='editor';
 insert into public.reference_library_admins(user_id) values(target) on conflict do nothing;
end $$;
