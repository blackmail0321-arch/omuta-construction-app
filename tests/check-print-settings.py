"""Check exported municipal page settings and A4 row-height budget."""
import sys
import openpyxl
w = openpyxl.load_workbook(sys.argv[1], data_only=False)
cover, common, detail = [w[n] for n in ['起工伺', '電気設備', '内訳書']]
for s in [cover, common]:
    assert str(s.page_setup.paperSize) == '9'
    assert s.page_setup.orientation == 'landscape'
    assert s.page_setup.fitToWidth == s.page_setup.fitToHeight == 1
    assert s.sheet_properties.pageSetUpPr.fitToPage
assert str(common.print_area) == "'電気設備'!$A$1:$AY$30"
assert common.print_options.horizontalCentered and common.print_options.verticalCentered
assert abs(common.page_margins.left * 2.54 - 1.5) < .001
assert detail.page_setup.orientation == 'portrait'
assert str(detail.page_setup.paperSize) == '9' and detail.page_setup.scale == 100
assert not detail.sheet_properties.pageSetUpPr.fitToPage
assert detail.print_title_rows == '$1:$1'
assert detail.print_options.verticalCentered
assert [b.id for b in detail.row_breaks.brk] == [37]
usable = (297 / 25.4 - detail.page_margins.top - detail.page_margins.bottom) * 72
for first, last, repeated in [(1,37,0),(38,73,1)]:
    height = sum(detail.row_dimensions[i].height for i in range(first,last+1)) + repeated * detail.row_dimensions[1].height
    assert height <= usable, (height, usable)
print('PASS A4 cover/common landscape, detail portrait 100%, ranges, centering, two-page row-height budget')
