"""Audit all menu sections and their official files. HEAD, then ranged GET on failure."""
import json
import re
import sys
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import quote
from urllib.request import Request, urlopen
from bs4 import BeautifulSoup

ROOT = Path(__file__).resolve().parents[1]
catalog = json.loads((ROOT / 'src/content.json').read_text())
pages = {p['key']: p for p in catalog['pages']}
urls = {}
rows = []
for group in catalog['groups']:
    for link in group['links']:
        page = pages[link['key']]
        body = json.loads((ROOT / 'public' / page['contentFile'].lstrip('/')).read_text())
        soup = BeautifulSoup(body['html'], 'html.parser')
        for node in soup.select('a[href], video[src], source[src]'):
            url = node.get('href') or node.get('src')
            if url.startswith('https://zhat.ru/files/'):
                urls.setdefault(url, set()).add(page['key'])
        status = 'Материалы перенесены'
        if body.get('pending'):
            status = 'Источник пуст / в разработке; пояснение и связанные материалы'
        if body.get('error'):
            status = 'Ошибка источника; каталог подразделов' if page['key'] in ('/abitur', '/projects') else 'Ошибка источника; связанные материалы и контакты'
        rows.append((group['title'], link, status, len(body.get('resources', [])), len(soup.select('video,audio'))))

def check(url):
    result = {'url': url, 'pages': sorted(urls[url])}
    for method in ('HEAD', 'GET'):
        try:
            headers = {'User-Agent': 'ZhatRedesign-LinkAudit/1.0'}
            if method == 'GET': headers['Range'] = 'bytes=0-1023'
            with urlopen(Request(quote(url, safe=':/?&=%+#'), method=method, headers=headers), timeout=15) as response:
                result['status'] = response.status
                return result
        except Exception as exc:
            error = str(exc)
    return dict(result, error=error)

# Reuse a completed audit only when explicitly passed (useful for report regeneration).
if len(sys.argv) == 3 and sys.argv[1] == '--results':
    results = json.loads(Path(sys.argv[2]).read_text())
    if {r['url'] for r in results} != set(urls):
        raise SystemExit('Saved results do not cover the current file set; run a fresh audit.')
else:
    with ThreadPoolExecutor(max_workers=5) as pool:
        results = list(pool.map(check, urls))
checked_at = datetime.now(timezone.utc).isoformat()
failed = [r for r in results if r.get('error')]
health = {'checkedAt': checked_at, 'checked': len(results), 'available': len(results)-len(failed), 'unavailable': {r['url']: r['error'] for r in failed}}
(ROOT / 'src/source-health.json').write_text(json.dumps(health, ensure_ascii=False, indent=2))
report = ['# Покрытие разделов ЖАТ', '', f'Проверка: {checked_at[:10]}. Источник: https://zhat.ru/.', '',
          f'{len(rows)} пунктов меню в шести разделах. Проверено {len(results)} уникальных ссылок на официальные файлы и медиа: {len(results)-len(failed)} доступны, {len(failed)} недоступны. Ошибки HEAD перепроверены GET. Это доступность HTTP, а не проверка содержания каждого PDF.', '',
          'Все пункты имеют локальный маршрут, навигацию по своей группе и ссылку на источник. Неопубликованные сведения не придуманы. Каталоги документов содержат поиск; официальные формы и файлы остаются у ЖАТ.', '']
for group in catalog['groups']:
    report += ['## '+group['title'], '', '| Пункт | Состояние | Документы | Видео/аудио |', '|---|---|---:|---:|']
    for title, link, status, files, media in rows:
        if title == group['title']:
            report.append(f"| [{link['title']}]({link['url']}) | {status} | {files} | {media} |")
    report.append('')
report += ['## Недоступные файлы на стороне источника', '', 'Доступность показана в интерфейсе с датой проверки. Повторить: `npm run audit:sections`.', '']
for r in failed:
    report.append(f"- [{r['url'].split('/')[-1]}]({quote(r['url'],safe=':/?&=%+#')}) — {r['error']}")
(ROOT/'docs/SECTION-COVERAGE.md').write_text('\n'.join(report)+'\n')
print(f'{len(rows)} sections; {len(results)} files checked; {len(failed)} unavailable at source.')
