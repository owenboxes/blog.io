const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const file = path.join(__dirname, '../site/catalog.js');
const context = vm.createContext({});
vm.runInContext(fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '', context);
assert.equal(vm.runInContext('typeof catalogModel', context), 'function', 'published catalog model must exist');
const model = vm.runInContext('catalogModel', context);
const rows = [
  {id:'old',title:'Old',category:'Python',kind:'note',published:true,publishedAt:'2026-10-29T10:00:00Z',sequence:1,href:'#article'},
  {id:'new',title:'New',category:'Git',kind:'practice',published:true,publishedAt:'2026-10-30T10:00:00Z',sequence:2,href:'posts/new.html'},
  {id:'draft',title:'Private',category:'Python',kind:'note',published:false,publishedAt:'2026-10-31T10:00:00Z',href:'draft.html'},
  {id:'unsafe',title:'Unsafe',category:'Python',kind:'note',published:true,publishedAt:'2026-10-31T10:00:00Z',href:'javascript:alert(1)'},
  {id:'external',title:'External',category:'Python',kind:'note',published:true,publishedAt:'2026-10-31T10:00:00Z',href:'//evil.example'},
  {id:'date',title:'Bad date',category:'Git',kind:'note',published:true,publishedAt:'unknown',href:'#article'}, null
];
const before = JSON.stringify(rows);
const result = model(rows);
assert.equal(JSON.stringify(result.posts.map(x=>x.id)), '["new","old"]');
assert.equal(result.latest.id, 'new');
assert.equal(JSON.stringify(result.groups.map(x=>x.category)), '["Git","Python"]');
assert.equal(JSON.stringify(model(rows, 'note').posts.map(x=>x.id)), '["old"]');
assert.equal(JSON.stringify(model(rows, 'practice').posts.map(x=>x.id)), '["new"]');
assert.equal(model([], 'practice').latest, null);
assert.equal(model([]).groups.length, 0);
assert.equal(JSON.stringify(rows), before, 'sorting must not mutate source');
const ties = rows.slice(0,2).map(x=>({...x,publishedAt:'2026-10-30T10:00:00Z'}));
assert.equal(model(ties).posts[0].id, 'new', 'registration sequence breaks timestamp ties');
console.log('Catalog: publication gate, order, groups, filters, links, empty states PASS');

// DOM is the external boundary; keep rendered content and event handlers observable.
class Element {
  constructor(tag) { this.tagName=tag; this.children=[]; this.dataset={}; this.attrs={}; this.events={}; this.hidden=false; this.text=''; }
  set textContent(text) { this.text=String(text); this.children=[]; }
  get textContent() { return this.text + this.children.map(x=>x.textContent).join(''); }
  append(...nodes) { this.children.push(...nodes); }
  replaceChildren(...nodes) { this.text=''; this.children=nodes; }
  setAttribute(key,value) { this.attrs[key]=value; }
  addEventListener(type,fn) { this.events[type]=fn; }
}
const ids = Object.fromEntries(['published-posts','mobile-published-posts','published-count','latest-note','post-groups','category-index'].map(id=>[id,new Element('div')]));
const filters = ['all','note','practice'].map(kind=>{const e=new Element('button');e.dataset.postKind=kind;return e;});
const doc = {getElementById:id=>ids[id],createElement:tag=>new Element(tag),querySelectorAll:selector=>selector==='[data-post-kind]'?filters:ids['category-index'].children};
let opened=0;
const render=vm.runInContext('renderCatalog',context);
render(doc,rows,()=>opened++);
assert.equal(ids['published-posts'].children.length,2);
assert.equal(ids['mobile-published-posts'].children.length,2);
assert.equal(ids['published-posts'].children[0].href,'posts/new.html');
assert.ok(!ids['post-groups'].textContent.includes('Private'));
assert.ok(ids['latest-note'].textContent.includes('Old'), 'latest note must not be replaced by a practice');
assert.equal(ids['post-groups'].children[0].id,'category-0','topic links must resolve to rendered groups');
filters[1].events.click();
assert.equal(ids['post-groups'].children.length,1);
assert.ok(ids['post-groups'].textContent.includes('Old'));
assert.equal(filters[1].attrs['aria-pressed'],'true');
ids['published-posts'].children[1].events.click({preventDefault(){}});
assert.equal(opened,1,'sidebar article opens the article view');
render(doc,[],()=>{});
assert.ok(ids['post-groups'].textContent.includes('아직 공개된 글이 없습니다.'));
console.log('Catalog DOM: sidebar/list rendering, topic targets, filters, navigation, empty states PASS');

doc.body={dataset:{siteRoot:'../',postId:'new'}};
render(doc,rows,()=>{throw Error('nested page must not open its own body as the demo');});
assert.equal(ids['published-posts'].children[0].href,'../posts/new.html');
assert.equal(ids['published-posts'].children[0].attrs['aria-current'],'page');
assert.equal(ids['published-posts'].children[1].href,'../index.html#article');
assert.ok(!ids['published-posts'].children[1].attrs['aria-current']);
console.log('Nested article navigation resolves site-root links and current page PASS');
