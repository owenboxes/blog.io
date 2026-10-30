from html.parser import HTMLParser
from pathlib import Path
import unittest
from urllib.parse import urljoin

ROOT = Path(__file__).resolve().parents[1]

class Assets(HTMLParser):
    def __init__(self):
        super().__init__()
        self.scripts = []
    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == 'script' and 'src' in attrs:
            self.scripts.append(attrs['src'])

class StaticDeploymentTests(unittest.TestCase):
    def test_isolation_bootstrap_precedes_application_and_stays_in_project_scope(self):
        doc = Assets()
        doc.feed((ROOT / 'site/index.html').read_text())
        self.assertIn('coi-serviceworker.js', doc.scripts)
        self.assertLess(doc.scripts.index('coi-serviceworker.js'), doc.scripts.index('app.js'))
        for script in doc.scripts:
            self.assertTrue((ROOT / 'site' / script).is_file())
            self.assertTrue(urljoin('https://owenboxes.github.io/blog.io/', script).startswith('https://owenboxes.github.io/blog.io/'))
