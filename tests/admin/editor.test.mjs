import {test} from 'node:test';import assert from 'node:assert/strict';
import {draftKey,saveDraft,loadDraft,importDraft,splitParagraph,inlineFromDOM,publishIntent,enterAction,acceptPublished,syncInlineField,publicationTracker} from '../../admin/ui/model.mjs';
const t=text=>({type:'text',text});const doc={version:1,blocks:[{type:'paragraph',content:[t('안녕😀')]}]};
const state={postId:'known-post',userId:7,revision:'original',title:'제목',summary:'요약',document:doc};
test('local draft is owner/post/revision bound and storage failure never pretends saved',()=>{
 const values=new Map(),storage={setItem:(k,v)=>values.set(k,v),getItem:k=>values.get(k)||null};const k=draftKey(7,'known-post');assert.notEqual(k,draftKey(8,'known-post'));
 assert.equal(saveDraft(storage,state).ok,true);assert.deepEqual(loadDraft(storage,7,'known-post').document,doc);assert.equal(loadDraft(storage,8,'known-post'),null);
 assert.equal(saveDraft({setItem(){throw Error('quota');}},state).ok,false);
 assert.equal(loadDraft({getItem(){throw Error('blocked');}},7,'known-post'),null);
});
test('draft imports reject wrong owner/post and unsafe schemas; code whitespace survives export',()=>{
 assert.throws(()=>importDraft(JSON.stringify({...state,userId:8}),7,'known-post'));assert.throws(()=>importDraft(JSON.stringify({...state,postId:'another'}),7,'known-post'));
 assert.throws(()=>importDraft(JSON.stringify({...state,document:{version:1,blocks:[{type:'script'}]}}),7,'known-post'));
 const code={...state,document:{version:1,blocks:[{type:'code',text:'a = 1\n    keep spaces\n',language:'py'}]}};assert.equal(importDraft(JSON.stringify(code),7,'known-post').document.blocks[0].text,code.document.blocks[0].text);
});
test('Enter splits a paragraph without losing before/after text while explicit breaks remain inline',()=>{
 const result=splitParagraph(doc,0,[t('안녕')],[t('😀')]);assert.equal(result.blocks.length,2);assert.deepEqual(result.blocks[1],{type:'paragraph',content:[t('😀')]});
 const n=(tag,children=[],text='')=>({nodeType:tag?1:3,tagName:tag?.toUpperCase(),childNodes:children,textContent:text,getAttribute:()=>null});
 assert.deepEqual(inlineFromDOM(n('div',[n('',[],'앞'),n('br'),n('strong',[n('',[],'뒤')])])),[t('앞'),{type:'lineBreak'},{type:'strong',content:[t('뒤')]}]);
 assert.throws(()=>inlineFromDOM(n('div',[n('img')])));
});
test('unchanged retry uses same operation ID, changed content requires a new intent',()=>{
 const a=publishIntent(state),b=publishIntent(state,a);assert.equal(a.operationId,b.operationId);const c=publishIntent({...state,title:'바뀜'},a);assert.notEqual(c.operationId,a.operationId);assert.ok(!JSON.stringify(a).includes('token'));
});
test('Enter never uses browser block insertion in cells or list items and leaves IME composition alone',()=>{
 assert.equal(enterAction({key:'Enter'},false),'break');
 assert.equal(enterAction({key:'Enter'},true),'split');
 assert.equal(enterAction({key:'Enter',shiftKey:true},true),'break');
 assert.equal(enterAction({key:'Enter',isComposing:true},true),null);
 assert.equal(enterAction({key:'Enter',keyCode:229},false),null);
});
test('a publish reload cannot couple old local content with a newer concurrent revision',()=>{
 const fresh={post:{id:state.postId,title:state.title,summary:state.summary,document:doc},revision:'saved'};
 assert.equal(acceptPublished(state,fresh).revision,'saved');
 const newer={...fresh,post:{...fresh.post,title:'다른 탭의 최신 수정'},revision:'other-tab'};
 assert.throws(()=>acceptPublished(state,newer),/다른 수정/);
 assert.equal(state.revision,'original');assert.equal(state.title,'제목');
});
test('invalid visible edits are dirty before parsing, reject serialization and retain raw text',()=>{
 let dirty=false,content='original';const field={childNodes:[{nodeType:3,textContent:'가'.repeat(200001)}]};
 assert.throws(()=>syncInlineField(field,c=>content=c,()=>dirty=true));
 assert.equal(dirty,true);assert.equal(content,'original');assert.equal(field.childNodes[0].textContent.length,200001);
});
test('only the latest publication generation can update status',()=>{
 const tracker=publicationTracker(),a=tracker.start(),b=tracker.start();
 assert.equal(tracker.isCurrent(a),false);assert.equal(tracker.isCurrent(b),true);
 tracker.start();assert.equal(tracker.isCurrent(b),false);
});
