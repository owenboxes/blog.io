(function(){
 // Visitors never see the editor link. The owner turns it on once per browser with
 // ?owner=on (and off with ?owner=off). This is a display preference, not access control:
 // the editor itself still requires the owner's GitHub login.
 const key='owen-owner-editor';
 const params=new URLSearchParams(location.search),mode=params.get('owner');
 try{if(mode==='on')localStorage.setItem(key,'1');else if(mode==='off')localStorage.removeItem(key);}catch{}
 if(mode!==null){params.delete('owner');const query=params.toString();try{history.replaceState(history.state,'',location.pathname+(query?'?'+query:'')+location.hash);}catch{}}
 let enabled=false;try{enabled=localStorage.getItem(key)==='1';}catch{}
 if(!enabled)return;
 const origin=globalThis.OWNER_EDITOR_ORIGIN;let url;try{url=new URL(origin);if(url.protocol!=='https:'||url.origin!==origin)return;}catch{return;}
 const article=document.getElementById('article');if(!article)return;const id=document.body.dataset.postId||'loop-demo';if(!/^[a-zA-Z0-9_-]{1,80}$/.test(id))return;
 const link=document.createElement('a');link.href=origin+'/admin?post='+encodeURIComponent(id);link.textContent='글 수정 · 관리자 로그인';link.className='owner-edit-link';link.setAttribute('rel','noopener noreferrer');link.style.cssText='display:block;text-align:center;margin:24px 0;font-size:12px;color:#77786e';article.append(link);
})();
