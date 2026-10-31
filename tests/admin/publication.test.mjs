import {test} from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {createContext,runInContext} from 'node:vm';
import {planPublication,preparePage} from '../../admin/shared/publication.mjs';import {createGitHub} from '../../admin/worker/github.mjs';import {sha256} from '../../admin/worker/auth.mjs';
const path=new URL('../../',import.meta.url);const read=p=>readFileSync(new URL(p,path),'utf8');
async function fixture(){const db=JSON.parse(read('content/public-posts.json'));const files={'content/public-posts.json':'','site/catalog.js':read('site/catalog.js')};for(const post of db.posts){const p=post.href==='#article'?'site/index.html':'site/'+post.href;files[p]=preparePage(read(p),post.document);post.pageHash=await sha256(files[p]);}files['content/public-posts.json']=JSON.stringify(db);return {db,files};}
test('one edit updates title, body, both TOCs, catalog and all asset cache keys without touching lab',async()=>{
 const {db,files}=await fixture();const old=db.posts.find(p=>p.id==='python-loop-scope');const post={...old,title:'새 제목 😀',summary:'새 요약',document:{version:1,blocks:[{type:'heading',level:2,content:[{type:'text',text:'새 목차'}]},{type:'paragraph',content:[{type:'text',text:'바뀐 본문'}]}]}};
 const changed=await planPublication(files,post,{operationId:'11111111-1111-4111-8111-111111111111',digest:'test',updatedAt:'2026-10-31T00:00:00Z'});const after=Object.fromEntries(changed.map(x=>[x.path,x.content]));
 const html=after['site/posts/python-loop-scope.html'];assert.match(html,/<h1>새 제목 😀<\/h1>/);assert.equal((html.match(/새 목차<\/a>/g)||[]).length,2);assert.match(html,/바뀐 본문/);
 assert.equal(html.slice(html.indexOf('<div id="lab"'),html.indexOf('<div class="article-end"')),files['site/posts/python-loop-scope.html'].slice(files['site/posts/python-loop-scope.html'].indexOf('<div id="lab"'),files['site/posts/python-loop-scope.html'].indexOf('<div class="article-end"')));
 const ctx=createContext({});runInContext(after['site/catalog.js']+';globalThis.rows=BLOG_POSTS',ctx);assert.equal(ctx.rows.find(p=>p.id===post.id).title,post.title);
 const hash=(await sha256('x'));assert.ok(hash);for(const [p,text]of Object.entries(after).filter(([p])=>p.endsWith('.html')))assert.match(text,/catalog.js\?v=[a-f0-9]{12}/);
});
test('arbitrary ID or externally edited public files cannot overwrite a known post',async()=>{
 const {db,files}=await fixture();await assert.rejects(()=>planPublication(files,{...db.posts[0],id:'../../evil'},{}));
 const post=db.posts[0],p='site/index.html';files[p]+='external';await assert.rejects(()=>planPublication(files,post,{}),e=>e.status===409);
});
test('GitHub service rejects old revision and lack of write permission before any write API',async()=>{
 const {files,db}=await fixture();let writes=0;const io=async(url,options={})=>{if(options.method&&options.method!=='GET'){writes++;throw Error('unexpected write');}
 const tail=new URL(url).pathname.replace('/repos/test/blog','');if(tail==='/git/ref/heads/main')return Response.json({object:{sha:'a'.repeat(40)}});if(tail==='/user')return Response.json({id:7});if(tail==='')return Response.json({permissions:{push:false}});
 if(tail.startsWith('/contents/')){const p=decodeURIComponent(tail.slice(10));return Response.json({content:Buffer.from(files[p]||'').toString('base64'),encoding:'base64'});}throw Error('unexpected '+url);};
 const service=createGitHub({REPOSITORY:'test/blog',ALLOWED_USER_ID:'7',PUBLIC_SITE_URL:'https://example.com/'},{fetch:io});
 await assert.rejects(()=>service.publishPost({id:db.posts[0].id,title:'x',summary:'x',document:db.posts[0].document,revision:'wrong',operationId:crypto.randomUUID()},{token:'test',userId:7}),e=>e.status===403||e.status===409);assert.equal(writes,0);
});

