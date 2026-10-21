"""Prepare separate editor and status-only sites. This does not deploy or publish."""
import argparse
from pathlib import Path
import shutil
import os
from configure_shared import configure

ROOT = Path(__file__).resolve().parents[1]


def package(output: Path) -> None:
    output = output.resolve()
    if output.exists():
        raise ValueError('Use a new output directory; existing files are never overwritten')
    output.mkdir(parents=True)
    editor = output / 'editor'
    shutil.copytree(ROOT / 'apps/integrated-v0.13', editor)
    shutil.copyfile(ROOT / 'shared/standards/worker.mjs', editor / '_worker.js')
    url = os.environ.get('SUPABASE_URL', '').strip()
    key = os.environ.get('SUPABASE_PUBLISHABLE_KEY', '').strip()
    if url or key:
        if not url or not key:
            raise ValueError('Both public connection settings are required')
        configure(editor, url, key)
    viewer = output / 'viewer'
    viewer.mkdir()
    for filename in ['status.html', 'status.css', 'status.js', 'shared-client.js']:
        shutil.copyfile(ROOT / 'shared/web' / filename, viewer / ('index.html' if filename == 'status.html' else filename))
    shutil.copyfile(editor / 'shared/shared-config.js', viewer / 'shared-config.js')
    print('Prepared editor/ and viewer/ sites. Not deployed; no private credentials included.')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    try:
        package(args.output)
    except ValueError as error:
        raise SystemExit(str(error)) from None
