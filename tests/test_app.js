/* VM harness: exercise actual app handlers; DOM/Worker are external boundaries. */
function appFixture() {
  const nodes = new Map(), timers = new Map();
  let serial = 0;
  function node(id) {
    if (!nodes.has(id)) nodes.set(id, {
      value:'', textContent:'', hidden:false, disabled:false, style:{}, scrollTop:0,
      clientHeight:300, scrollHeight:300, classList:{toggle(){},add(){}},
      setAttribute(){}, replaceChildren(){}, append(){}, focus(){}, scrollIntoView(){},
      getBoundingClientRect(){ return {height:74}; }
    });
    return nodes.get(id);
  }
  return {
    nodes, timers, node,
    document:{getElementById:node,createElement:()=>node('new'+serial++),body:{style:{}},querySelectorAll:()=>[],addEventListener(){},fullscreenElement:null},
    self:{crossOriginIsolated:true}, window:{addEventListener(){},scrollTo(){}},location:{hash:''},history:{replaceState(){}},
    ResizeObserver:class{observe(){}},
    Worker:class{postMessage(data){this.message=data;} terminate(){this.terminated=true;}},
    setTimeout(fn, ms){const id=++serial;timers.set(id,{fn,ms});return id;},clearTimeout(id){timers.delete(id);},
    confirm:()=>true, SharedArrayBuffer,Int32Array,Uint8Array,Atomics,TextEncoder,TextDecoder
  };
}
const appChecks = `
function assert(value, message) { if (!value) throw new Error(message); }
function checkApp() {
  $('editor').value='name = input("Name: ")';
  start(true);
  const first=worker;
  first.onmessage({data:{type:'ready'}});
  assert(Atomics.load(control,0)===1, 'step mode lost');
  first.onmessage({data:{type:'input-event',kind:'prompt',text:'이름'}});
  assert($('output').textContent==='' && $('input-prompt').textContent==='이름', 'prompt mixed with output or missing');
  first.onmessage({data:{type:'input-request'}});
  assert(waitingInput && !$('console-input').hidden && !$('stdin').disabled, 'input unavailable');
  assert(timer===null && !$('stop').disabled, 'wait timer/stop wrong');
  $('stdin').value='영성';
  $('console-input').onsubmit({preventDefault(){}});
  assert(receiveInput(inputBuffer)==='영성', 'submission corrupted');
  assert(!waitingInput && $('console-input').hidden && timer!==null, 'submit state wrong');
  assert(Atomics.load(control,0)===1, 'input changed stepping mode');
  first.onmessage({data:{type:'input-event',kind:'input',text:'영성'}});
  first.onmessage({data:{type:'stdout',text:'영성\\n'}});
  assert($('output').textContent==='영성\\n', 'input echoed into program output');
  assert(!$('input-history').hidden && $('input-log').textContent.includes('입력값: 영성'), 'input history lost');
  $('stdin').value='duplicate';
  $('console-input').onsubmit({preventDefault(){}});
  assert(receiveInput(inputBuffer)==='영성', 'duplicate replaced input');
  first.onmessage({data:{type:'paused',line:2,variables:{name:"'영성'"}}});
  assert(paused && timer===null, 'next line did not pause');
  assert(selectedLine===2 && $('editor').style.backgroundImage!=='none', 'stepped line not highlighted');
  resume(2);
  assert(selectedLine===null && $('editor').style.backgroundImage==='none', 'full run retained step highlight');
  first.onmessage({data:{type:'executing',line:3}});
  assert(selectedLine===null, 'late step event highlighted full run');
  first.onmessage({data:{type:'input-request'}});
  stop();
  assert(first.terminated && !waitingInput && inputBuffer===null && $('console-input').hidden, 'stop did not cancel input');
  first.onmessage({data:{type:'input-request'}});
  assert(!waitingInput, 'stale worker reopened input');
  start(false); worker.onmessage({data:{type:'ready'}});
  assert($('input-log').textContent==='' && $('input-history').hidden, 'old input history leaked into new run');
  assert(Atomics.load(control,0)===2 && inputBuffer, 'full run missing input channel');
  stop();
  return 'app input/step/full-run/timer/stop/stale-worker checks PASS';
}
checkApp();`;