async function memoryGitHub(){
 const {files,db}=await fixture();let serial=10;const id=()=>String(serial++).padStart(40,'0');const initial='a'.repeat(40),initialTree='b'.repeat(40);
 const state={head:initial,commits:new Map([[initial,{sha:initial,tree:{sha:initialTree},parents:[],message:'baseline'}]]),trees:new Map([[initialTree,{...files}]]),writes:0,race:false,drop:false,permission:true,conclusion:'success'};
 const fetcher=async(raw,opt={})=>{const url=new URL(raw),p=url.pathname.replace('/repos/test/blog',''),body=opt.body?JSON.parse(opt.body):null;const response=x=>Response.json(x);
 if(body)state.writes++;
 if(p==='/user')return response({id:7});if(p==='')return response({permissions:{push:state.permission}});if(p==='/git/ref/heads/main')return response({object:{sha:state.head}});
 if(p.startsWith('/contents/')){const ref=url.searchParams.get('ref'),path=p.slice(10);return response({encoding:'base64',content:Buffer.from(state.trees.get(state.commits.get(ref).tree.sha)[path]).toString('base64')});}
 if(p==='/commits'){let current=state.head,rows=[];while(current){const c=state.commits.get(current);rows.push({sha:current,commit:{message:c.message.trimEnd()}});current=c.parents[0];}return response(rows);}
 if(p.startsWith('/git/commits/')&&!body)return response(state.commits.get(p.slice(13)));
 if(p==='/git/trees'){const sha=id(),tree={...state.trees.get(body.base_tree)};for(const f of body.tree)tree[f.path]=f.content;state.trees.set(sha,tree);return response({sha});}
 if(p==='/git/commits'){const sha=id();state.commits.set(sha,{sha,tree:{sha:body.tree},parents:body.parents,message:body.message});return response({sha});}
 if(p==='/git/refs/heads/main'){
   assert.equal(body.force,false);
   if(state.race){state.race=false;const old=state.commits.get(state.head),sha=id(),tree=id();state.trees.set(tree,{...state.trees.get(old.tree.sha),'unrelated.txt':'concurrent work'});state.commits.set(sha,{sha,tree:{sha:tree},parents:[state.head],message:'other commit'});state.head=sha;}
   if(!state.commits.get(body.sha).parents.includes(state.head))return new Response('{}',{status:422});state.head=body.sha;if(state.drop){state.drop=false;throw new TypeError('network lost after write');}return response({object:{sha:state.head}});
 }
 if(p==='/actions/runs')return response({workflow_runs:[{path:'.github/workflows/pages.yml',status:'completed',conclusion:state.conclusion}]});
 throw Error('unexpected '+opt.method+' '+raw);
 };
 const service=createGitHub({REPOSITORY:'test/blog',ALLOWED_USER_ID:'7',PUBLIC_SITE_URL:'https://example.com/'},{fetch:fetcher});const auth={token:'test-only-token',userId:7};
 const load=await service.loadPost(db.posts[0].id,auth);const input={id:load.post.id,title:'내가 바꾼 제목',summary:'요약',document:load.post.document,revision:load.revision,operationId:crypto.randomUUID()};return {state,service,auth,input};
}
test('stale revision produces 409 without creating tree or commit',async()=>{const f=await memoryGitHub();await assert.rejects(()=>f.service.publishPost({...f.input,revision:'old'},f.auth),e=>e.status===409);assert.equal(f.state.writes,0);});
test('concurrent unrelated work is preserved and one fast-forward retry is bounded',async()=>{const f=await memoryGitHub();f.state.race=true;const result=await f.service.publishPost(f.input,f.auth);assert.equal(result.commit,f.state.head);const tree=f.state.trees.get(f.state.commits.get(f.state.head).tree.sha);assert.equal(tree['unrelated.txt'],'concurrent work');assert.equal(JSON.parse(tree['content/public-posts.json']).posts[0].title,'내가 바꾼 제목');});
test('retry after lost publish response returns same commit; different payload with same operation is blocked',async()=>{const f=await memoryGitHub();f.state.drop=true;await assert.rejects(()=>f.service.publishPost(f.input,f.auth),e=>e.status===502);const saved=f.state.head,writes=f.state.writes;const result=await f.service.publishPost(f.input,f.auth);assert.equal(result.commit,saved);assert.equal(f.state.writes,writes);await assert.rejects(()=>f.service.publishPost({...f.input,title:'different'},f.auth),e=>e.status===409);});
test('successful commit is not falsely reported as successful Pages deployment',async()=>{const f=await memoryGitHub();const result=await f.service.publishPost(f.input,f.auth);assert.equal(result.status,'saved');f.state.conclusion='failure';assert.deepEqual(await f.service.publicationStatus(result.commit,f.auth),{state:'failed'});f.state.conclusion='success';assert.equal((await f.service.publicationStatus(result.commit,f.auth)).state,'published');});
