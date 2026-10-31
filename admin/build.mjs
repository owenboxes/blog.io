import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';import {resolve,dirname} from 'node:path';import {fileURLToPath} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
function bundle(entry){const modules=new Map(),chunks=[];function visit(path){path=resolve(path);if(modules.has(path))return modules.get(path);const name='__module'+modules.size;modules.set(path,name);let src=readFileSync(path,'utf8');src=src.replace(/import\s+\{([^}]+)\}\s+from\s+['"]([^'"]+)['"];\s*/g,(all,names,dependency)=>'const {'+names+'} = '+visit(resolve(dirname(path),dependency))+';\n');const exports=[];src=src.replace(/export\s+(async\s+)?(function|class|const|let)\s+([A-Za-z_$][\w$]*)/g,(all,asyncWord,kind,key)=>{exports.push(key);return (asyncWord||'')+kind+' '+key;});if(/^\s*(import|export)\s/m.test(src))throw Error('Unsupported build-time module declaration in '+path);chunks.push('const '+name+' = (()=>{\n'+src+'\nreturn {'+exports.join(',')+'};\n})();');return name;}const name=visit(resolve(root,entry));return {source:chunks.join('\n'),name};}
const ui=bundle('admin/ui/editor.mjs');const assets={
 '/admin':{body:readFileSync(resolve(root,'admin/ui/index.html'),'utf8'),type:'text/html'},
 '/assets/editor.js':{body:ui.source,type:'text/javascript'},
 '/assets/editor.css':{body:readFileSync(resolve(root,'admin/ui/editor.css'),'utf8'),type:'text/css'}
};
const worker=bundle('admin/worker/index.mjs');const output=worker.source+'\nconst __assets = '+JSON.stringify(assets)+';\nexport default {fetch: '+worker.name+'.createHandler(__assets)};\n';
mkdirSync(resolve(root,'admin/dist'),{recursive:true});writeFileSync(resolve(root,'admin/dist/worker.mjs'),output);console.log('Worker bundle built; credentials are read only from runtime bindings.');
