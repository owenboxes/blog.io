from html.parser import HTMLParser
from pathlib import Path
import unittest
from urllib.parse import urljoin, urlsplit, parse_qs
import hashlib

ROOT = Path(__file__).resolve().parents[1]

class Assets(HTMLParser):
    def __init__(self):
        super().__init__()
        self.scripts = []
        self.styles = []
    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == 'script' and 'src' in attrs:
            self.scripts.append(attrs['src'])
        if tag == 'link' and attrs.get('rel') == 'stylesheet':
            self.styles.append(attrs['href'])

class StaticDeploymentTests(unittest.TestCase):
    def test_isolation_bootstrap_precedes_application_and_stays_in_project_scope(self):
        doc = Assets()
        doc.feed((ROOT / 'site/index.html').read_text())
        self.assertIn('coi-serviceworker.js', doc.scripts)
        paths = [urlsplit(src).path for src in doc.scripts]
        self.assertLess(paths.index('coi-serviceworker.js'), paths.index('app.js'))
        for script in doc.scripts:
            self.assertTrue((ROOT / 'site' / urlsplit(script).path).is_file())
            self.assertTrue(urljoin('https://owenboxes.github.io/blog.io/', script).startswith('https://owenboxes.github.io/blog.io/'))

    def test_changed_ui_assets_have_content_specific_cache_keys(self):
        # A stale app.js references the removed #open-article element and crashes.
        # A content-derived URL prevents old cache entries from serving that code.
        doc = Assets()
        doc.feed((ROOT / 'site/index.html').read_text())
        for name in ('app.js', 'catalog.js', 'style.css'):
            with self.subTest(asset=name):
                url = next(src for src in doc.scripts + doc.styles if urlsplit(src).path == name)
                digest = hashlib.sha256((ROOT / 'site' / name).read_bytes()).hexdigest()[:12]
                self.assertEqual(parse_qs(urlsplit(url).query).get('v'), [digest])

