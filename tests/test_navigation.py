from html.parser import HTMLParser
from pathlib import Path
import unittest

class Links(HTMLParser):
    def __init__(self):
        super().__init__()
        self.region = None
        self.links = []
    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag in ('aside', 'nav'):
            self.region = tag
        if tag == 'a':
            self.links.append((self.region, attrs))
    def handle_endtag(self, tag):
        if tag in ('aside', 'nav'):
            self.region = None

class NavigationTests(unittest.TestCase):
    def test_article_home_is_first_sidebar_link_not_header_navigation(self):
        parser = Links()
        parser.feed((Path(__file__).resolve().parents[1] / 'site/index.html').read_text())
        sidebar = [attrs for region, attrs in parser.links if region == 'aside']
        self.assertIn('data-home', sidebar[0])
        self.assertFalse(any('data-home' in attrs for region, attrs in parser.links if region == 'nav'))
        self.assertTrue(any(attrs.get('class') == 'mobile-back' and 'data-home' in attrs for _, attrs in parser.links))
