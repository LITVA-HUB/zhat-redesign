import unittest,importlib.util,json
from pathlib import Path
from bs4 import BeautifulSoup
ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('sync',ROOT/'scripts/sync-content.py');sync=importlib.util.module_from_spec(spec);spec.loader.exec_module(sync)
class ContentTests(unittest.TestCase):
 def test_sanitizer_removes_active_content(self):
  html=sync.clean('<div onclick="alert(1)"><script>alert(1)</script><form action="https://evil.test"><input></form><a href="javascript:alert(1)">bad</a><img src="x" onerror="alert(1)"><iframe src="https://forms.yandex.ru/test"></iframe><svg onload="x"></svg></div>','https://zhat.ru/')
  s=BeautifulSoup(html,'html.parser')
  self.assertFalse(s.select('script,form,input,iframe,svg'))
  self.assertFalse(any(a.startswith('on') for t in s.find_all(True) for a in t.attrs))
  self.assertNotIn('javascript:',html)
  self.assertIn('Открыть встроенный сервис',html)
 def test_document_and_table_survive(self):
  s=BeautifulSoup(sync.clean('<table><tr><td colspan="2"><a href="/files/a.pdf">Скачать</a></td></tr></table>','https://zhat.ru/'),'html.parser')
  self.assertEqual(s.a['href'],'https://zhat.ru/files/a.pdf');self.assertEqual(s.td['colspan'],'2')
 def test_core_catalog_and_files_complete(self):
  d=json.loads((ROOT/'src/content.json').read_text());keys={p['key'] for p in d['pages']}
  self.assertEqual(len(keys),len(d['pages']))
  for group in d['groups']:
   for link in group['links']:self.assertIn(link['key'],keys)
  for page in d['pages']:
   body=json.loads((ROOT/'public'/page['contentFile'].lstrip('/')).read_text())
   self.assertEqual(body['key'],page['key'])
   self.assertFalse(BeautifulSoup(body['html'],'html.parser').select('script,form,iframe,object,embed'))
 def test_archive_keys_unique(self):
  archive=json.loads((ROOT/'public/content/archive.json').read_text());self.assertGreater(len(archive),3000)
  self.assertEqual(len({p['key'] for p in archive}),len(archive))
 def test_key_normalization(self):
  self.assertEqual(sync.key('https://zhat.ru/?view=article&id=123:slug&catid=26'),'/article/123')
  self.assertIsNone(sync.key('https://evil.example/path'))
  self.assertEqual(sync.key('/schedule?ml=1'),'/schedule')
if __name__=='__main__':unittest.main()
