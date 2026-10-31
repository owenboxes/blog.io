import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateDocument, renderDocument } from '../../admin/shared/document.mjs';
const doc = blocks => ({version:1,blocks});
const text = value => ({type:'text',text:value});
test('paragraphs, explicit breaks and code preserve text without executable markup',()=>{
  const value=doc([{type:'heading',level:2,content:[text('가 & 나')]},{type:'paragraph',content:[text('<script>😀'),{type:'lineBreak'},text('다음')]},{type:'code',language:'py',text:'for x in [1]:\n    print(x)\n'}]);
  const result=renderDocument(value);
  assert.match(result.html,/&lt;script&gt;😀<br>다음/);
  assert.match(result.html,/for x in \[1\]:\n    print\(x\)\n/);
  assert.deepEqual(result.toc,[{id:'section-1',text:'가 & 나'}]);
});
test('nested formatting and table cells retain Korean and emoji',()=>{
  const value=doc([{type:'table',header:true,rows:[[[text('열')]],[[{type:'strong',content:[text('값😀')]}]]]}]);
  assert.match(renderDocument(value).html,/<th>열<\/th>/);
  assert.match(renderDocument(value).html,/<strong>값😀<\/strong>/);
});
test('reject arbitrary attributes, unsupported nodes, executable and external-HTML links',()=>{
  for(const value of [doc([{type:'script',text:'alert(1)'}]),doc([{type:'paragraph',content:[text('x')],onclick:'x'}]),doc([{type:'paragraph',content:[{type:'link',href:'javascript:alert(1)',content:[text('x')]}]}]),doc([{type:'paragraph',content:[{type:'link',href:'//evil.example',content:[text('x')]}]}])]) assert.throws(()=>validateDocument(value));
});
test('bounded documents reject excessive size, node count and recursive depth',()=>{
  assert.throws(()=>validateDocument(doc([{type:'paragraph',content:[text('가'.repeat(100000))]}])));
  assert.throws(()=>validateDocument(doc(Array.from({length:5001},()=>({type:'paragraph',content:[]})))));
  assert.throws(()=>validateDocument(doc([{type:'list',ordered:false,items:Array.from({length:5001},()=>[])}])));
  let nested=text('x');for(let i=0;i<40;i++)nested={type:'strong',content:[nested]};
  assert.throws(()=>validateDocument(doc([{type:'paragraph',content:[nested]}])));
});
