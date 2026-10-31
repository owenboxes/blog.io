export class HttpError extends Error{constructor(status,message){super(message);this.status=status;}}
export function base64url(bytes){return btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');}
export function unbase64url(value){if(!/^[A-Za-z0-9_-]+$/.test(value))throw Error('bad encoding');return Uint8Array.from(atob(value.replace(/-/g,'+').replace(/_/g,'/')),x=>x.charCodeAt(0));}
export async function sha256(value){return base64url(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)));}
export function randomToken(){return base64url(crypto.getRandomValues(new Uint8Array(32)));}
export function validId(id){return typeof id==='string'&&/^[a-zA-Z0-9_-]{1,80}$/.test(id);}
export const secureHeaders={'Cache-Control':'no-store','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff','X-Frame-Options':'DENY','Content-Security-Policy':"default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'"};
export function createAuth(env,io={}){
 const origin=env.ADMIN_ORIGIN;let parsed;try{parsed=new URL(origin);}catch{throw new HttpError(503,'관리자 설정이 필요합니다.');}
 if(parsed.origin!==origin||parsed.protocol!=='https:'||!/^\d+$/.test(String(env.ALLOWED_USER_ID))||!/^[a-fA-F0-9]{64}$/.test(env.SESSION_SECRET||'')||!env.GITHUB_CLIENT_ID||!env.GITHUB_CLIENT_SECRET)throw new HttpError(503,'관리자 설정이 필요합니다.');
 const fetcher=io.fetch||fetch,now=io.now||Date.now,encoder=new TextEncoder();
 const key=crypto.subtle.importKey('raw',Uint8Array.from(env.SESSION_SECRET.match(/../g),x=>parseInt(x,16)),'AES-GCM',false,['encrypt','decrypt']);
 const cookieName={oauth:'__Host-editor-oauth',session:'__Host-editor-session'};
 const cookie=(purpose,value,ttl)=>cookieName[purpose]+'='+value+'; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age='+ttl;
 const setCookies=(response,items)=>{for(const x of items)response.headers.append('Set-Cookie',x);return response;};
 const seal=async(purpose,payload)=>{const iv=crypto.getRandomValues(new Uint8Array(12));const bytes=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:encoder.encode(origin+'|'+purpose)},await key,encoder.encode(JSON.stringify(payload)));return base64url(iv)+'.'+base64url(bytes);};
 const open=async(purpose,request)=>{
  try{const names=(request.headers.get('cookie')||'').split(';').map(s=>s.trim()).filter(s=>s.startsWith(cookieName[purpose]+'='));if(names.length!==1)throw Error();
   const raw=names[0].slice(cookieName[purpose].length+1);if(raw.length>3800)throw Error();const parts=raw.split('.');if(parts.length!==2)throw Error();const iv=unbase64url(parts[0]);if(iv.length!==12)throw Error();
   const plain=await crypto.subtle.decrypt({name:'AES-GCM',iv,additionalData:encoder.encode(origin+'|'+purpose)},await key,unbase64url(parts[1]));const value=JSON.parse(new TextDecoder().decode(plain));
   if(!Number.isFinite(value.exp)||value.exp<=now()||!Number.isFinite(value.iat)||value.iat>now()+5000||value.exp-value.iat>(purpose==='oauth'?600000:3600000))throw Error();return value;
  }catch{throw new HttpError(401,'로그인이 필요하거나 세션이 만료됐습니다.');}
 };
 const githubUser=async token=>{let response;try{response=await fetcher('https://api.github.com/user',{headers:{Authorization:'Bearer '+token,Accept:'application/vnd.github+json','User-Agent':'OwnerBlogEditor','X-GitHub-Api-Version':'2026-03-10'}});}catch{throw new HttpError(502,'GitHub 연결을 확인하지 못했습니다.');}
  if(!response.ok)throw new HttpError(response.status===401?401:502,'GitHub 로그인을 다시 확인해주세요.');const user=await response.json();if(String(user.id)!==String(env.ALLOWED_USER_ID))throw new HttpError(403,'이 계정에는 편집 권한이 없습니다.');return user;
 };
 const sameHost=request=>{if(new URL(request.url).origin!==origin)throw new HttpError(403,'허용되지 않는 주소입니다.');};
 const requireOwner=async request=>{sameHost(request);const session=await open('session',request);if(String(session.userId)!==String(env.ALLOWED_USER_ID)||typeof session.token!=='string'||!session.csrf)throw new HttpError(403,'편집 권한이 없습니다.');await githubUser(session.token);return session;};
 const requireWrite=async request=>{if(request.method!=='POST'||request.headers.get('origin')!==origin)throw new HttpError(403,'허용되지 않는 요청입니다.');const session=await requireOwner(request);if(request.headers.get('x-editor-csrf')!==session.csrf)throw new HttpError(403,'요청 확인 정보가 일치하지 않습니다.');return session;};
 return {
  async start(request){sameHost(request);const post=new URL(request.url).searchParams.get('post')||'';if(post&&!validId(post))throw new HttpError(400,'잘못된 글 ID');const state=randomToken(),verifier=randomToken();const url=new URL('https://github.com/login/oauth/authorize');
   for(const [k,v]of Object.entries({client_id:env.GITHUB_CLIENT_ID,redirect_uri:origin+'/auth/callback',state,code_challenge:await sha256(verifier),code_challenge_method:'S256',allow_signup:'false'}))url.searchParams.set(k,v);
   const r=new Response(null,{status:302,headers:{...secureHeaders,Location:url.href}});return setCookies(r,[cookie('oauth',await seal('oauth',{state,verifier,post,iat:now(),exp:now()+600000}),600)]);
  },
  async callback(request){sameHost(request);const attempt=await open('oauth',request),url=new URL(request.url);const code=url.searchParams.get('code');if(url.searchParams.get('state')!==attempt.state||!code||code.length>1024||url.searchParams.has('error'))throw new HttpError(403,'로그인 요청이 취소되었거나 일치하지 않습니다.');
   let r;try{r=await fetcher('https://github.com/login/oauth/access_token',{method:'POST',headers:{Accept:'application/json','Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:env.GITHUB_CLIENT_ID,client_secret:env.GITHUB_CLIENT_SECRET,code,redirect_uri:origin+'/auth/callback',code_verifier:attempt.verifier})});}catch{throw new HttpError(502,'GitHub 인증 연결에 실패했습니다.');}
   if(!r.ok)throw new HttpError(502,'GitHub 인증 연결에 실패했습니다.');const grant=await r.json();if(typeof grant.access_token!=='string'||grant.access_token.length>1000||grant.token_type!=='bearer'||grant.error)throw new HttpError(403,'GitHub 인증에 실패했습니다.');const user=await githubUser(grant.access_token);
   const ttl=Math.min(3600,Number(grant.expires_in)||3600);if(ttl<=0)throw new HttpError(401,'GitHub 인증이 만료됐습니다.');
   const payload={userId:user.id,token:grant.access_token,csrf:randomToken(),iat:now(),exp:now()+ttl*1000};
   return setCookies(new Response(null,{status:302,headers:{...secureHeaders,Location:'/admin'+(attempt.post?'?post='+encodeURIComponent(attempt.post):'')}}),[cookie('oauth','',0),cookie('session',await seal('session',payload),ttl)]);
  },requireOwner,requireWrite,
  async logout(request){await requireWrite(request);return setCookies(Response.json({ok:true},{headers:secureHeaders}),[cookie('session','',0),cookie('oauth','',0)]);},
  clearCookies(response){return setCookies(response,[cookie('oauth','',0),cookie('session','',0)]);}
 };
}
