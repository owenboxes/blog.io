// Add one approved article to the public site in a single consistent step.
// Usage: node admin/add-post.mjs <draft.json> [--check]
// The draft is {id, title, category, kind: 'note'|'practice', date: 'YYYY.MM.DD', summary,
// lab: 'python'|'off', labCode?: string, document: {version:1, blocks:[...]}}.
// It writes site/posts/<id>.html, the content/public-posts.json entry (with pageHash),
// site/catalog.js and every page's catalog cache key, exactly as the owner editor would.
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomUUID} from 'node:crypto';
import {postPath,planPublication} from './shared/publication.mjs';
import {escapeHTML,validateDocument} from './shared/document.mjs';
import {sha256,validId} from './worker/auth.mjs';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const read=path=>readFileSync(resolve(root,path),'utf8');
const fail=message=>{throw Error(message);};
const KIND_LABEL={note:'LEARNING NOTES',practice:'PRACTICE'};

export function validateDraft(draft,db){
 if(!draft||typeof draft!=='object')fail('draft must be a JSON object');
 if(!validId(draft.id))fail('id must be 1-80 letters, digits, - or _');
 if(db.posts.some(p=>p.id===draft.id))fail('id already exists: '+draft.id);
 if(existsSync(resolve(root,'site/posts/'+draft.id+'.html')))fail('page already exists: site/posts/'+draft.id+'.html');
 for(const key of ['title','category','summary'])if(typeof draft[key]!=='string'||!draft[key].trim())fail(key+' is required');
 if(draft.title.length>200||draft.summary.length>1000||draft.category.length>40)fail('title, summary or category is too long');
 if(!KIND_LABEL[draft.kind])fail('kind must be note or practice');
 if(!/^\d{4}\.\d{2}\.\d{2}$/.test(draft.date||''))fail('date must be YYYY.MM.DD');
 if(!['python','off'].includes(draft.lab))fail('lab must be python or off');
 if(draft.labCode!==undefined&&(typeof draft.labCode!=='string'||draft.labCode.length>20000))fail('labCode must be a string up to 20,000 characters');
 validateDocument(draft.document);
}

// Start from an existing article so shared assets, cache keys and the runner markup stay current.
function pageFromTemplate(template,draft){
 // Strings go through a callback so "$&"-style tokens in draft text stay literal.
 const replace=(html,pattern,value)=>{if(!pattern.test(html))fail('template structure changed: '+pattern);return html.replace(pattern,typeof value==='function'?value:()=>value);};
 let html=template;
 html=replace(html,/<body[^>]*>/,'<body data-site-root="../" data-post-id="'+draft.id+'" data-lab="'+draft.lab+'">');
 html=replace(html,/<div class="post-meta">[\s\S]*?<\/div>/,'<div class="post-meta">'+escapeHTML(draft.category)+' · '+KIND_LABEL[draft.kind]+'<span class="article-date">'+draft.date+'</span></div>');
 html=replace(html,/(<textarea id="editor"[^>]*>)[\s\S]*?(<\/textarea>)/,(all,open,close)=>open+escapeHTML(draft.labCode||'')+close);
 return html;
}

export async function addPost(draft,{now=new Date()}={}){
 const db=JSON.parse(read('content/public-posts.json'));
 validateDraft(draft,db);
 const files={'content/public-posts.json':null,'site/catalog.js':read('site/catalog.js')};
 for(const p of db.posts)files[postPath(p)]=read(postPath(p));
 const template=db.posts.find(p=>p.href.startsWith('posts/'))||fail('no article page to use as a template');
 const href='posts/'+draft.id+'.html',html=pageFromTemplate(files[postPath(template)],draft);
 const publishedAt=now.toISOString().replace(/\.\d{3}Z$/,'Z');
 const entry={id:draft.id,title:draft.title,category:draft.category,kind:draft.kind,date:draft.date,published:true,publishedAt,
  sequence:Math.max(0,...db.posts.map(p=>p.sequence||0))+1,href,summary:draft.summary,document:draft.document,pageHash:await sha256(html)};
 db.posts.push(entry);files['content/public-posts.json']=JSON.stringify(db,null,2)+'\n';files['site/'+href]=html;
 // The editor's publish path renders the body, title, description and contents, then refreshes the catalog.
 const changed=await planPublication(files,entry,{operationId:randomUUID(),digest:'add-post',updatedAt:publishedAt});
 return changed;
}

if(process.argv[1]===fileURLToPath(import.meta.url)){
 const [file,...flags]=process.argv.slice(2);
 if(!file){console.error('Usage: node admin/add-post.mjs <draft.json> [--check]');process.exit(2);}
 try{
  const draft=JSON.parse(readFileSync(resolve(file),'utf8'));
  const changed=await addPost(draft);
  if(!flags.includes('--check'))for(const {path,content}of changed)writeFileSync(resolve(root,path),content);
  console.log(JSON.stringify({id:draft.id,written:!flags.includes('--check'),files:changed.map(x=>x.path).sort()}));
 }catch(e){console.error('add-post failed: '+e.message);process.exit(1);}
}
