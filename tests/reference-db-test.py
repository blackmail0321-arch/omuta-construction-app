"""Real PostgreSQL tests for sharing, redaction, CAS updates and RLS. Docker required."""
import json
from pathlib import Path
import subprocess
import time
import uuid

ROOT = Path(__file__).resolve().parents[1]
name = 'omuta-library-' + uuid.uuid4().hex[:10]
users = {key: f'00000000-0000-0000-0000-{i:012d}' for i, key in enumerate(['owner', 'editor', 'viewer', 'outsider'], 1)}


def command(args, **kwargs):
    return subprocess.run(args, text=True, capture_output=True, **kwargs)


def sql(query, user=None, error=None):
    prefix = ''
    if user:
        claims = json.dumps({'sub': users[user], 'role': 'authenticated'})
        prefix = f"set role authenticated; select set_config('request.jwt.claims','{claims}',false);\n"
    result = command(['docker', 'exec', '-i', name, 'psql', '-U', 'postgres', '-qAt', '-v', 'ON_ERROR_STOP=1', '-v', 'VERBOSITY=sqlstate'], input=prefix + query)
    if error:
        assert result.returncode and error in result.stderr, result.stderr
        return None
    assert result.returncode == 0, result.stderr
    return result.stdout.strip().splitlines()[-1] if result.stdout.strip() else ''


def literal(data):
    return "'" + json.dumps(data, ensure_ascii=False).replace("'", "''") + "'::jsonb"


