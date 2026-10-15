"""Public config validation and safe split of editor/status-only deploy artifacts."""
import importlib.util
import json
from pathlib import Path
import sys
import tempfile
import base64
import subprocess

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))
from configure_shared import configure
from package_shared import package

with tempfile.TemporaryDirectory(prefix='omuta-package-') as temporary:
    output = Path(temporary) / 'sites'
    package(output)
    viewer = output / 'viewer'
    assert {p.name for p in viewer.iterdir()} == {'index.html', 'status.css', 'status.js', 'shared-client.js', 'shared-config.js'}
    assert all(secret not in (viewer / 'index.html').read_text() for secret in ['WB_SOURCES', 'WB_EXPORT_TEMPLATES', 'workbench.js'])
    public_key = 'sb_publishable_test-only'
    configure(output / 'editor', 'https://test.supabase.co', public_key)
    subprocess.run([sys.executable, 'integrated/build.py'], cwd=output / 'editor', check=True, capture_output=True)
    assert (output / 'editor/index.html').read_bytes() == (output / 'editor/integrated/index.html').read_bytes()
    for directory in ['shared', 'integrated/shared']:
        assert public_key in (output / 'editor' / directory / 'shared-config.js').read_text()
    payload = base64.urlsafe_b64encode(json.dumps({'role': 'service_role'}).encode()).decode().rstrip('=')
    for url, key in [('http://test.supabase.co', public_key), ('https://test.supabase.co', 'sb_secret_never-public'), ('https://test.supabase.co', 'header.' + payload + '.signature')]:
        try:
            configure(output / 'editor', url, key)
        except ValueError:
            pass
        else:
            raise AssertionError('Unsafe configuration accepted')
    try:
        package(output)
    except ValueError:
        pass
    else:
        raise AssertionError('Existing package overwritten')
print('PASS public-key validation, HTTPS-only deployment and isolated status-only package; no overwrites')
