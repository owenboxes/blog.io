"""Build the deployable Pages copy of site/ with search and sharing metadata.

The committed pages stay byte-for-byte unchanged so the owner editor's pageHash
checks keep working. Metadata is generated from content/public-posts.json at
deploy time, so an editor publish (push to main) refreshes it automatically.

Usage: python3 tools/build_pages.py site _site [--base-url URL]
"""
from datetime import datetime, timezone
from email.utils import format_datetime
from html import escape, unescape
from pathlib import Path
from xml.sax.saxutils import escape as xml_escape
import argparse
import json
import re
import shutil

ROOT = Path(__file__).resolve().parents[1]
BASE_URL = 'https://owenboxes.github.io/blog.io/'
SITE_NAME = 'OWEN — Build Notes'
AUTHOR = '문영성'
OG_IMAGE = 'og-image.png'
MARKER = '<!-- pages-meta -->'


def parse_time(value):
    return datetime.fromisoformat(value.replace('Z', '+00:00')).astimezone(timezone.utc)


def page_url(base, post):
    return base if post['href'] == '#article' else base + post['href']


def meta_block(base, *, title, description, url, kind, post=None):
    tags = [
        ('link', {'rel': 'canonical', 'href': url}),
        ('link', {'rel': 'icon', 'href': base + 'favicon.svg', 'type': 'image/svg+xml'}),
        ('link', {'rel': 'alternate', 'type': 'application/rss+xml', 'title': SITE_NAME, 'href': base + 'feed.xml'}),
        ('meta', {'property': 'og:type', 'content': kind}),
        ('meta', {'property': 'og:site_name', 'content': SITE_NAME}),
        ('meta', {'property': 'og:locale', 'content': 'ko_KR'}),
        ('meta', {'property': 'og:title', 'content': title}),
        ('meta', {'property': 'og:description', 'content': description}),
        ('meta', {'property': 'og:url', 'content': url}),
        ('meta', {'property': 'og:image', 'content': base + OG_IMAGE}),
        ('meta', {'property': 'og:image:width', 'content': '1200'}),
        ('meta', {'property': 'og:image:height', 'content': '630'}),
        ('meta', {'name': 'twitter:card', 'content': 'summary_large_image'}),
    ]
    if post:
        tags.append(('meta', {'property': 'article:published_time', 'content': post['publishedAt']}))
        if post.get('updatedAt'):
            tags.append(('meta', {'property': 'article:modified_time', 'content': post['updatedAt']}))
        tags.append(('meta', {'property': 'article:section', 'content': post['category']}))
    html = [MARKER]
    for tag, attrs in tags:
        html.append('<' + tag + ''.join(' %s="%s"' % (k, escape(v)) for k, v in attrs.items()) + '>')
    if post:
        data = {
            '@context': 'https://schema.org', '@type': 'BlogPosting', 'headline': title,
            'description': description, 'url': url, 'image': base + OG_IMAGE, 'inLanguage': 'ko',
            'datePublished': post['publishedAt'], 'dateModified': post.get('updatedAt') or post['publishedAt'],
            'author': {'@type': 'Person', 'name': AUTHOR},
        }
        # Escaping "<" keeps article text from closing the script element.
        html.append('<script type="application/ld+json">' + json.dumps(data, ensure_ascii=False).replace('<', '\\u003c') + '</script>')
    return '\n'.join(html) + '\n'


def inject(page, block):
    if page.count('</head>') != 1 or 'property="og:' in page or MARKER in page:
        raise ValueError('unexpected head structure')
    return page.replace('</head>', block + '</head>')


def site_description(index_html):
    match = re.search(r'<meta name="description" content="([^"]*)">', index_html)
    if not match:
        raise ValueError('index.html needs a meta description')
    # Decode attribute entities so each output format escapes the plain text once.
    return unescape(match.group(1))


