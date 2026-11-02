import {escapeHTML,renderDocument,validateDocument} from './document.mjs';
import {HttpError,sha256,validId} from '../worker/auth.mjs';
export function postPath(post){if(post.id==='loop-demo'&&post.href==='#article')return 'site/index.html';if(!validId(post.id)||post.href!=='posts/'+post.id+'.html')throw new HttpError(400,'지원하지 않는 글 경로');return 'site/'+post.href;}
export async function revisionOf(post){return sha256(JSON.stringify({id:post.id,title:post.title,summary:post.summary,document:post.document}));}
export async function hexHash(text){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text))),x=>x.toString(16).padStart(2,'0')).join('');}
function replaceRequired(text,pattern,replacement){let found=false;const out=text.replace(pattern,(...args)=>{if(found)throw new HttpError(409,'페이지 구조가 중복되어 있습니다.');found=true;return typeof replacement==='function'?replacement(...args):replacement;});if(!found)throw new HttpError(409,'페이지 구조가 변경되어 다시 확인해야 합니다.');return out;}
export function preparePage(html,document){
 if(html.includes('<!-- editor-body:start -->'))return html;
 const article=html.indexOf('<article id="article">'),end=html.indexOf('<div class="article-end"',article);const start=html.indexOf('<section id=',article);const finish=html.lastIndexOf('</section>',end)+10;
 if(article<0||end<0||start<0||finish<=start)throw new HttpError(409,'지원되지 않는 페이지 구조');
 const area=html.slice(start,finish);let lab='';const at=area.indexOf('<div id="lab"');if(at>=0){const tags=area.slice(at).matchAll(/<\/?div\b[^>]*>/g);let depth=0,stop=0;for(const match of tags){depth+=match[0].startsWith('</')?-1:1;if(depth===0){stop=at+match.index+match[0].length;break;}}if(!stop)throw new HttpError(409,'실습창 경계 오류');lab=area.slice(at,stop)+'\n';}
 return html.slice(0,start)+'<!-- editor-body:start -->'+renderDocument(document).html+'<!-- editor-body:end -->'+lab+html.slice(finish);
}
export async function planPublication(files,requested,operation){
 const db=JSON.parse(files['content/public-posts.json']);if(db.version!==1||!Array.isArray(db.posts)||db.posts.length>500)throw new HttpError(409,'글 원본 형식 오류');
 const old=db.posts.find(p=>p.id===requested.id);if(!old)throw new HttpError(404,'등록된 글이 아닙니다.');
 for(const p of db.posts){const path=postPath(p);if(!files[path]||await sha256(files[path])!==p.pageHash)throw new HttpError(409,'공개 파일이 편집기 밖에서 변경됐습니다. 원본을 먼저 동기화해주세요.');}
 validateDocument(requested.document);if(typeof requested.title!=='string'||!requested.title.trim()||requested.title.length>200||typeof requested.summary!=='string'||requested.summary.length>1000)throw new HttpError(400,'제목 또는 요약 길이를 확인해주세요.');
 const post={...old,title:requested.title,summary:requested.summary,document:requested.document,updatedAt:operation.updatedAt,lastOperation:{id:operation.operationId,digest:operation.digest}};
 const index=db.posts.indexOf(old);db.posts[index]=post;const rendered=renderDocument(post.document),toc=rendered.toc.map(x=>'<a href="#'+x.id+'">'+escapeHTML(x.text)+'</a>').join('');
 const output={};let html=files[postPath(post)];html=replaceRequired(html,/<!-- editor-body:start -->[\s\S]*?<!-- editor-body:end -->/,'<!-- editor-body:start -->'+rendered.html+'<!-- editor-body:end -->');
 const a=html.indexOf('<article id="article">');html=html.slice(0,a)+replaceRequired(html.slice(a),/<h1>[\s\S]*?<\/h1>/,'<h1>'+escapeHTML(post.title)+'</h1>');
 html=replaceRequired(html,/<title>[\s\S]*?<\/title>/,'<title>'+escapeHTML(post.title)+' — OWEN</title>');
 html=replaceRequired(html,/<meta name="description" content="[^"]*">/,'<meta name="description" content="'+escapeHTML(post.summary)+'">');
 html=replaceRequired(html,/(<p>ON THIS PAGE<\/p>)[\s\S]*?(<section class="published-navigation")/,(whole,begin,end)=>begin+toc+end);
 html=replaceRequired(html,/<details class="mobile-toc">[\s\S]*?<\/details>/,'<details class="mobile-toc"><summary>이 글의 목차</summary>'+toc+'</details>');
 output[postPath(post)]=html;
 const src=files['site/catalog.js'],start=src.indexOf('const BLOG_POSTS = '),end=src.indexOf('\n];',start);
 const markerStart='/* editor-catalog:start */',markerEnd='/* editor-catalog:end */';let prefix,suffix;
 if(src.includes(markerStart)){prefix=src.slice(0,src.indexOf(markerStart));suffix=src.slice(src.indexOf(markerEnd)+markerEnd.length);}
 else{if(start<0||end<0)throw new HttpError(409,'목록 파일 형식 오류');prefix=src.slice(0,start);suffix=src.slice(end+3);}
 const rows=db.posts.map(({document,pageHash,lastOperation,...p})=>p);const json=JSON.stringify(rows).replace(/</g,'\\u003c').replace(/>/g,'\\u003e').replace(/\//g,'\\/');output['site/catalog.js']=prefix+markerStart+'\nconst BLOG_POSTS = '+json+';\n'+markerEnd+suffix;
 const hash=(await hexHash(output['site/catalog.js'])).slice(0,12);
 for(const p of db.posts){const path=postPath(p);output[path]=(output[path]||files[path]).replace(/catalog\.js\?v=[a-f0-9]+/g,'catalog.js?v='+hash);p.pageHash=await sha256(output[path]);}
 output['content/public-posts.json']=JSON.stringify(db,null,2)+'\n';return Object.entries(output).map(([path,content])=>({path,content}));
}