try:
    result=command(['docker','run','-d','--name',name,'-e','POSTGRES_PASSWORD=local-test-only','postgres:16-alpine'])
    assert result.returncode==0,result.stderr
    for _ in range(100):
        if command(['docker','exec',name,'pg_isready','-h','127.0.0.1','-U','postgres']).returncode==0: break
        time.sleep(.2)
    for file in ['tests/shared-db-bootstrap.sql','shared/db/001_shared_projects.sql','shared/db/002_private_reference_library.sql']:
        sql((ROOT/file).read_text())
    sql("create schema storage; create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint); create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text); alter table storage.objects enable row level security; grant usage on schema storage to anon,authenticated; grant select,insert,update,delete on storage.objects to anon,authenticated; create policy existing_broad_policy on storage.objects for all to anon,authenticated using(true) with check(true);")
    sql((ROOT/'shared/db/003_private_reference_files.sql').read_text())
    for who,uid in users.items():
        sql(f"insert into auth.users values('{uid}','{who}@example.test'); insert into public.shared_accounts values('{uid}','{'viewer' if who=='viewer' else 'editor'}');")
    sql(f"insert into public.reference_library_admins values('{users['owner']}');")
    assert sql('select public.reference_is_admin();','owner')=='t'
    assert sql('select public.reference_is_admin();','editor')=='f'
    project={'id':'ref-a','title':'非公開参考資料','role':'reference','settings':{'person':'PRIVATE-PERSON'},'items':[{'id':'material-a','name':'照明器具','spec':'A202','quantity':3,'unit':'台','unitPrice':24000,'mode':'direct','reason':'PRIVATE-REASON','source':{'file':'PRIVATE-ORIGINAL'}}], 'submissionRecords':{'1':{'note':'PRIVATE-NOTE'}},'history':[{'detail':'PRIVATE-HISTORY'}]}
    project['items'].append({'id':'material-b','name':'組立明細','mode':'compose','spec':'B202','quantity':1,'unit':'台','unitPrice':100})
    save=f"select public.reference_save_private('ref-a',{literal(project)},'令和8年度',null);"
    row=json.loads(sql(save,'owner')); rid=row['id']
    assert json.loads(sql(save,'owner'))==row
    for who in ['editor','viewer','outsider']:
        sql(save,who,'42501')
        sql('select * from public.reference_list_private();',who,'42501')
        sql(f"select public.reference_get_private('{rid}');",who,'42501')
        sql('select * from public.reference_library;',who,'42501')
        assert sql('select count(*) from public.reference_search();',who)=='0'
    sql('set role anon; select * from public.reference_library;',error='42501')
    sql('set role anon; select * from public.reference_search();',error='42501')
    assert json.loads(sql(f"select public.reference_get_private('{rid}');",'owner'))['project']==project
    file_hash='a'*64
    path=users['owner']+'/'+rid+'/'+file_hash
    sql(f"insert into storage.objects(bucket_id,name) values('omuta-reference-originals','{path}');",'owner')
    assert sql("select count(*) from storage.objects where bucket_id='omuta-reference-originals';",'owner')=='1'
    for who in ['editor','viewer','outsider']:
        assert sql("select count(*) from storage.objects where bucket_id='omuta-reference-originals';",who)=='0'
        sql(f"insert into storage.objects(bucket_id,name) values('omuta-reference-originals','{path}');",who,'42501')
        sql(f"select * from public.reference_list_files('{rid}');",who,'42501')
    assert sql("set role anon; select count(*) from storage.objects where bucket_id='omuta-reference-originals';")=='0'
    sql(f"delete from storage.objects where name='{path}';",'owner')
    assert sql("select count(*) from storage.objects;",'owner')=='1'
    sql(f"select public.reference_record_file('{rid}','file-a','original.pdf',12,'{file_hash}');",'owner')
    assert json.loads(sql(f"select jsonb_agg(f) from public.reference_list_files('{rid}') f;",'owner'))[0]['name']=='original.pdf'
    release=json.loads(sql(f"select public.reference_publish('{rid}',1,'今回条件を確認','[\"material-a\"]');",'owner'))['id']
    composed=json.loads(sql(f"select public.reference_publish('{rid}',1,'再計算が必要','[\"material-b\"]');",'owner'))['id']
    assert json.loads(sql(f"select public.reference_get_suggestion('{composed}');",'owner'))['materials'][0]['unitPrice'] is None
    sql(f"select public.reference_disable_release('{composed}');",'owner')
    sql(f"select public.reference_set_recipient('{release}','editor@example.test',true);",'owner')
    assert sql('select count(*) from public.reference_search();','editor')=='1'
    approved=json.loads(sql(f"select public.reference_get_suggestion('{release}');",'editor'))
    assert set(approved['materials'][0])=={'id','name','spec','quantity','unit','unitPrice'}
    assert 'PRIVATE-' not in json.dumps(approved)
    for who in ['viewer','outsider']:
        sql(f"select public.reference_get_suggestion('{release}');",who,'42501')
    sql(f"select public.reference_set_recipient('{release}','outsider@example.test',true);",'editor','42501')
    sql(f"select public.reference_set_recipient('{release}','viewer@example.test',true);",'owner','22023')
    sql(f"select public.reference_publish('{rid}',9,'','[\"material-a\"]');",'owner','PT409')
    shared={**project,'id':'shared-a','role':'current'}
    shared_id=json.loads(sql(f"select public.shared_save_project(null,'shared-a',{literal(shared)},null);",'owner'))['id']
    sql(f"select public.shared_grant_member('{shared_id}','editor@example.test','editor');",'owner')
    sql("select public.reference_check_archive('shared-a');",'owner','22023')
    sql(f"select public.shared_revoke_member('{shared_id}','editor@example.test');",'owner')
    sql("select public.reference_check_archive('shared-a');",'owner')
    event='11111111-1111-1111-1111-111111111111'
    use=f"select public.reference_record_usage('{event}','{release}','current-a');"
    sql(use,'editor');sql(use,'editor')
    assert sql('select count(*) from public.reference_list_usage();','editor')=='1'
    assert sql('select count(*) from public.reference_list_usage();','owner')=='0'
    sql(f"select public.reference_set_recipient('{release}','editor@example.test',false);",'owner')
    assert sql('select count(*) from public.reference_search();','editor')=='0'
    sql(f"select public.reference_get_suggestion('{release}');",'editor','42501')
    sql(use,'editor','42501')
    assert json.loads(sql(f"select public.reference_get_private('{rid}');",'owner'))['project']==project
    sql(f"select public.reference_disable_release('{release}');",'owner')
    assert sql('select count(*) from public.reference_search();','owner')=='0'
    print('PASS private library ownership, direct API denial, explicit sanitized grants, revocation, immutable approval and idempotent private usage history')
finally:
    command(['docker','rm','-f',name])
