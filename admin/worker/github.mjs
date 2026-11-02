import {HttpError,sha256,validId} from './auth.mjs';
import {postPath,revisionOf,planPublication} from '../shared/publication.mjs';
export function createGitHub(env,io={}){
 const repository=env.REPOSITORY;if(!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository||''))throw new HttpError(503,'저장소 설정이 필요합니다.');const callFetch=io.fetch||fetch,base='https://api.github.com/repos/'+repository;
 const api=async(path,auth,body,raw=false)=>{let response;try{response=await callFetch(path.startsWith('/user')||path==='/graphql'?'https://api.github.com'+path:base+path,{method:body===undefined?'GET':path==='/git/refs/heads/main'?'PATCH':'POST',headers:{Authorization:'Bearer '+auth.token,Accept:raw?'application/vnd.github.raw+json':'application/vnd.github+json','Content-Type':'application/json','User-Agent':'OwnerBlogEditor','X-GitHub-Api-Version':'2026-03-10'},...(body===undefined?{}:{body:JSON.stringify(body)})});}catch{throw new HttpError(502,'GitHub 응답을 확인하지 못했습니다. 게시 결과를 다시 조회해주세요.');}if(!response.ok)throw new HttpError([401,403,409,422].includes(response.status)?response.status:502,'GitHub 요청에 실패했습니다. 권한·버전 또는 연결 상태를 확인해주세요.');return raw?response.text():response.json();};
 const owner=async(auth,write=false)=>{if(String(auth.userId)!==String(env.ALLOWED_USER_ID))throw new HttpError(403,'편집 권한이 없습니다.');const user=await api('/user',auth);if(String(user.id)!==String(env.ALLOWED_USER_ID))throw new HttpError(403,'편집 권한이 없습니다.');if(write){const repo=await api('',auth);if(repo.permissions?.push!==true)throw new HttpError(403,'저장소 쓰기 권한이 없습니다.');}};
 const head=async auth=>(await api('/git/ref/heads/main',auth)).object.sha;
 const allowed=path=>/^site\/(?:index\.html|catalog\.js|posts\/[a-zA-Z0-9_-]+\.html)$/.test(path)||path==='content/public-posts.json';
 // Raw media type: the default base64 response is unavailable for files over 1 MB, which public-posts.json reaches as articles grow.
 const file=async(path,ref,auth)=>{if(!allowed(path))throw new HttpError(403,'허용되지 않는 파일');const text=await api('/contents/'+path+'?ref='+ref,auth,undefined,true);if(typeof text!=='string'||text.length>5000000)throw new HttpError(409,'지원하지 않는 파일 크기 또는 형식');return text;};
 // One GraphQL request reads up to 100 files, keeping a publish within the Worker's subrequest limit as articles grow.
 const files=async(paths,ref,auth)=>{if(!/^[a-f0-9]{40}$/.test(ref))throw new HttpError(409,'잘못된 버전 ID');const [owner,name]=repository.split('/'),out={};
  for(let start=0;start<paths.length;start+=100){const chunk=paths.slice(start,start+100);for(const path of chunk)if(!allowed(path))throw new HttpError(403,'허용되지 않는 파일');
   const query='query($owner:String!,$name:String!){repository(owner:$owner,name:$name){'+chunk.map((path,i)=>'f'+i+':object(expression:'+JSON.stringify(ref+':'+path)+'){... on Blob{text isBinary isTruncated}}').join(' ')+'}}';
   const result=await api('/graphql',auth,{query,variables:{owner,name}});if(result.errors||!result.data?.repository)throw new HttpError(502,'GitHub 파일을 읽지 못했습니다.');
   chunk.forEach((path,i)=>{const blob=result.data.repository['f'+i];if(!blob||blob.isBinary||blob.isTruncated||typeof blob.text!=='string'||blob.text.length>2000000)throw new HttpError(409,'지원하지 않는 파일 크기 또는 형식');out[path]=blob.text;});
  }return out;};
 const data=async(auth,ref)=>{const raw=await file('content/public-posts.json',ref,auth);const db=JSON.parse(raw);if(db.version!==1||!Array.isArray(db.posts)||db.posts.length>500)throw new HttpError(409,'글 데이터 형식 오류');return {db,raw};};
 const hasTrailer=(message,key,value)=>message.split(/\r?\n/).includes(key+': '+value);
 const findOperation=async(id,auth)=>{const rows=await api('/commits?path=content/public-posts.json&per_page=50',auth);return rows.find(row=>hasTrailer(row.commit.message,'Editor-Operation',id));};
 return {
  async listPosts(auth){await owner(auth);const ref=await head(auth);const {db}=await data(auth,ref);return db.posts.map(({id,title,category,kind})=>({id,title,category,kind}));},
  async loadPost(id,auth){await owner(auth);if(!validId(id))throw new HttpError(400,'잘못된 글 ID');const ref=await head(auth),{db}=await data(auth,ref);const post=db.posts.find(p=>p.id===id);if(!post)throw new HttpError(404,'글을 찾지 못했습니다.');const html=await file(postPath(post),ref,auth);if(await sha256(html)!==post.pageHash)throw new HttpError(409,'공개 파일이 편집기 밖에서 바뀌었습니다. 먼저 원본 동기화가 필요합니다.');return {post,revision:await revisionOf(post),head:ref};},
  async publishPost(input,auth){await owner(auth,true);if(!input||!validId(input.id)||!/^[a-f0-9-]{36}$/.test(input.operationId||''))throw new HttpError(400,'잘못된 게시 요청');
   const digest=await sha256(JSON.stringify({id:input.id,title:input.title,summary:input.summary,document:input.document,revision:input.revision}));
   const previous=await findOperation(input.operationId,auth);if(previous){if(!hasTrailer(previous.commit.message,'Editor-Digest',digest))throw new HttpError(409,'같은 게시 ID에 다른 수정 내용이 있습니다.');return {commit:previous.sha,status:'saved'};}
   for(let attempt=0;attempt<2;attempt++){
    const ref=await head(auth),{db,raw}=await data(auth,ref),post=db.posts.find(p=>p.id===input.id);if(!post)throw new HttpError(404,'등록된 글이 아닙니다.');if(await revisionOf(post)!==input.revision)throw new HttpError(409,'다른 수정이 먼저 저장됐습니다. 입력을 보존하고 최신 글을 확인해주세요.');
    const current={'content/public-posts.json':raw,...await files(['site/catalog.js',...db.posts.map(postPath)],ref,auth)};
    const changed=await planPublication(current,{...post,title:input.title,summary:input.summary,document:input.document},{operationId:input.operationId,digest,updatedAt:new Date().toISOString()});
    const commit=await api('/git/commits/'+ref,auth);const tree=await api('/git/trees',auth,{base_tree:commit.tree.sha,tree:changed.map(x=>({...x,mode:'100644',type:'blob'}))});
    const next=await api('/git/commits',auth,{message:'Update public article\n\nEditor-Operation: '+input.operationId+'\nEditor-Digest: '+digest+'\n',tree:tree.sha,parents:[ref]});
    try{await api('/git/refs/heads/main',auth,{sha:next.sha,force:false});return {commit:next.sha,status:'saved'};}catch(e){if(![409,422].includes(e.status)||attempt===1)throw e;const already=await findOperation(input.operationId,auth);if(already){if(!hasTrailer(already.commit.message,'Editor-Digest',digest))throw new HttpError(409,'게시 요청 충돌');return {commit:already.sha,status:'saved'};}}
   }
  },
  async publicationStatus(commit,auth){await owner(auth);if(!/^[a-f0-9]{40}$/.test(commit))throw new HttpError(400,'잘못된 버전 ID');
   try{const result=await api('/actions/runs?head_sha='+commit,auth);const row=result.workflow_runs.find(x=>x.path==='.github/workflows/pages.yml');if(!row)return {state:'pending'};if(row.status!=='completed')return {state:'pending'};if(row.conclusion!=='success')return {state:'failed'};return {state:'published',url:env.PUBLIC_SITE_URL};}catch(e){if(e.status===403)return {state:'unknown'};throw e;}
  }
 };
}
