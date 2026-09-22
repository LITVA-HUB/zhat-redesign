"""Import public college content; never execute source scripts or copy forms."""
from bs4 import BeautifulSoup, Comment
from urllib.request import urlopen, Request
from urllib.parse import urljoin, urlsplit, parse_qs, urlencode, quote
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from pathlib import Path
import json,re,sys,time
ROOT=Path(__file__).resolve().parents[1]
BASE='https://zhat.ru'
OUT=ROOT/'src/content.json'
ALLOWED=set('p div span h1 h2 h3 h4 h5 h6 a img ul ol li table thead tbody tfoot tr td th strong b em i u br hr blockquote dl dt dd figure figcaption details summary small sup sub video audio source'.split())
def key(url):
 u=urlsplit(urljoin(BASE,url)); q=parse_qs(u.query)
 if u.hostname not in ('zhat.ru','www.zhat.ru'): return None
 if 'id' in q and q.get('view')==['article']:
  m=re.match(r'\d+',q['id'][0]); return '/article/'+m[0] if m else None
 return u.path.rstrip('/') or '/'
def fetch(url):
 return urlopen(Request(quote(url,safe=':/?&=%+#'),headers={'User-Agent':'ZhatRedesign-ContentSync/1.0'}),timeout=22).read().decode('utf-8','replace')
def clean(node,url):
 node=BeautifulSoup(str(node),'html.parser')
 for c in node.find_all(string=lambda t:isinstance(t,Comment)): c.extract()
 for t in node.find_all(['script','style','noscript','form','input','button','select','textarea','object','embed','svg']):t.decompose()
 for t in node.find_all('iframe'):
  href=urljoin(url,t.get('src',''))
  a=node.new_tag('a',href=href);a.string='Открыть встроенный сервис';t.replace_with(a)
 for t in list(node.find_all(True)):
  if t.name not in ALLOWED:t.unwrap();continue
  attrs={}
  if t.get('id'):attrs['id']='source-'+t['id']
  if t.name=='a':
   raw=t.get('href','').strip()
   if not raw or raw=='#':
    if raw=='#' and 'скачать' in t.get_text(' ',strip=True).lower():t.append(' — ссылка пока не опубликована на сайте ЖАТ')
    t.unwrap();continue
   href=urljoin(url,raw)
   if urlsplit(href).scheme in ('http','https','mailto','tel'):
    attrs.update({'href':href,'target':'_blank','rel':'noopener noreferrer'})
  if t.name=='img':
   src=urljoin(url,t.get('src',''))
   if urlsplit(src).scheme in ('http','https'):attrs={'src':src,'alt':t.get('alt',''),'loading':'lazy'}
  if t.name in ('video','audio','source'):
   src=urljoin(url,t.get('src','')) if t.get('src') else ''
   if src and urlsplit(src).scheme in ('http','https'):attrs['src']=src
   if t.name!='source':
    attrs.update({'controls':'','preload':'none'})
    poster=urljoin(url,t.get('poster','')) if t.get('poster') else ''
    if poster and urlsplit(poster).scheme in ('http','https'):attrs['poster']=poster
   elif t.get('type'):attrs['type']=t['type']
  if t.name in ('td','th'):
   for a in ('colspan','rowspan'):
    if str(t.get(a,'')).isdigit():attrs[a]=t[a]
  if t.name=='th':attrs['scope']='col'
  t.attrs=attrs
 for a in node.select('a'):
  if not a.get_text(strip=True) and not a.find('img'):a.string='Открыть материал'
 return str(node)
def parse_page(item):
 url,title=item
 try:
  soup=BeautifulSoup(fetch(url),'html.parser')
  node=soup.select_one('[itemprop=articleBody]') or soup.select_one('.item-page') or soup.select_one('.blog') or soup.select_one('.category-list') or soup.select_one('div.news')
  if not node:raise ValueError('Не найден блок содержимого')
  if key(url)=='/article/867':
   node=soup.select_one('ul.category-module') or node
  if title=='Специальность':
   heading=soup.select_one('.item-title') or node.select_one('h1,h2');title=heading.get_text(' ',strip=True) if heading else title
  for pager in node.select('.pager,.pagenav'):pager.decompose()
  html=clean(node,url)
  text=BeautifulSoup(html,'html.parser').get_text(' ',strip=True)
  body=BeautifulSoup(html,'html.parser')
  resources=[{'title':a.get_text(' ',strip=True) or 'Открыть документ','url':a['href']} for a in body.select('a[href]') if re.search(r'\.(pdf|docx?|xlsx?|pptx?|zip|rar)(?:$|\?)',a['href'],re.I)]
  resources=list({r['url']:r for r in resources}.values())
  empty=not text and not body.select('img,video,audio,a[href]')
  pending=empty or text=='Раздел находится в разработке'
  return {'key':key(url),'url':url,'title':title or (soup.title.get_text(strip=True) if soup.title else 'Материал'),'html':html,'text':text,'resources':resources,'empty':bool(empty),'pending':bool(pending),'error':None}
 except Exception as e:return {'key':key(url),'url':url,'title':title or 'Материал','html':'','text':'','error':str(e)}
