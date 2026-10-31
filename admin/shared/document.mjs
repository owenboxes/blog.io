export function escapeHTML(value){return String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
export function safeLink(value){
 if(typeof value!=='string'||/[\u0000-\u0020\u007f]/.test(value)||value.length>2048)throw new Error('허용하지 않는 링크');
 if(value.startsWith('#')&&value.length>1)return value;
 const url=new URL(value);if(!['https:','http:'].includes(url.protocol)||url.username||url.password)throw new Error('허용하지 않는 링크');return value;
}
export function validateDocument(value){
 let count=0; const fail=()=>{throw new Error('지원하지 않거나 너무 큰 문서입니다.');};
 const keys=(v,allowed)=>{if(!v||typeof v!=='object'||Array.isArray(v)||Object.keys(v).some(k=>!allowed.includes(k)))fail();};
 const str=v=>{if(typeof v!=='string')fail();};
 const inline=(items,depth=0)=>{if(!Array.isArray(items)||depth>16)fail();for(const n of items){if(++count>5000)fail();
  if(n.type==='text'||n.type==='code'){keys(n,['type','text']);str(n.text);}
  else if(['strong','emphasis'].includes(n.type)){keys(n,['type','content']);inline(n.content,depth+1);}
  else if(n.type==='link'){keys(n,['type','content','href']);safeLink(n.href);inline(n.content,depth+1);}
  else if(n.type==='lineBreak')keys(n,['type']);else fail();
 }};
 keys(value,['version','blocks']);if(value.version!==1||!Array.isArray(value.blocks)||new TextEncoder().encode(JSON.stringify(value)).length>200000)fail();
 for(const b of value.blocks){if(++count>5000)fail();
  if(['paragraph','heading','quote'].includes(b.type)){keys(b,b.type==='heading'?['type','level','content']:['type','content','role']);inline(b.content);if(b.type==='heading'&&![2,3,4].includes(b.level))fail();if(b.role!==undefined&&b.role!=='kicker')fail();}
  else if(b.type==='code'){keys(b,['type','text','language','label']);str(b.text);str(b.language);if(b.language.length>30)fail();if(b.label!==undefined){str(b.label);if(b.label.length>30)fail();}}
  else if(b.type==='list'){keys(b,['type','ordered','items']);if(typeof b.ordered!=='boolean'||!Array.isArray(b.items))fail();for(const item of b.items){if(++count>5000)fail();inline(item);}}
  else if(b.type==='table'){keys(b,['type','header','rows']);if(typeof b.header!=='boolean'||!Array.isArray(b.rows)||!b.rows.length||b.rows.length>300)fail();const width=b.rows[0]?.length;if(!width||width>30)fail();for(const row of b.rows){if(++count>5000||!Array.isArray(row)||row.length!==width)fail();for(const cell of row){if(++count>5000)fail();inline(cell);}}}
  else if(b.type==='steps'){keys(b,['type','items']);if(!Array.isArray(b.items)||b.items.length>20)fail();for(const item of b.items){if(++count>5000)fail();keys(item,['label','value']);str(item.label);str(item.value);}}
  else fail();
 }return value;
}
export function inlineText(items){return items.map(n=>n.type==='lineBreak'?'\n':n.text??inlineText(n.content)).join('');}
export function renderInline(items){return items.map(n=>{
 if(n.type==='text')return escapeHTML(n.text);if(n.type==='lineBreak')return '<br>';if(n.type==='code')return '<code>'+escapeHTML(n.text)+'</code>';
 const tag={strong:'strong',emphasis:'em',link:'a'}[n.type];return '<'+tag+(n.type==='link'?' href="'+escapeHTML(safeLink(n.href))+'" rel="noopener noreferrer"':'')+'>'+renderInline(n.content)+'</'+tag+'>';
}).join('');}
export function renderDocument(value){
 validateDocument(value);let html='',opened=false,index=0;const toc=[];
 for(const b of value.blocks){if(b.type==='heading'){if(opened)html+='</section>';const id='section-'+(++index);toc.push({id,text:inlineText(b.content)});html+='<section id="'+id+'"><h'+b.level+'>'+renderInline(b.content)+'</h'+b.level+'>';opened=true;continue;}
  if(!opened){html+='<section id="section-intro">';opened=true;}
  if(b.type==='paragraph')html+='<p'+(b.role==='kicker'?' class="section-kicker"':'')+'>'+renderInline(b.content)+'</p>';
  if(b.type==='quote')html+='<blockquote>'+renderInline(b.content)+'</blockquote>';
  if(b.type==='code')html+='<div class="static-code"><div>'+escapeHTML(b.language)+(b.label?'<span>'+escapeHTML(b.label)+'</span>':'')+'</div><pre><code>'+escapeHTML(b.text)+'</code></pre></div>';
  if(b.type==='list'){const t=b.ordered?'ol':'ul';html+='<'+t+'>'+b.items.map(x=>'<li>'+renderInline(x)+'</li>').join('')+'</'+t+'>';}
  if(b.type==='table')html+='<div class="table-scroll"><table><tbody>'+b.rows.map((row,i)=>'<tr>'+row.map(cell=>{const t=b.header&&i===0?'th':'td';return '<'+t+'>'+renderInline(cell)+'</'+t+'>';}).join('')+'</tr>').join('')+'</tbody></table></div>';
  if(b.type==='steps')html+='<div class="value-strip">'+b.items.map((x,i)=>(i?'<span>→</span>':'')+'<div><small>'+escapeHTML(x.label)+'</small><b>'+escapeHTML(x.value)+'</b></div>').join('')+'</div>';
 }if(opened)html+='</section>';return {html,toc};
}
