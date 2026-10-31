import {createAuth,HttpError,secureHeaders,validId} from './auth.mjs';
import {createGitHub} from './github.mjs';
import {escapeHTML} from '../shared/document.mjs';
async function readJSON(request){if((request.headers.get('content-type')||'').split(';')[0]!=='application/json')throw new HttpError(415,'JSON 요청이 필요합니다.');if(Number(request.headers.get('content-length'))>300000)throw new HttpError(413,'요청이 너무 큽니다.');const reader=request.body?.getReader();if(!reader)throw new HttpError(400,'요청 내용이 없습니다.');const parts=[];let length=0;try{for(;;){const {done,value}=await reader.read();if(done)break;length+=value.length;if(length>300000){await reader.cancel();throw new HttpError(413,'요청이 너무 큽니다.');}parts.push(value);}}finally{reader.releaseLock();}const bytes=new Uint8Array(length);let i=0;for(const p of parts){bytes.set(p,i);i+=p.length;}try{return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));}catch{throw new HttpError(400,'요청 형식이 잘못됐습니다.');}}
export function createHandler(assets,io={}){
 return async(request,env)=>{let auth;const url=new URL(request.url),path=url.pathname;
  try{
   if(path==='/health'){try{createAuth(env,io);createGitHub(env,io);return Response.json({status:'ready'},{headers:secureHeaders});}catch{return Response.json({status:'needs_setup'},{status:503,headers:secureHeaders});}}
   auth=createAuth(env,io);const github=createGitHub(env,io);const json=value=>Response.json(value,{headers:secureHeaders});
   if(path==='/'&&request.method==='GET')return new Response(null,{status:302,headers:{...secureHeaders,Location:'/admin'}});
   if(path.startsWith('/assets/')&&assets[path]&&request.method==='GET')return new Response(assets[path].body,{headers:{...secureHeaders,'Content-Type':assets[path].type+'; charset=utf-8'}});
   if(path==='/auth/login'&&request.method==='GET')return auth.start(request);
   if(path==='/auth/callback'&&request.method==='GET')return await auth.callback(request);
   if(path==='/auth/logout'&&request.method==='POST')return await auth.logout(request);
   if(path==='/admin'&&request.method==='GET'){
    try{await auth.requireOwner(request);}catch(e){if(e.status!==401&&e.status!==403)throw e;const id=url.searchParams.get('post')||'';if(id&&!validId(id))throw new HttpError(400,'잘못된 글 ID');return new Response('<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>관리자 로그인</title><link rel="stylesheet" href="/assets/editor.css"><main class="admin-main"><h1>글을 수정하려면 로그인해주세요</h1><p>등록된 본인 GitHub 계정만 편집할 수 있습니다.</p><a href="/auth/login'+(id?'?post='+encodeURIComponent(id):'')+'">GitHub로 로그인 →</a></main></html>',{headers:{...secureHeaders,'Content-Type':'text/html; charset=utf-8'}});}
    if(!assets['/admin'])throw new HttpError(503,'관리자 화면 번들이 필요합니다.');return new Response(assets['/admin'].body,{headers:{...secureHeaders,'Content-Type':'text/html; charset=utf-8'}});
   }
   if(path==='/api/session'&&request.method==='GET'){const user=await auth.requireOwner(request);return json({userId:user.userId,csrf:user.csrf,publicSite:env.PUBLIC_SITE_URL});}
   if(path==='/api/posts'&&request.method==='GET')return json(await github.listPosts(await auth.requireOwner(request)));
   let match=path.match(/^\/api\/posts\/([A-Za-z0-9_-]{1,80})$/);if(match&&request.method==='GET')return json(await github.loadPost(match[1],await auth.requireOwner(request)));
   match=path.match(/^\/api\/posts\/([A-Za-z0-9_-]{1,80})\/publish$/);if(match&&request.method==='POST'){const user=await auth.requireWrite(request),body=await readJSON(request);if(body.id!==match[1])throw new HttpError(400,'글 ID가 일치하지 않습니다.');return json(await github.publishPost(body,user));}
   match=path.match(/^\/api\/publications\/([a-f0-9]{40})$/);if(match&&request.method==='GET')return json(await github.publicationStatus(match[1],await auth.requireOwner(request)));
   throw new HttpError(404,'지원하지 않는 경로 또는 요청 방식입니다.');
  }catch(e){const response=Response.json({error:e instanceof HttpError?e.message:'작업을 완료하지 못했습니다. 입력을 보존하고 다시 확인해주세요.'},{status:e instanceof HttpError?e.status:500,headers:secureHeaders});if(path==='/auth/callback'&&auth)return auth.clearCookies(response);return response;}
 };
}
