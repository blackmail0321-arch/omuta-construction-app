"""Generate a synthetic test drawing, containing no user documents."""
from pathlib import Path
import fitz
path=Path('/tmp/cad-test.pdf')
pdf=fitz.open();page=pdf.new_page(width=600,height=400)
for a,b in [((30,30),(550,30)),((30,300),(550,300)),((30,30),(30,300)),((550,30),(550,300))]:page.draw_line(a,b,width=1)
pdf.save(path)
