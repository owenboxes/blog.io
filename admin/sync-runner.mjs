// Regenerate runner cache versions after an intentional runner/template change.
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const read=path=>readFileSync(resolve(root,path),'utf8');
const hash=(text,encoding='hex')=>createHash('sha256').update(text).digest(encoding);
const db=JSON.parse(read('content/public-posts.json'));
const originals=new Map();
for(const post of db.posts){
 const path=post.id==='loop-demo'?'site/index.html':'site/'+post.href;
 const html=read(path);
 if(hash(html,'base64url')!==post.pageHash)throw Error('Unexpected external article edit: '+path);
 originals.set(path,html);
}
const worker=read('site/worker.js').replace(/engine\.py(?:\?v=[a-f0-9]+)?/,'engine.py?v='+hash(read('site/engine.py')).slice(0,12));
const app=read('site/app.js').replace(/worker\.js\?v=[a-zA-Z0-9-]+/,'worker.js?v='+hash(worker).slice(0,12));
const versions={'app.js':hash(app).slice(0,12),'style.css':hash(read('site/style.css')).slice(0,12)};
const updates=new Map([['site/worker.js',worker],['site/app.js',app]]);
for(const post of db.posts){
 const path=post.id==='loop-demo'?'site/index.html':'site/'+post.href;let html=originals.get(path);
 for(const [asset,version]of Object.entries(versions))html=html.replaceAll(new RegExp(asset.replace('.','\\.')+'\\?v=[a-f0-9]+','g'),asset+'?v='+version);
 post.pageHash=hash(html,'base64url');updates.set(path,html);
}
updates.set('content/public-posts.json',JSON.stringify(db,null,2)+'\n');
for(const [path,text]of updates)writeFileSync(resolve(root,path),text);
console.log('Runner asset versions and sixteen canonical page hashes synchronized.');
