import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import * as model from '../../admin/ui/model.mjs';
import * as documentModel from '../../admin/shared/document.mjs';

// Exercise the real event/controller functions without claiming browser layout coverage.
function harness(fetcher=async()=>{throw Error('unexpected network');}){
 const node=()=>({value:'',hidden:true,childNodes:[],textContent:'',append(...items){this.childNodes.push(...items);},setAttribute(){},querySelectorAll(){return [];}});
 const nodes=new Map();const get=id=>{if(!nodes.has(id))nodes.set(id,node());return nodes.get(id);};
 const timers=[];const context=vm.createContext({...model,...documentModel,console,Response,URL,Blob,crypto,structuredClone,localStorage:{setItem(){},getItem(){return null;}},document:{getElementById:get,createElement:node},fetch:fetcher,confirm:()=>true,setTimeout:fn=>timers.push(fn)});
 const source=readFileSync(new URL('../../admin/ui/editor.mjs',import.meta.url),'utf8').replace(/^import .*;\n/gm,'');
 vm.runInContext(source.slice(0,source.indexOf("$('title').oninput=dirtyMark;"))+`;globalThis.controller={setState(s){state=s;},getState(){return state;},getDirty(){return dirty;},current,button,inlineField,publish,checkPublication,publications};`,context);
 return {c:context.controller,get,timers};
}
const doc={version:1,blocks:[{type:'paragraph',content:[{type:'text',text:'original'}]}]};
const state=()=>({userId:7,postId:'known',title:'title',summary:'summary',revision:'original-revision',document:structuredClone(doc)});
test('actual invalid-input event stays dirty and prevents structural rerender and serialization',()=>{
 const {c,get}=harness();c.setState(state());get('title').value='title';get('summary').value='summary';
 const wrapper=c.inlineField(doc.blocks[0].content,content=>c.getState().document.blocks[0].content=content);
 const field=wrapper.childNodes[0];field.childNodes=[{nodeType:3,textContent:'가'.repeat(200001)}];get('blocks').querySelectorAll=()=>[field];field.oninput();
 assert.equal(c.getDirty(),true);assert.throws(()=>c.current());let changed=false;c.button('위로',()=>changed=true).onclick();assert.equal(changed,false);
 assert.equal(field.childNodes[0].textContent.length,200001);assert.equal(c.getState().document.blocks[0].content[0].text,'original');
});
test('actual publish refuses to adopt another tab revision while retaining local body',async()=>{
 const newer={post:{id:'known',title:'other tab',summary:'summary',document:doc},revision:'newer-revision'};
 const {c,get}=harness(async(path)=>Response.json(path.endsWith('/publish')?{commit:'a'.repeat(40)}:newer));
 c.setState(state());get('title').value='title';get('summary').value='summary';await c.publish();
 assert.equal(c.getState().revision,'original-revision');assert.equal(c.getDirty(),true);assert.match(get('status').textContent,/다른 수정/);
});
test('actual polling ignores a stale response arriving after another publish starts',async()=>{
 let finish;const {c,get}=harness(()=>new Promise(resolve=>finish=resolve));
 const old=c.publications.start();const pending=c.checkPublication('a'.repeat(40),old);c.publications.start();get('status').textContent='newest pending';
 finish(Response.json({state:'published'}));await pending;
 assert.equal(get('status').textContent,'newest pending');assert.equal(get('view-public').hidden,true);
});
