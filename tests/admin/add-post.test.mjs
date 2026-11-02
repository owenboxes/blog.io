import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {addPost} from '../../admin/add-post.mjs';
import {sha256} from '../../admin/worker/auth.mjs';
const root=fileURLToPath(new URL('../../',import.meta.url));
const draft={id:'test-new-note',title:'새 글 "검증" & <확인>',category:'Python',kind:'practice',date:'2026.11.03',summary:'요약 <b>',lab:'off',labCode:'print(1 < 2)',
 document:{version:1,blocks:[{type:'heading',level:2,content:[{type:'text',text:'첫 소제목'}]},{type:'paragraph',content:[{type:'text',text:'본문'}]}]}};

test('new article is written consistently with the editor publication format',async()=>{
 const changed=Object.fromEntries((await addPost(draft,{now:new Date('2026-11-03T02:00:00.123Z')})).map(x=>[x.path,x.content]));
 const before=JSON.parse(readFileSync(root+'content/public-posts.json','utf8'));
 const db=JSON.parse(changed['content/public-posts.json']);
 assert.equal(db.posts.length,before.posts.length+1);
 const entry=db.posts.at(-1),page=changed['site/posts/test-new-note.html'];
 assert.equal(entry.href,'posts/test-new-note.html');assert.equal(entry.publishedAt,'2026-11-03T02:00:00Z');assert.equal(entry.published,true);
 assert.equal(entry.sequence,Math.max(...before.posts.map(p=>p.sequence||0))+1);
 for(const p of db.posts){const path=p.href==='#article'?'site/index.html':'site/'+p.href;assert.equal(await sha256(changed[path]),p.pageHash,p.id);}
 assert.match(page,/<body data-site-root="\.\.\/" data-post-id="test-new-note" data-lab="off">/);
 assert.match(page,/Python · PRACTICE<span class="article-date">2026\.11\.03/);
 assert.match(page,/<title>새 글 &quot;검증&quot; &amp; &lt;확인&gt; — OWEN<\/title>/);
 assert.match(page,/>print\(1 &lt; 2\)<\/textarea>/);
 assert.match(page,/<a href="#section-1">첫 소제목<\/a>/);
 assert.ok(changed['site/catalog.js'].includes('"id":"test-new-note"'));
 assert.ok(!changed['site/catalog.js'].includes('"document"'),'catalog must not expose article bodies');
});

test('replacement tokens in draft text are inserted literally',async()=>{
 const changed=await addPost({...draft,category:'$& $` $\'',labCode:'$&'});
 const page=changed.find(x=>x.path==='site/posts/test-new-note.html').content;
 assert.match(page,/<div class="post-meta">\$&amp; \$` \$&#39; · PRACTICE<span class="article-date">2026\.11\.03<\/span><\/div>/);
 assert.match(page,/>\$&amp;<\/textarea>/);
});

test('invalid or duplicate drafts are rejected before anything is written',async()=>{
 await assert.rejects(addPost({...draft,id:'python-loop-scope'}),/already exists/);
 await assert.rejects(addPost({...draft,id:'../escape'}),/id must be/);
 await assert.rejects(addPost({...draft,kind:'draft'}),/kind/);
 await assert.rejects(addPost({...draft,date:'2026-11-03'}),/date/);
 await assert.rejects(addPost({...draft,document:{version:1,blocks:[{type:'html',text:'<script>'}]}}));
});
