-- Align the read-only status calculation with the existing editor.
-- No project data, confirmation dates, history or access grants are rewritten.
begin;
do $migration$
declare
  definition text;
  old_current text := $old$item where item->>'state'='adopted' and item->>'category'='新設';$old$;
  new_current text := $new$item where item->>'state'='adopted' and item->>'category'='新設'
    and normalize(coalesce(item->>'name',''), NFKC) !~ '産廃処理費|撤去工事|撤去費';$new$;
  old_previous text := $old$from jsonb_each(coalesce(r->'materialSnapshots','{}')) entry(k,val);$old$;
  new_previous text := $new$from jsonb_each(coalesce(r->'materialSnapshots','{}')) entry(k,val)
    where not exists (
      select 1 from jsonb_array_elements(coalesce(v.project_data->'items','[]')) prior_item
      where prior_item->>'id'=k
        and normalize(coalesce(prior_item->>'name',''), NFKC) ~ '産廃処理費|撤去工事|撤去費'
    );$new$;
begin
  definition := pg_get_functiondef('public.shared_get_status(uuid,text)'::regprocedure);
  if position(new_current in definition)>0 and position(new_previous in definition)>0 then
    return;
  end if;
  if length(definition)-length(replace(definition,old_current,''))<>length(old_current)
     or length(definition)-length(replace(definition,old_previous,''))<>length(old_previous) then
    raise exception '既存の判定処理が想定と異なります。変更せず停止しました。';
  end if;
  definition := replace(replace(definition,old_current,new_current),old_previous,new_previous);
  execute definition;
end;
$migration$;
commit;
select
  position('normalize(coalesce(item->>''name'',''''), NFKC)' in
    pg_get_functiondef('public.shared_get_status(uuid,text)'::regprocedure))>0
  and position('prior_item' in
    pg_get_functiondef('public.shared_get_status(uuid,text)'::regprocedure))>0
  as "材料照合の修正済み";
