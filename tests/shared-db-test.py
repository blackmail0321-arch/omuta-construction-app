"""Real PostgreSQL tests for sharing, redaction, CAS updates and RLS. Docker required."""
import json
from pathlib import Path
import subprocess
import time
import uuid

ROOT = Path(__file__).resolve().parents[1]
name = 'omuta-rls-' + uuid.uuid4().hex[:10]
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
    result = command(['docker', 'run', '-d', '--name', name, '-e', 'POSTGRES_PASSWORD=local-test-only', 'postgres:16-alpine'])
    assert result.returncode == 0, result.stderr
    for _ in range(100):
        if command(['docker', 'exec', name, 'pg_isready', '-h', '127.0.0.1', '-U', 'postgres']).returncode == 0:
            break
        time.sleep(.2)
    sql((ROOT / 'tests/shared-db-bootstrap.sql').read_text())
    sql((ROOT / 'shared/db/001_shared_projects.sql').read_text())
    master = json.loads((ROOT / 'apps/integrated-v0.13/integrated/submissions-master.json').read_text())['rows']
    actual = json.loads(sql("select jsonb_agg(jsonb_build_object('no',no,'name',name,'phase',phase,'rule',rule,'condition',condition,'due',due_text) order by no) from public.shared_submission_master;"))
    assert actual == [{k: row[k] for k in ['no','name','phase','rule','condition','due']} for row in sorted(master, key=lambda r:r['no'])]
    for key, value in users.items():
        sql(f"insert into auth.users values('{value}','{key}@example.test'); insert into public.shared_accounts values('{value}','{'viewer' if key == 'viewer' else 'editor'}');")
    project = {'id': 'local-a', 'role': 'current', 'title': '検証用工事A', 'settings': {'financial_marker': 'FINANCE-SECRET'},
               'items': [{'id': 'one', 'name': '機密器具', 'spec': '機密仕様', 'quantity': 2, 'unit': '台', 'state': 'adopted', 'category': '新設', 'unitPrice': 123456}],
               'contract': {'checked': True, 'startDate': '2026-01-01', 'completionDate': '2026-03-15', 'contractAmount': 10000000},
               'submissionRecords': {'3': {'status': '差戻し', 'note': '記載を確認'}, '9': {'status': '確認済み'}}}
    created = json.loads(sql(f"select public.shared_save_project(null,'local-a',{literal(project)},null);", 'owner'))
    pid = created['id']
    sql(f"select public.shared_grant_member('{pid}','viewer@example.test','viewer');", 'owner')
    sql(f"select public.shared_grant_member('{pid}','editor@example.test','editor');", 'owner')
    assert json.loads(sql('select coalesce(jsonb_agg(t),\'[]\') from public.shared_list_projects() t;', 'viewer'))[0]['can_edit'] is False
    snapshot = json.loads(sql(f"select public.shared_get_status('{pid}','2026-03');", 'viewer'))
    rows = {r['no']: r for r in snapshot['rows']}
    assert len(rows) == 43 and rows[3]['due_date'] == '2026-01-31'
    assert rows[23]['due_date'] == '2026-03-25' and rows[24]['due_date'] == '2026-03-15'
    assert rows[3]['priority'] == '差戻し' and rows[9]['state'] == '要再確認'
    assert all(secret not in json.dumps(snapshot, ensure_ascii=False) for secret in ['FINANCE-SECRET', '機密仕様', '機密器具', '123456', '10000000', 'financial_marker'])
    assert sql('select count(*) from public.shared_projects;', 'viewer') == '0'
    sql(f"select public.shared_get_project('{pid}');", 'viewer', '42501')
    sql(f"select public.shared_get_status('{pid}','2026-03');", 'outsider', '42501')
    sql(f"select public.shared_save_project('{pid}','local-a',{literal(project)},1);", 'viewer', '42501')
    sql(f"select public.shared_save_project(null,'local-b',{literal({**project, 'id': 'local-b'})},null);", 'viewer', '42501')
    sql("update public.shared_accounts set access='editor';", 'viewer', '42501')
    sql(f"insert into public.shared_memberships values('{pid}','{users['viewer']}','editor');", 'viewer', '42501')
    sql(f"select public.shared_grant_member('{pid}','viewer@example.test','editor');", 'owner', '42501')
    sql(f"select public.shared_grant_member('{pid}','outsider@example.test','editor');", 'editor', '42501')
    sql(f"set role anon; select public.shared_get_status('{pid}','2026-03');", error='42501')
    updated = json.loads(sql(f"select public.shared_save_project('{pid}','local-a',{literal(project)},1);", 'editor'))
    assert updated['revision'] == 2
    sql(f"select public.shared_save_project('{pid}','local-a',{literal({**project, 'title': '上書き禁止'})},1);", 'owner', 'PT409')
    assert json.loads(sql(f"select public.shared_get_project('{pid}');", 'owner'))['project']['title'] == project['title']
    sql(f"select public.shared_save_project(null,'local-a',{literal(project)},null);", 'owner', 'PT409')
    sql(f"select public.shared_save_project(null,'local-a',{literal({**project, 'items': None})},null);", 'owner', '22023')
    sql(f"select public.shared_revoke_member('{pid}','viewer@example.test');", 'owner')
    sql(f"select public.shared_get_status('{pid}','2026-03');", 'viewer', '42501')
    sql(f"select public.shared_revoke_member('{pid}','editor@example.test');", 'owner')
    sql(f"select public.shared_get_project('{pid}');", 'editor', '42501')
    sql(f"select public.shared_get_status('{pid}','bad-month');", 'owner', '22023')
    print('PASS real PostgreSQL: viewer redaction/read-only, outsider/anonymous denial, membership controls, CAS/no-overwrite, revocation, deadlines/material changes')
finally:
    command(['docker', 'rm', '-f', name])
