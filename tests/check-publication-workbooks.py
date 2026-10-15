"""Validate XLSX artifacts from publication-rounding.cjs (directory argument)."""
from pathlib import Path
import sys
import xml.etree.ElementTree as E
import zipfile
N = {'m': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
for book in (0, 1):
    for purpose in ('design', 'budget'):
        path = Path(sys.argv[1]) / f'{book}-{purpose}.xlsx'
        with zipfile.ZipFile(path) as archive:
            assert archive.testzip() is None
            sheet = 4 if purpose == 'design' else 6
            tree = E.fromstring(archive.read(f'xl/worksheets/sheet{sheet}.xml'))
            cells = {c.attrib['r']: c for c in tree.findall('.//m:c', N)}
            def formula(ref): return cells[ref].find('m:f', N).text
            def value(ref): return float(cells[ref].find('m:v', N).text)
            assert formula('J32') == 'INT(MIN(F32:H32)*I32/100)+D31'
            assert formula('S31') == 'IF(R32>=1000,(ROUNDDOWN(R32,-INT(LOG10(R32))+2)),ROUNDDOWN(R32,0))'
            col = 'D' if book == 0 else 'E'
            assert formula('S32') == f'ROUNDDOWN(({col}32+S31)/T31,0)*T31'
            assert value('J32') == 2448
            assert value('S31') == 2570
            assert value('T31') == 100
            assert value('S32') == 31300
            assert value('D31') == 0  # Numeric input, not a publication citation string.
            assert value('G32') == 6800
            assert value(col + '32') == 28800
            assert cells['F32'].find('m:v', N) is None  # Publication is not counted twice.
            detail = 3 if purpose == 'design' else 4
            tree = E.fromstring(archive.read(f'xl/worksheets/sheet{detail}.xml'))
            dc = {c.attrib['r']: c for c in tree.findall('.//m:c', N)}
            row = 52 if purpose == 'design' else 91
            assert dc[f'F{row}'].find('m:f', N).text.endswith('!S32')
            assert float(dc[f'G{row}'].find('m:v', N).text) == 125200
            assert not E.fromstring(archive.read('xl/styles.xml')).findall('.//m:strike', N)
        print('PASS workbook formulas and amounts:', path.name)
