import {test} from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {validateDocument,renderDocument} from '../../admin/shared/document.mjs';
const root=fileURLToPath(new URL('../../',import.meta.url));
test('all sixteen existing public documents migrate with identical normalized body text and code',()=>{
 const result=JSON.parse(execFileSync('python3',['admin/migrate.py','--check'],{cwd:root,encoding:'utf8'}));
 assert.equal(result.posts.length,16);
 for(const post of result.posts){validateDocument(post.document);const html=renderDocument(post.document).html;
  const actual=execFileSync('python3',['admin/migrate.py','--text'],{cwd:root,input:html,encoding:'utf8'});
  assert.equal(actual,post.originalText,post.id);
  assert.ok(!JSON.stringify(post).includes('app.notion.com'));
 }
});
test('unsupported body HTML fails closed rather than silently losing content',()=>{
 assert.throws(()=>execFileSync('python3',['admin/migrate.py','--fragment'],{cwd:root,input:'<section><h2>제목</h2><iframe src="https://evil.example"></iframe></section>',encoding:'utf8',stdio:['pipe','pipe','pipe']}));
});
