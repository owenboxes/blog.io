from html.parser import HTMLParser
from pathlib import Path
import importlib.util
import json
import tempfile
import unittest
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('build_pages', ROOT / 'tools/build_pages.py')
build_pages = importlib.util.module_from_spec(spec)
spec.loader.exec_module(build_pages)
BASE = build_pages.BASE_URL


class Head(HTMLParser):
    def __init__(self):
        super().__init__()
        self.meta, self.links, self.ld = {}, {}, []
        self._in_ld = False
    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == 'meta' and 'property' in attrs:
            self.meta.setdefault(attrs['property'], attrs['content'])
        if tag == 'link':
            self.links.setdefault(attrs['rel'], attrs['href'])
        self._in_ld = tag == 'script' and attrs.get('type') == 'application/ld+json'
    def handle_data(self, data):
        if self._in_ld:
            self.ld.append(json.loads(data))
    def handle_endtag(self, tag):
        self._in_ld = False


def head(path):
    parser = Head()
    parser.feed(path.read_text())
    return parser


class BuildPagesTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tmp = tempfile.TemporaryDirectory()
        cls.out = Path(cls.tmp.name) / 'out'
        cls.articles = build_pages.build(ROOT / 'site', cls.out)
        cls.db = json.loads((ROOT / 'content/public-posts.json').read_text())

    @classmethod
    def tearDownClass(cls):
        cls.tmp.cleanup()

    def test_source_pages_are_not_modified(self):
        self.assertNotIn(build_pages.MARKER, (ROOT / 'site/index.html').read_text())
        for page in (ROOT / 'site/posts').glob('*.html'):
            self.assertNotIn(build_pages.MARKER, page.read_text())

    def test_every_article_has_its_own_sharing_metadata(self):
        expected = [p for p in self.db['posts'] if p['href'].startswith('posts/') and p.get('published')]
        self.assertEqual(len(self.articles), len(expected))
        for post in expected:
            with self.subTest(post=post['id']):
                h = head(self.out / post['href'])
                url = BASE + post['href']
                self.assertEqual(h.links['canonical'], url)
                self.assertEqual(h.meta['og:url'], url)
                self.assertEqual(h.meta['og:title'], post['title'])
                self.assertEqual(h.meta['og:description'], post['summary'])
                self.assertEqual(h.meta['og:type'], 'article')
                self.assertEqual(h.meta['og:image'], BASE + 'og-image.png')
                self.assertEqual(h.ld[0]['headline'], post['title'])

    def test_home_is_a_website_with_canonical_root(self):
        h = head(self.out / 'index.html')
        self.assertEqual(h.links['canonical'], BASE)
        self.assertEqual(h.meta['og:type'], 'website')
        self.assertEqual(h.ld, [])

    def test_linked_assets_exist(self):
        for name in ('og-image.png', 'favicon.svg', 'feed.xml', 'sitemap.xml', '404.html'):
            self.assertTrue((self.out / name).is_file(), name)

    def test_feed_and_sitemap_are_valid_xml_and_skip_the_sample(self):
        items = ET.parse(self.out / 'feed.xml').findall('./channel/item')
        self.assertEqual(len(items), len(self.articles))
        self.assertNotIn(BASE, [i.findtext('link') for i in items])
        ns = {'s': 'http://www.sitemaps.org/schemas/sitemap/0.9'}
        locs = [e.text for e in ET.parse(self.out / 'sitemap.xml').findall('s:url/s:loc', ns)]
        self.assertEqual(locs[0], BASE)
        self.assertEqual(len(locs), len(self.articles) + 1)

    def test_not_found_page_uses_absolute_links(self):
        page = (self.out / '404.html').read_text()
        self.assertIn('href="' + BASE + '"', page)
        self.assertIn('noindex', page)

    def test_rejects_uncatalogued_page_and_double_injection(self):
        with tempfile.TemporaryDirectory() as tmp:
            site = Path(tmp) / 'site'
            (site / 'posts').mkdir(parents=True)
            (site / 'index.html').write_text('<head><meta name="description" content="x"></head>')
            (site / 'posts/private-draft.html').write_text('<head></head>')
            with self.assertRaisesRegex(ValueError, 'private-draft'):
                build_pages.build(site, Path(tmp) / 'out')
        with self.assertRaises(ValueError):
            build_pages.inject('<head>' + build_pages.MARKER + '</head>', 'x')

    def test_site_description_is_decoded_before_reescaping(self):
        self.assertEqual(build_pages.site_description('<meta name="description" content="A &amp; B &quot;q&quot;">'), 'A & B "q"')

    def test_metadata_escapes_quotes_and_script_breakout(self):
        post = {'href': 'posts/x.html', 'publishedAt': '2026-10-31T00:00:00Z', 'category': 'A'}
        block = build_pages.meta_block(BASE, title='"</script><x>', description='a"b', url=BASE, kind='article', post=post)
        self.assertNotIn('</script><x>', block)
        self.assertIn('content="a&quot;b"', block)


if __name__ == '__main__':
    unittest.main()
