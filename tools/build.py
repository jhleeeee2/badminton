"""src/ 를 단일 HTML 하나로 묶어 dist/badminton_rally.html 생성.
사용법: 프로젝트 폴더에서  python tools/build.py
"""
import re, pathlib
ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC, DIST = ROOT / 'src', ROOT / 'dist'
html = (SRC / 'index.html').read_text(encoding='utf-8')

def css(m):
    return '<style>\n' + (SRC / m.group(1)).read_text(encoding='utf-8') + '</style>'
def js(m):
    return '<script>\n' + (SRC / m.group(1)).read_text(encoding='utf-8') + '</script>'

html = re.sub(r'<link rel="stylesheet" href="([^"]+)">', css, html)
html = re.sub(r'<script src="([^"]+)"></script>', js, html)
DIST.mkdir(exist_ok=True)
out = DIST / 'badminton_rally.html'
out.write_text(html, encoding='utf-8')
print(f'built {out.relative_to(ROOT)} ({len(html.encode("utf-8")):,} bytes)')
