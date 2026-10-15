"""Generate PUBLIC browser connection settings in an already built app directory."""
import argparse
import base64
import json
import os
from pathlib import Path
from urllib.parse import urlparse


def configure(app: Path, url: str, key: str) -> None:
    parsed = urlparse(url)
    if parsed.scheme != 'https' or not parsed.hostname or parsed.username or parsed.password or parsed.path not in ('', '/') or parsed.query or parsed.fragment:
        raise ValueError('SUPABASE_URL must be an HTTPS project origin')
    public = key.startswith('sb_publishable_')
    if not public:
        try:
            payload = key.split('.')[1]
            public = json.loads(base64.urlsafe_b64decode(payload + '=' * (-len(payload) % 4)))['role'] == 'anon'
        except (ValueError, KeyError, IndexError, TypeError):
            public = False
    if not public:
        raise ValueError('Only a public publishable or anon key is allowed; never service_role/sb_secret')
    script = 'window.OMUTA_SHARED_CONFIG=' + json.dumps({'url': url.rstrip('/'), 'publishableKey': key}) + ';\n'
    for directory in (app / 'shared', app / 'integrated' / 'shared'):
        if not directory.is_dir():
            raise ValueError('Build the app before configuring sharing')
        (directory / 'shared-config.js').write_text(script)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--app', type=Path, required=True)
    args = parser.parse_args()
    url = os.environ.get('SUPABASE_URL', '').strip()
    key = os.environ.get('SUPABASE_PUBLISHABLE_KEY', '').strip()
    if url or key:
        if not url or not key:
            raise SystemExit('Both SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY are required')
        try:
            configure(args.app, url, key)
        except ValueError as error:
            raise SystemExit(str(error)) from None
        print('Public shared connection settings generated (values omitted).')
    else:
        print('Sharing is unconfigured; existing local/offline workflow remains available.')
