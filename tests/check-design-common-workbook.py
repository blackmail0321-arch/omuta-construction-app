"""Check output from design-common-model.cjs against the supplied design workbook."""
import sys,openpyxl
path=sys.argv[1] if len(sys.argv)>1 else '/tmp/omuta-design-original.xlsx'
v=openpyxl.load_workbook(path,data_only=True);f=openpyxl.load_workbook(path,data_only=False)
expected={'G4':4260000,'I4':68000,'G6':137000,'G8':1103000,'G10':913000,'G12':6413000,'G14':641300,'G16':7054300}
for ref,amount in expected.items():assert v['内訳書'][ref].value==amount,(ref,v['内訳書'][ref].value,amount)
assert v['電気設備']['G13'].value==3
assert v['電気設備']['BC11'].value==913000
assert f['電気設備']['X191'].value==29.102
assert f['電気設備']['AD191'].value==3.34
assert f['電気設備']['AT191'].data_type=='f'
print('PASS design Excel totals, original general fee formula and constants, G13=3 months')