def main():
 home=BeautifulSoup(fetch(BASE+'/'),'html.parser')
 menu=home.select_one('ul#flexmenu');groups=[];seeds={}
 def add(url,title):
  url=urljoin(BASE,url);k=key(url)
  if k and k!='/' and not re.search(r'\.(pdf|docx?|xlsx?|zip|rar|jpg|png|jpeg|mp4)$',urlsplit(url).path,re.I):seeds.setdefault(k,(url,title))
 for li in menu.find_all('li',recursive=False):
  a=li.find('a',recursive=False)
  if not a or key(a.get('href',''))=='/':continue
  links=[]
  for x in li.select('a[href]'):
   name=x.get_text(' ',strip=True);url=urljoin(BASE,x['href']);add(url,name);links.append({'title':name,'url':url,'key':key(url)})
  groups.append({'title':a.get_text(' ',strip=True),'links':links})
 for a in home.select('a[href]'):
  if a.get_text(' ',strip=True) in ['Карта сайта','Время работы','Схема проезда','Цифровая среда','Расписание','Доступная среда','Оставить отзыв об организации','Противодействие коррупции','Все новости']:
   add(a['href'],a.get_text(' ',strip=True))
 news=[]
 for a in home.select('.blog1latestnews4 a'):
  title=a.get_text(' ',strip=True);url=urljoin(BASE,a['href']);parent=a.parent.parent;img=parent.find('img');add(url,title)
  news.append({'title':title,'url':url,'key':key(url),'image':urljoin(BASE,img['src']) if img else ''})
 # Include all program detail pages already linked by the prototype.
 data=(ROOT/'src/data.js').read_text();ids=re.findall(r'course\(\s*(\d+)',data)
 for id in ids:add(BASE+'/?view=article&id='+id,'Специальность')
 forms=[{'title':a.get_text(' ',strip=True),'url':a['href']} for a in home.select('a[href]') if 'forms.yandex.ru/' in a['href']]
 if OUT.exists():
  for previous in json.loads(OUT.read_text()).get('pages',[]):add(previous['url'],previous['title'])
 print('Importing',len(seeds),'navigation pages',flush=True)
 with ThreadPoolExecutor(max_workers=5) as pool:pages=list(pool.map(parse_page,seeds.values()))
 # Follow named article links from core sections, but keep the historical news archive as an index.
 extra={}
 for p in pages:
  if p['key']=='/article/867':continue
  for a in BeautifulSoup(p['html'],'html.parser').select('a[href]'):
   k=key(a['href']);path=urlsplit(a['href']).path
   if k and k not in seeds and k!='/' and (k.startswith('/article/') or (not Path(path).suffix and not path.startswith(('/component/','/images/','/files/')))):
    extra.setdefault(k,(a['href'],a.get_text(' ',strip=True)))
 print('Importing',len(extra),'linked pages',flush=True)
 with ThreadPoolExecutor(max_workers=5) as pool:pages+=list(pool.map(parse_page,extra.values()))
 # Resolve only successfully imported pages locally; documents and external services stay official.
 good={p['key'] for p in pages if not p['error']}
 for p in pages:
  soup=BeautifulSoup(p['html'],'html.parser')
  for a in soup.select('a[href]'):
   k=key(a['href'])
   if k in good and not urlsplit(a['href']).fragment:a['href']='#/page/'+__import__('urllib.parse',fromlist=['quote']).quote(k,safe='');a.attrs.pop('target',None);a.attrs.pop('rel',None)
  p['html']=str(soup)
 archive_soup=BeautifulSoup(fetch(BASE+'/?view=article&id=867&catid=26'),'html.parser')
 archive=[{'key':key(a['href']),'title':a.get_text(' ',strip=True),'url':urljoin(BASE,a['href'])} for a in archive_soup.select('a.mod-articles-category-title')]
 directory=ROOT/'public/content';directory.mkdir(parents=True,exist_ok=True)
 (directory/'search.json').write_text(json.dumps([{'key':p['key'],'title':p['title'],'text':p['text']} for p in pages if p['key']!='/article/867'],ensure_ascii=False))
 for p in pages:
  filename=__import__('hashlib').sha256(p['key'].encode()).hexdigest()[:20]+'.json'
  (directory/filename).write_text(json.dumps(p,ensure_ascii=False))
  p['contentFile']='/content/'+filename
  p.pop('html',None);p.pop('resources',None);p['text']=p['text'][:2000]
 for a in archive:a['url']=BASE+'/?view=article&id='+a['key'].split('/')[-1]+'&catid=26'
 (directory/'archive.json').write_text(json.dumps(archive,ensure_ascii=False))
 result={'archiveCount':len(archive),'updatedAt':datetime.now(timezone.utc).isoformat(),'groups':groups,'news':news,'forms':forms,'pages':pages}
 temp=OUT.with_suffix('.tmp');temp.write_text(json.dumps(result,ensure_ascii=False));temp.replace(OUT)
 print('Saved',len(pages),'pages;',len(good),'with content;',len(pages)-len(good),'source errors',flush=True)
 for p in pages:
  if p['error']:print(p['url'],p['error'])
if __name__=='__main__':
 if len(sys.argv)>1 and sys.argv[1]=='--page':
  print(json.dumps(parse_page((sys.argv[2],sys.argv[3] if len(sys.argv)>3 else '')),ensure_ascii=False))
 else:main()
