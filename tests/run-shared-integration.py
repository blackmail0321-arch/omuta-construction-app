"""Start isolated PostgreSQL/PostgREST, run browser integration, then remove test services."""
from pathlib import Path
import os
import subprocess
import time
import urllib.request
import uuid

ROOT = Path(__file__).resolve().parents[1]
suffix = uuid.uuid4().hex[:10]
db, rest, network = ('omuta-it-' + suffix + part for part in ['-db', '-rest', '-net'])


def run(args, **kwargs):
    return subprocess.run(args, text=True, capture_output=True, **kwargs)


def checked(args, **kwargs):
    result = run(args, **kwargs)
    if result.returncode:
        raise RuntimeError(result.stderr or result.stdout)
    return result.stdout.strip()


try:
    checked(['docker', 'network', 'create', network])
    checked(['docker', 'run', '-d', '--name', db, '--network', network, '-e', 'POSTGRES_PASSWORD=local-test-only', 'postgres:16-alpine'])
    for _ in range(150):
        if run(['docker', 'exec', db, 'pg_isready', '-h', '127.0.0.1', '-U', 'postgres']).returncode == 0:
            break
        time.sleep(.2)
    else:
        raise RuntimeError('Test database did not become ready')
    for file in ['tests/shared-db-bootstrap.sql', 'shared/db/001_shared_projects.sql']:
        checked(['docker', 'exec', '-i', db, 'psql', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1'], input=(ROOT / file).read_text())
    checked(['docker', 'run', '-d', '--name', rest, '--network', network, '-p', '127.0.0.1::3000',
             '-e', f'PGRST_DB_URI=postgres://postgres:local-test-only@{db}:5432/postgres',
             '-e', 'PGRST_DB_SCHEMAS=public', '-e', 'PGRST_DB_ANON_ROLE=anon',
             '-e', 'PGRST_JWT_SECRET=omuta-local-only-jwt-secret-1234567890', 'postgrest/postgrest:v12.2.3'])
    port = checked(['docker', 'port', rest, '3000/tcp']).split(':')[-1]
    for _ in range(100):
        try:
            urllib.request.urlopen('http://127.0.0.1:' + port + '/', timeout=1).close()
            break
        except Exception:
            time.sleep(.2)
    else:
        raise RuntimeError('Test REST server did not become ready')
    environment = {**os.environ, 'OMUTA_TEST_DB': db, 'OMUTA_TEST_REST': rest}
    result = subprocess.run(['node', 'tests/shared-browser.cjs'], cwd=ROOT, env=environment)
    if result.returncode:
        raise SystemExit(result.returncode)
finally:
    run(['docker', 'rm', '-f', rest, db])
    run(['docker', 'network', 'rm', network])
