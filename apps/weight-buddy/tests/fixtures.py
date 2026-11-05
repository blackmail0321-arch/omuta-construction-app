# Synthetic data only; never copy the user's workbook to the public repository.
import openpyxl
from pathlib import Path
p=Path('/tmp/weight-buddy-tests');p.mkdir(exist_ok=True)
w=openpyxl.Workbook();s=w.active;s.title='テスト体重変動';s['A1']='2024年';s['C6']=60;s['C7']=60.05;s['D34']=61;s['D35']=62;s['F36']='—';s['C73']=40;s['E73']=1.7
w.save(p/'fixture.xlsx')
