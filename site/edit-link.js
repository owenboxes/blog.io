(function(){
 const origin=globalThis.OWNER_EDITOR_ORIGIN;let url;try{url=new URL(origin);if(url.protocol!=='https:'||url.origin!==origin)return;}catch{return;}
 const article=document.getElementById('article');if(!article)return;const id=document.body.dataset.postId||'loop-demo';if(!/^[a-zA-Z0-9_-]{1,80}$/.test(id))return;
 const link=document.createElement('a');link.href=origin+'/admin?post='+encodeURIComponent(id);link.textContent='글 수정 · 관리자 로그인';link.className='owner-edit-link';link.setAttribute('rel','noopener noreferrer');link.style.cssText='display:block;text-align:center;margin:24px 0;font-size:12px;color:#77786e';article.append(link);
})();
