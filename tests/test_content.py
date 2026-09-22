import unittest,importlib.util,json
from pathlib import Path
from unittest.mock import patch
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
 def test_media_survives_without_autoplay_or_handlers(self):
  s=BeautifulSoup(sync.clean('<video autoplay onplay="bad()" poster="/p.jpg"><source src="/v.mp4" type="video/mp4"></video>',sync.BASE),'html.parser')
  self.assertEqual(s.source['src'],'https://zhat.ru/v.mp4')
  self.assertEqual(s.video['preload'],'none')
  self.assertIn('controls',s.video.attrs)
  self.assertNotIn('autoplay',s.video.attrs)
  self.assertNotIn('onplay',s.video.attrs)
 def test_placeholder_and_wrapper_are_not_fake_links(self):
  s=BeautifulSoup(sync.clean('<a href="#">Скачать</a><a><a href="/files/a.pdf">Документ</a></a><h2 id="part">Тема</h2><a href="#part">К теме</a>',sync.BASE),'html.parser')
  self.assertEqual(len(s.select('a[href]')),2)
  self.assertEqual(s.h2['id'],'source-part')
  self.assertEqual(s.select('a')[-1]['href'],'https://zhat.ru#part')
 def test_source_section_toggles_are_not_missing_downloads(self):
  html=sync.clean('<a href="#">Документы</a><a href="#">Скачать заявление</a>',sync.BASE)
  self.assertEqual(html.count('ссылка пока не опубликована'),1)
 def test_empty_article_not_mistaken_for_content(self):
  with patch.object(sync,'fetch',return_value='<div class="item-page"><h2>Название</h2><div itemprop="articleBody"></div><ul class="pager"><a href="/next">Вперёд</a></ul></div>'):
   p=sync.parse_page(('https://zhat.ru/empty','Название'))
  self.assertTrue(p['pending']);self.assertTrue(p['empty']);self.assertIsNone(p['error'])
 def test_category_import_includes_intro_articles(self):
  with patch.object(sync,'fetch',return_value='<div class="blog"><div class="items-leading">Первая новость</div><div class="items-row">Вторая новость</div></div>'):
   p=sync.parse_page(('https://zhat.ru/category','Категория'))
  self.assertIn('Вторая новость',p['text'])
 def test_every_section_has_content_or_explicit_source_state(self):
  d=json.loads((ROOT/'src/content.json').read_text());pages={p['key']:p for p in d['pages']}
  self.assertEqual(sum(len(g['links']) for g in d['groups']),79)
  for g in d['groups']:
   for l in g['links']:
    p=pages[l['key']];body=json.loads((ROOT/'public'/p['contentFile'].lstrip('/')).read_text())
    self.assertTrue(body.get('error') or body.get('pending') or BeautifulSoup(body['html'],'html.parser').get_text(strip=True) or BeautifulSoup(body['html'],'html.parser').select('img,video,audio,a[href]'),l['key'])
 def test_download_index_unique(self):
  d=json.loads((ROOT/'src/content.json').read_text())
  for p in d['pages']:
   b=json.loads((ROOT/'public'/p['contentFile'].lstrip('/')).read_text());urls=[r['url'] for r in b.get('resources',[])]
   self.assertEqual(len(urls),len(set(urls)))
 def test_key_normalization(self):
  self.assertEqual(sync.key('https://zhat.ru/?view=article&id=123:slug&catid=26'),'/article/123')
  self.assertIsNone(sync.key('https://evil.example/path'))
  self.assertEqual(sync.key('/schedule?ml=1'),'/schedule')
if __name__=='__main__':unittest.main()
