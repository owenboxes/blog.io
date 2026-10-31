import {test} from 'node:test';import assert from 'node:assert/strict';
import {createAuth} from '../../admin/worker/auth.mjs';
const env={ADMIN_ORIGIN:'https://admin.example.workers.dev',GITHUB_CLIENT_ID:'test-client',GITHUB_CLIENT_SECRET:'TEST-ONLY-secret',SESSION_SECRET:'ab'.repeat(32),ALLOWED_USER_ID:'7'};
const req=(path,init={})=>new Request(env.ADMIN_ORIGIN+path,init);
const cookie=(r,name)=>r.headers.getSetCookie().find(x=>x.startsWith(name+'=')).split(';')[0];
async function login({id=7,now={value:1000000}}={}){
 let exchange;const io=async(url,options)=>{if(url==='https://github.com/login/oauth/access_token'){exchange=new URLSearchParams(options.body);return Response.json({access_token:'test-user-token',token_type:'bearer',expires_in:28800});}if(url==='https://api.github.com/user')return Response.json({id});throw Error('unexpected '+url);};
 const auth=createAuth(env,{fetch:io,now:()=>now.value});const start=await auth.start(req('/auth/login?post=python-test'));const location=new URL(start.headers.get('location'));
 const response=await auth.callback(req('/auth/callback?code=test-code&state='+location.searchParams.get('state'),{headers:{cookie:cookie(start,'__Host-editor-oauth')}}));
 return {auth,response,start,exchange,now};
}
test('OAuth uses browser-bound state and PKCE; resulting token is not exposed to JavaScript or redirect URLs',async()=>{
 const {start,response,exchange}=await login();const loc=new URL(start.headers.get('location'));
 assert.equal(loc.searchParams.get('code_challenge_method'),'S256');assert.equal(loc.searchParams.get('code_challenge').length,43);assert.equal(exchange.get('code_verifier').length,43);
 assert.equal(response.headers.get('location'),'/admin?post=python-test');const session=cookie(response,'__Host-editor-session');assert.ok(!session.includes('test-user-token'));
 assert.match(response.headers.getSetCookie().join(' '),/HttpOnly/);assert.match(response.headers.getSetCookie().join(' '),/Secure/);assert.match(response.headers.getSetCookie().join(' '),/SameSite=Lax/);
 assert.ok(!(await response.text()).includes('test-user-token'));
});
test('another GitHub numeric identity cannot obtain an editing session',async()=>{await assert.rejects(()=>login({id:8}),e=>e.status===403);});
test('wrong, expired and tampered OAuth state are rejected',async()=>{
 let time=1000000;const a=createAuth(env,{now:()=>time,fetch:()=>{throw Error('must not reach network');}});const start=await a.start(req('/auth/login'));
 const c=cookie(start,'__Host-editor-oauth');await assert.rejects(()=>a.callback(req('/auth/callback?code=x&state=wrong',{headers:{cookie:c}})),e=>e.status===403);
 time+=601000;await assert.rejects(()=>a.callback(req('/auth/callback?code=x&state=x',{headers:{cookie:c}})),e=>e.status===401);
 await assert.rejects(()=>a.callback(req('/auth/callback?code=x&state=x',{headers:{cookie:c+'tamper'}})),e=>e.status===401);
});
test('session must be valid, unexpired and owner bound; writes additionally require same Origin and CSRF',async()=>{
 const {auth,response,now}=await login();const c=cookie(response,'__Host-editor-session');const owner=await auth.requireOwner(req('/api/posts/python-test',{headers:{cookie:c}}));
 assert.equal(owner.userId,7);await assert.rejects(()=>auth.requireOwner(req('/admin')),e=>e.status===401);
 await assert.rejects(()=>auth.requireWrite(req('/api/posts/python-test/publish',{method:'POST',headers:{cookie:c,origin:'https://evil.example','x-editor-csrf':owner.csrf}})),e=>e.status===403);
 await assert.rejects(()=>auth.requireWrite(req('/auth/logout',{method:'POST',headers:{cookie:c,origin:env.ADMIN_ORIGIN}})),e=>e.status===403);
 const good=req('/auth/logout',{method:'POST',headers:{cookie:c,origin:env.ADMIN_ORIGIN,'x-editor-csrf':owner.csrf}});assert.equal((await auth.requireWrite(good)).userId,7);
 assert.match((await auth.logout(good)).headers.getSetCookie().join(' '),/Max-Age=0/);
 now.value+=3601000;await assert.rejects(()=>auth.requireOwner(req('/admin',{headers:{cookie:c}})),e=>e.status===401);
});
test('unsafe return IDs and malformed configuration fail closed',async()=>{
 const a=createAuth(env);await assert.rejects(()=>a.start(req('/auth/login?post=//evil.example')),e=>e.status===400);
 assert.throws(()=>createAuth({...env,SESSION_SECRET:'short'}));assert.throws(()=>createAuth({...env,ADMIN_ORIGIN:'http://example.com'}));
});
