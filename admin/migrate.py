"""Strict one-time import of existing PUBLIC articles; never imports Notion."""
from html.parser import HTMLParser
from pathlib import Path
import json, re, sys

class Node:
    def __init__(self, tag='', attrs=None):
        self.tag, self.attrs, self.children = tag, dict(attrs or []), []
    def all(self, predicate):
        result = [self] if predicate(self) else []
        for c in self.children:
            if isinstance(c, Node): result += c.all(predicate)
        return result
    def text(self): return ''.join(c.text() if isinstance(c, Node) else c for c in self.children)

class Parser(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.root = Node(); self.stack = [self.root]
    def handle_starttag(self, tag, attrs):
        n = Node(tag, attrs); self.stack[-1].children.append(n)
        if tag not in {'br','input','meta','link','img','hr'}: self.stack.append(n)
    def handle_endtag(self, tag):
        for i in range(len(self.stack)-1, 0, -1):
            if self.stack[i].tag == tag:
                self.stack = self.stack[:i]; return
    def handle_data(self, data): self.stack[-1].children.append(data)

def parse(html):
    p=Parser();p.feed(html);return p.root
def cls(n, value): return value in n.attrs.get('class','').split()
def inline(nodes):
    result=[]
    for n in nodes:
        if isinstance(n,str):
            if n: result.append({'type':'text','text':n})
        elif n.tag=='br':result.append({'type':'lineBreak'})
        elif n.tag=='code':result.append({'type':'code','text':n.text()})
        elif n.tag in {'strong','b','em','i','a'}:
            item={'type':{'strong':'strong','b':'strong','em':'emphasis','i':'emphasis','a':'link'}[n.tag],'content':inline(n.children)}
            if n.tag=='a':item['href']=n.attrs['href']
            result.append(item)
        else:raise ValueError('Unsupported inline '+n.tag)
    return result
def blocks(nodes):
    out=[]
    for n in nodes:
        if isinstance(n,str):
            if n.strip():raise ValueError('Unexpected loose text '+n[:40])
            continue
        if n.attrs.get('id')=='lab':continue
        if n.tag=='section':out+=blocks(n.children)
        elif n.tag in {'h2','h3','h4','p','blockquote'}:
            b={'type':{'p':'paragraph','blockquote':'quote'}.get(n.tag,'heading'),'content':inline(n.children)}
            if b['type']=='heading':b['level']=int(n.tag[1])
            if cls(n,'section-kicker'):b['role']='kicker'
            out.append(b)
        elif cls(n,'static-code'):
            pre=n.all(lambda x:x.tag=='pre')[0]
            header=next(x for x in n.children if isinstance(x,Node) and x.tag=='div')
            labels=header.all(lambda x:x.tag=='span')
            language=''.join(x for x in header.children if isinstance(x,str)).strip()
            b={'type':'code','text':pre.text(),'language':language}
            if labels:b['label']=labels[0].text()
            out.append(b)
        elif cls(n,'table-scroll'):
            out+=blocks([n.all(lambda x:x.tag=='table')[0]])
        elif n.tag=='table':
            rows=n.all(lambda x:x.tag=='tr');data=[]
            for row in rows:
                data.append([inline(x.children) for x in row.children if isinstance(x,Node) and x.tag in {'td','th'}])
            out.append({'type':'table','header':bool(rows[0].all(lambda x:x.tag=='th')),'rows':data})
        elif n.tag in {'ol','ul'}:
            out.append({'type':'list','ordered':n.tag=='ol','items':[inline(x.children) for x in n.children if isinstance(x,Node) and x.tag=='li']})
        elif cls(n,'value-strip'):
            items=[]
            for x in n.children:
                if isinstance(x,Node) and x.tag=='div':items.append({'label':x.all(lambda y:y.tag=='small')[0].text(),'value':x.all(lambda y:y.tag=='b')[0].text()})
            out.append({'type':'steps','items':items})
        else:raise ValueError('Unsupported block '+n.tag+' '+str(n.attrs))
    return out
def semantic(root):
    def walk(n):
        if isinstance(n,str):return [n]
        if n.attrs.get('id')=='lab':return []
        # Arrows are layout, not editable text; renderer restores them.
        return sum((walk(c) for c in n.children),[])
    return re.sub(r'\s+',' ',' '.join(walk(root))).strip()
def migrate(rootdir):
    catalog=(rootdir/'site/catalog.js').read_text()
    start=catalog.index('const BLOG_POSTS = ')+len('const BLOG_POSTS = ')
    # Legacy first row uses JS literal syntax: ask the exact catalog module in Node to serialize it.
    import subprocess,os
    node=os.environ.get('EDITOR_NODE','node')
    entries=json.loads(subprocess.check_output([node,'-e',catalog+';process.stdout.write(JSON.stringify(BLOG_POSTS));'],text=True))
    out=[]
    for entry in entries:
        path='site/index.html' if entry['id']=='loop-demo' else 'site/'+entry['href']
        html=(rootdir/path).read_text(); article=parse(html).all(lambda n:n.attrs.get('id')=='article')[0]
        sections=[n for n in article.children if isinstance(n,Node) and n.tag=='section']
        wrapper=Node();wrapper.children=sections
        post={**entry,'document':{'version':1,'blocks':blocks(sections)},'originalText':semantic(wrapper),'path':path}
        out.append(post)
    return {'version':1,'posts':out}
if __name__=='__main__':
    if '--text' in sys.argv:sys.stdout.write(semantic(parse(sys.stdin.read())))
    elif '--fragment' in sys.argv:print(json.dumps(blocks(parse(sys.stdin.read()).children),ensure_ascii=False))
    else:
        data=migrate(Path(__file__).resolve().parents[1])
        print(json.dumps(data,ensure_ascii=False,indent=2))
