import {test} from 'node:test';import assert from 'node:assert/strict';import {execFileSync} from 'node:child_process';import {readFileSync} from 'node:fs';import {fileURLToPath,pathToFileURL} from 'node:url';
import {createHandler} from '../../admin/worker/index.mjs';
const root=fileURLToPath(new URL('../../',import.meta.url));const env={ADMIN_ORIGIN:'https://admin.example.workers.dev',GITHUB_CLIENT_ID:'TEST-CLIENT',GITHUB_CLIENT_SECRET:'TEST-SECRET-DO-NOT-PUBLISH',SESSION_SECRET:'a1'.repeat(32),ALLOWED_USER_ID:'7',REPOSITORY:'test/blog',PUBLIC_SITE_URL:'https://example.com/'};
test('anonymous API writes and editor access cannot bypass authentication',async()=>{
 const handler=createHandler({'/assets/editor.js':{body:'test',type:'text/javascript'}},{fetch:()=>{throw Error('must not call network');}});
 const r=await handler(new Request(env.ADMIN_ORIGIN+'/api/posts/known/publish',{method:'POST',headers:{origin:env.ADMIN_ORIGIN,'Content-Type':'application/json'},body:'{}'}),env);assert.equal(r.status,401);
 const page=await handler(new Request(env.ADMIN_ORIGIN+'/admin?post=known'),env);const text=await page.text();assert.match(text,/GitHub/);assert.ok(!text.includes('id="workspace"'));assert.ok(!text.includes(env.GITHUB_CLIENT_SECRET));
 const bad=await handler(new Request(env.ADMIN_ORIGIN+'/api/session'),{...env,SESSION_SECRET:''});assert.equal(bad.status,503);
});
test('Worker bundle is importable and health checks do not expose credentials',async()=>{
 execFileSync(process.execPath,['admin/build.mjs'],{cwd:root});const source=readFileSync(root+'admin/dist/worker.mjs','utf8');assert.ok(!source.includes(env.GITHUB_CLIENT_SECRET));
 const worker=(await import(pathToFileURL(root+'admin/dist/worker.mjs').href+'?test='+Date.now())).default;const r=await worker.fetch(new Request(env.ADMIN_ORIGIN+'/health'),env);assert.equal(r.status,200);assert.deepEqual(await r.json(),{status:'ready'});
 const anonymous=await worker.fetch(new Request(env.ADMIN_ORIGIN+'/admin?post=known'),env);const login=await anonymous.text();assert.ok(!login.includes('id="workspace"'));assert.match(login,/GitHub로 로그인/);
 const js=await worker.fetch(new Request(env.ADMIN_ORIGIN+'/assets/editor.js'),env);assert.equal(js.status,200);assert.match(js.headers.get('content-type'),/javascript/);
});
test('prepared pages retain a runner and resolve owner edit links without changing code execution',()=>{
 const count=JSON.parse(readFileSync(root+'content/public-posts.json','utf8')).posts.length;
 const result=JSON.parse(execFileSync(process.execPath,['admin/prepare.mjs','--check'],{cwd:root,encoding:'utf8'}));assert.equal(result.pages,count);assert.equal(result.labPreserved,count);assert.equal(result.links,count);
});