def feed(base, description, posts):
    items = []
    for p in posts:
        url = xml_escape(page_url(base, p))
        items.append(
            '<item><title>%s</title><link>%s</link><guid isPermaLink="true">%s</guid>'
            '<pubDate>%s</pubDate><category>%s</category><description>%s</description></item>'
            % (xml_escape(p['title']), url, url, format_datetime(parse_time(p['publishedAt'])),
               xml_escape(p['category']), xml_escape(p['summary'])))
    return ('<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0"><channel>'
            '<title>%s</title><link>%s</link><description>%s</description><language>ko</language>\n%s\n</channel></rss>\n'
            % (xml_escape(SITE_NAME), xml_escape(base), description, '\n'.join(items)))


def sitemap(base, posts):
    rows = ['<url><loc>%s</loc></url>' % xml_escape(base)]
    for p in posts:
        lastmod = parse_time(p.get('updatedAt') or p['publishedAt']).date().isoformat()
        rows.append('<url><loc>%s</loc><lastmod>%s</lastmod></url>' % (xml_escape(page_url(base, p)), lastmod))
    return ('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
            + '\n'.join(rows) + '\n</urlset>\n')


def not_found(base):
    # Served for any missing path, so every link is absolute.
    return '''<!doctype html>
<html lang="ko">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>페이지를 찾을 수 없습니다 — OWEN</title>
<link rel="icon" href="{base}favicon.svg" type="image/svg+xml">
<style>
body{{margin:0;min-height:100vh;display:grid;place-items:center;background:#f7f4ed;color:#2d302c;font:16px/1.8 'Noto Sans KR',system-ui,sans-serif;text-align:center;padding:24px;box-sizing:border-box}}
p.code{{font:13px 'IBM Plex Mono',ui-monospace,monospace;letter-spacing:.2em;color:#9d5138;margin:0}}
h1{{font-size:28px;margin:12px 0 8px}}p{{color:#77786e;margin:0 0 28px}}
a{{color:#2d302c;border-bottom:1px solid #9d5138;text-decoration:none}}
</style>
</head>
<body><main><p class="code">404 · NOT FOUND</p><h1>페이지를 찾을 수 없습니다</h1><p>주소가 바뀌었거나 아직 공개되지 않은 글입니다.</p><a href="{base}">← 글 목록으로</a></main></body>
</html>
'''.format(base=escape(base))


def build(site, out, base=BASE_URL):
    site, out = Path(site), Path(out)
    if not base.startswith('https://') or not base.endswith('/'):
        raise ValueError('base URL must be https:// and end with /')
    if out.exists() and any(out.iterdir()):
        raise ValueError('output directory must be empty')
    db = json.loads((ROOT / 'content/public-posts.json').read_text())
    posts = [p for p in db['posts'] if p.get('published')]
    articles = sorted((p for p in posts if p['href'] != '#article' and not p.get('sample')),
                      key=lambda p: (p['publishedAt'], p.get('sequence', 0)), reverse=True)
    shutil.copytree(site, out, dirs_exist_ok=True)

    catalogued = {out / p['href'] for p in articles}
    stray = set((out / 'posts').glob('*.html')) - catalogued
    if stray:
        raise ValueError('pages missing from content/public-posts.json: ' + ', '.join(sorted(p.name for p in stray)))

    index = out / 'index.html'
    description = site_description(index.read_text())
    index.write_text(inject(index.read_text(), meta_block(
        base, title=SITE_NAME, description=description, url=base, kind='website')))
    for p in articles:
        path = out / p['href']
        path.write_text(inject(path.read_text(), meta_block(
            base, title=p['title'], description=p['summary'], url=page_url(base, p), kind='article', post=p)))

    (out / 'feed.xml').write_text(feed(base, xml_escape(description), articles))
    (out / 'sitemap.xml').write_text(sitemap(base, articles))
    (out / '404.html').write_text(not_found(base))
    return articles


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument('site')
    parser.add_argument('out')
    parser.add_argument('--base-url', default=BASE_URL)
    args = parser.parse_args()
    built = build(args.site, args.out, args.base_url)
    print('Built %d articles with metadata, feed.xml, sitemap.xml and 404.html.' % len(built))
