"""Create synthetic-only fixtures outside the repository."""
from pathlib import Path
import sys
import openpyxl
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.cidfonts import UnicodeCIDFont
from PIL import Image,ImageDraw,ImageFont
root=Path(sys.argv[1]);root.mkdir(parents=True,exist_ok=True)
w=openpyxl.Workbook();s=w.active;s.title='Sheet1';s['C2']='R8'
for row,month in [(4,10),(5,11),(6,12)]:
 s.cell(row,3,month);s.cell(row,6,20000);s.cell(row,7,10000)
s['I4']=5000;s['J4']=20000;s['O8']=5000;s['P8']='10月引落し'
slips=w.create_sheet('明細取込一覧')
for row,kind,gross,ded,net,a1,a2,source in [(4,'給与',300000,50000,250000,20000,230000,'テスト給与.pdf'),(5,'賞与',100000,10000,90000,5000,85000,'テスト賞与.pdf')]:
 for col,value in enumerate(['令和8年',10,kind,gross,ded,net,a1,a2,None,None,None,source],1):slips.cell(row,col,value)
comp=w.create_sheet('給与明細比較');comp['B3']='令和8年10月';comp['A10']='所得税';comp['B10']=10000
w.save(root/'synthetic.xlsx')
lines=['令和8年10月 給与明細','総支給額 300,000 円','控除金額合計 50,000 円','差引支給額 250,000 円','財形貯蓄 10,000 円','口座1 20,000 円','口座2 230,000 円','所得税 10,000 円']
pdfmetrics.registerFont(UnicodeCIDFont('HeiseiMin-W3'))
c=canvas.Canvas(str(root/'令和8年10月給与明細.pdf'));c.setFont('HeiseiMin-W3',18)
for i,line in enumerate(lines):c.drawString(45,780-i*55,line)
c.save()
im=Image.new('RGB',(1400,1800),'white');d=ImageDraw.Draw(im);font=ImageFont.truetype('/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc',45)
for i,line in enumerate(lines):d.text((80,100+i*170),line,font=font,fill='black')
im.save(root/'scan.png');c=canvas.Canvas(str(root/'令和8年10月給与画像.pdf'),pagesize=(595,765));c.drawImage(str(root/'scan.png'),0,0,width=595,height=765);c.save()
print('Synthetic workbook, text PDF and image-only PDF created')
