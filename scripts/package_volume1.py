"""Create a Volume 1 archive without live configuration or user backups."""
import argparse
import hashlib
import json
from pathlib import Path
import zipfile

ROOT = Path(__file__).resolve().parents[1]
APP = ROOT / 'apps/integrated-v0.13'


def package(output):
    if output.exists():
        raise ValueError('Use a new archive path; existing files are not overwritten')
    files = {}
    for path in APP.rglob('*'):
        if not path.is_file() or '__pycache__' in path.parts:
            continue
        relative = path.relative_to(APP).as_posix()
        files[relative] = (b"window.OMUTA_SHARED_CONFIG={url:'',publishableKey:''};\n"
                           if path.name == 'shared-config.js' else path.read_bytes())
    for name in ['VOLUME1.md', 'REFERENCE_UPDATE_POLICY.md']:
        files[name] = (ROOT / name).read_bytes()
    files['はじめに.txt'] = ('設備工事 統合管理 Volume 1 / 1.0.0\n'
        '通常は従来の公開URLを使い続けてください。\n'
        'volume1.html が操作ガイド、index.html がアプリです。\n'
        'このZIPはアプリの保管用で、最新入力・添付・認証情報は含みません。\n'
        '作業JSONと書類・分類ZIPを別途保存してください。\n'
        '共有先設定は空欄です。別の場所で開いても既存サイトのデータは自動移行されません。\n'
        '開発用分割コードは integrated/ に収録しています。\n').encode()
    files['manifest.json'] = json.dumps({'release': 'Volume 1', 'version': '1.0.0',
        'date': '2026-10-28', 'sha256': {k: hashlib.sha256(v).hexdigest()
        for k, v in sorted(files.items())}}, ensure_ascii=False, indent=2).encode()
    output.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(output, 'x', zipfile.ZIP_DEFLATED) as archive:
        for name, data in sorted(files.items()):
            archive.writestr('設備工事統合管理_Volume1/' + name, data)
    with zipfile.ZipFile(output) as archive:
        assert archive.testzip() is None
    print(f'Created {output} ({output.stat().st_size:,} bytes)')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', required=True, type=Path)
    package(parser.parse_args().output)
