"""Add visible return links in unused top margins of public PDFs; originals untouched."""
from pathlib import Path
import fitz
ROOT=Path(__file__).resolve().parents[1]
APP='https://blackmail0321-arch.github.io/omuta-construction-app/manual/#home'
for name,toc_page in [('manual.pdf',1),('check-sheets.pdf',0),('procurement-guide.pdf',0)]:
 path=ROOT/'downloads'/name
 doc=fitz.open(path)
 for page in doc:
  if 'アプリへ戻る' in page.get_text():continue
  # Existing text starts below this header. Fail rather than obscure document content.
  if any(fitz.Rect(b[:4]).intersects(fitz.Rect(35,10,420,41)) for b in page.get_text('blocks')):raise ValueError('Header space occupied: '+name)
  for rect,label,target in [(fitz.Rect(40,13,170,39),'目次へ戻る',toc_page),(fitz.Rect(185,13,315,39),'アプリへ戻る',APP)]:
   page.draw_rect(rect,color=(.25,.4,.35),fill=(.92,.96,.93),width=.6)
   page.insert_text((rect.x0+18,rect.y0+17),label,fontname='japan',fontsize=10,color=(.12,.25,.21))
   page.insert_link({'kind':fitz.LINK_GOTO,'from':rect,'page':target,'to':fitz.Point(0,0)} if isinstance(target,int) else {'kind':fitz.LINK_URI,'from':rect,'uri':target})
 tmp=path.with_suffix('.nav.pdf');doc.save(tmp,garbage=4,deflate=True);doc.close();tmp.replace(path)
 print(name,'return links added')
