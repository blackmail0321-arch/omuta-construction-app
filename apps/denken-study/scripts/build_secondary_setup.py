from pathlib import Path
import html
def build(root):
 root=Path(root);template=(root/'grading-worker/setup.template.html').read_text(encoding='utf-8');code=(root/'grading-worker/worker.mjs').read_text(encoding='utf-8');(root/'secondary-setup.html').write_text(template.replace('__WORKER_SOURCE__',html.escape(code)),encoding='utf-8')
if __name__=='__main__':build(Path(__file__).resolve().parents[1])
