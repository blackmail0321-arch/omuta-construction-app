"""Add a PDF outline and return links to the rendered supplement (developer utility)."""
from pathlib import Path
import json,fitz
root=Path(__file__).resolve().parents[1];p=root/'downloads/procurement-guide.pdf';data=json.loads((root/'data/manual.json').read_text());d=fitz.open(p);toc=[[1,'目次',1]]
for cid in ['c22','c23']:
 c=next(c for c in data['chapters'] if c['id']==cid);hits=[i for i,page in enumerate(d) if page.search_for(c['title'])]
 if not hits:raise ValueError('Missing heading: '+c['title'])
 toc.append([1,c['title'],max(hits)+1])
d.set_toc(toc);d.set_metadata({'title':'入札不調・不落後の随意契約と資料確認ガイド','author':'工事の手引き'})
for page in d:page.insert_link({'kind':fitz.LINK_GOTO,'from':fitz.Rect(45,810,550,840),'page':0,'to':fitz.Point(0,0)})
for i,page in enumerate(d):
 for w in page.get_text('words'):
  if w[0]<30 or w[2]>568 or w[1]<20 or w[3]>841:raise ValueError('Out of page text at '+str(i+1))
temp=p.with_name('supplement-final.pdf');d.save(temp,garbage=4,deflate=True);pages=len(d);d.close();temp.replace(p)
data['supplement']={'file':'downloads/procurement-guide.pdf','title':'随意契約・資料ガイド（追加編）','pages':pages};(root/'data/manual.json').write_text(json.dumps(data,ensure_ascii=False,separators=(',',':')))
print('Supplement:',pages,'pages,',len(toc),'bookmarks')
