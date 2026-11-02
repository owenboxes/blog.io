from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlsplit
import json
import re
import unittest

ROOT=Path(__file__).resolve().parents[1]/'site'
POSTS=json.loads((ROOT.parent/'content/public-posts.json').read_text())['posts']

class Page(HTMLParser):
    def __init__(self):
        super().__init__(); self.ids=set(); self.links=[]; self.scripts=[]; self.body={}; self.in_title=False; self.before_body=[]
    def handle_starttag(self,tag,attrs):
        a=dict(attrs)
        if 'id' in a: self.ids.add(a['id'])
        if tag=='a': self.links.append(a.get('href',''))
        if tag=='script' and 'src' in a: self.scripts.append(a['src'])
        if tag=='body': self.body=a
        if tag=='title': self.in_title=True
    def handle_endtag(self,tag):
        if tag=='title': self.in_title=False
    def handle_data(self,data):
        if not self.body and not self.in_title and data.strip(): self.before_body.append(data.strip())

class PublicationTests(unittest.TestCase):
    def test_catalogued_pages_are_public_and_have_working_local_targets(self):
        files=sorted((ROOT/'posts').glob('*.html'))
        catalogued=sorted(ROOT/p['href'] for p in POSTS if p.get('published') and p['href'].startswith('posts/'))
        self.assertEqual(files,catalogued,'every public page needs a published content/public-posts.json entry')
        for f in files:
            with self.subTest(page=f.name):
                text=f.read_text(); doc=Page();doc.feed(text)
                self.assertEqual(doc.body.get('data-site-root'),'../')
                self.assertTrue(doc.body.get('data-post-id'))
                self.assertEqual(doc.before_body,[], 'description metadata leaked text before the page body')
                for src in doc.scripts: self.assertTrue((f.parent/urlsplit(src).path).is_file(),src)
                for href in doc.links:
                    if href.startswith('#') and href not in ('#','#notes'):
                        self.assertIn(href[1:],doc.ids,href)
                for private in ('app.notion.com','notion-file-block:','collection://','검토 정보','승인 대기','내부 출처','/Users/','sk-proj-'):
                    self.assertNotIn(private,text)
                self.assertFalse(re.search(r'[0-9a-f]{32}',text),'private opaque ID leaked')
                self.assertIn('id="editor"',text)
    def test_git_practice_cannot_be_mistaken_for_web_python(self):
        files=list((ROOT/'posts').glob('practice-git-*.html'))
        self.assertGreaterEqual(len(files),2)
        for f in files:
            text=f.read_text()
            self.assertIn('data-lab="off"',text)
            self.assertIn('PC 터미널',text)
