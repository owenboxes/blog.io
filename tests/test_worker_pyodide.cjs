/* Exact worker/engine, real pinned Pyodide. Only browser transport/loading are adapted. */
const {Worker} = require('node:worker_threads');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
async function runWorkerChecks(runtimeDir) {
  const root=path.resolve(__dirname,'..');
  const source=fs.readFileSync(path.join(root,'site/worker.js'),'utf8');
  const engine=fs.readFileSync(path.join(root,'site/engine.py'),'utf8');
  const channel=fs.readFileSync(path.join(root,'site/input-channel.js'),'utf8');
  const bridge=`const {parentPort}=require('node:worker_threads');const vm=require('node:vm');
    const load=require(${JSON.stringify(path.join(runtimeDir,'pyodide.js'))}).loadPyodide;
    global.loadPyodide=()=>load({indexURL:${JSON.stringify(runtimeDir+'/')}});
    global.importScripts=url=>{if(url.includes('input-channel'))vm.runInThisContext(${JSON.stringify(channel)});};
    global.fetch=async()=>({ok:true,text:async()=>${JSON.stringify(engine)}});
    global.postMessage=m=>parentPort.postMessage(m);
    parentPort.on('message',data=>global.onmessage({data}));
    vm.runInThisContext(${JSON.stringify(source)});`;
  async function execute(code, mode=1, switchAfter=Infinity, input='영성') {
    const worker=new Worker(bridge,{eval:true});
    const control=new Int32Array(new SharedArrayBuffer(4)); control[0]=mode;
    const inputBuffer=new SharedArrayBuffer(65544), events=[];
    return new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>{worker.terminate();reject(Error('worker timed out'));},20000);
      const finish=(error,result)=>{clearTimeout(timer);worker.terminate();error?reject(error):resolve({events,result});};
      worker.on('error',error=>finish(error));
      worker.on('message',message=>{
        events.push(message);
        if(message.type==='ready')worker.postMessage({type:'execute',code,control:control.buffer,inputBuffer});
        if(message.type==='paused'){
          const count=events.filter(x=>x.type==='paused').length;
          Atomics.store(control,0,count>=switchAfter?2:1); Atomics.notify(control,0);
        }
        if(message.type==='input-request'){
          const bytes=new TextEncoder().encode(input), state=new Int32Array(inputBuffer,0,2);
          new Uint8Array(inputBuffer,8).set(bytes);Atomics.store(state,1,bytes.length);
          Atomics.store(state,0,1);Atomics.notify(state,0);
        }
        if(message.type==='error')finish(Error(message.message));
        if(message.type==='done')finish(null,message);
      });
    });
  }
  const loop=await execute('total = 0\nfor number in range(1, 4):\n    total += number\nprint(total)');
  assert.equal(loop.result.error,'');assert.equal(loop.result.output,'6\n');
  const pauses=loop.events.filter(x=>x.type==='paused');
  assert.deepEqual(pauses.map(x=>x.line),[1,2,3,2,3,2,3,2,4]);
  assert.equal(pauses[0].variables.total,'0','first click must execute line 1 before pausing');
  assert.equal(pauses[0].nextLine,2);
  assert.equal(pauses[2].variables.total,'1');
  assert.equal(pauses.at(-1).nextLine,null,'last executed line must be visible before completion');
  const full=await execute('print(3)',2);
  assert.equal(full.result.output,'3\n');assert.equal(full.events.filter(x=>['paused','executing'].includes(x.type)).length,0);
  const switched=await execute('x=1\nx+=1\nprint(x)',1,1);
  assert.equal(switched.result.output,'2\n');assert.equal(switched.events.filter(x=>x.type==='paused').length,1);
  const typed=await execute('name=input("이름")\nprint(name)');
  assert.equal(typed.result.output,'영성\n');assert.equal(typed.result.error,'');
  const fn=await execute('def double(n):\n    return n*2\nprint(double(4))');
  assert.equal(fn.result.output,'8\n');assert.equal(fn.result.error,'');
  const condition=await execute('x=0\nwhile x<2:\n    x+=1\nprint(x)');
  assert.equal(condition.result.output,'2\n');assert.equal(condition.result.error,'');
  const invalid=await execute('for :');
  assert.ok(invalid.result.error.includes('SyntaxError'),'Python errors must be reported rather than hang');
  console.log('Real Pyodide: executed-line stepping, loop, full run, mode switch, input, function PASS');
}
module.exports={runWorkerChecks};
if(require.main===module)runWorkerChecks(path.resolve(process.argv[2])).catch(e=>{console.error(e);process.exitCode=1;});
