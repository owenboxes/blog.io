/* VM harness: exercise actual app handlers; DOM/Worker are external boundaries. */
function appFixture() {
  const nodes = new Map(), timers = new Map();
  let serial = 0;
  function node(id) {
    if (!nodes.has(id)) nodes.set(id, {
      value:'', textContent:'', hidden:false, disabled:false, style:{}, scrollTop:0,
      clientHeight:300, scrollHeight:300, classList:{toggle(){},add(){}},
      setAttribute(name,value){this[name]=value;}, replaceChildren(...children){this.children=children;}, append(){}, focus(){this.focused=true;}, scrollIntoView(){},setSelectionRange(a,b){this.selectionStart=a;this.selectionEnd=b;},
      getBoundingClientRect(){ return {height:74}; }
      ,setRangeText(text,a,b){this.value=this.value.slice(0,a)+text+this.value.slice(b);this.selectionStart=this.selectionEnd=a+text.length;}
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
  $('editor').value='orders = []\\nresult = [menu for menu in order]';
  start(false); const broken=worker; broken.onmessage({data:{type:'ready'}});
  broken.onmessage({data:{type:'done',output:'',variables:{},error:'NameError: order',diagnostic:{kind:'runtime',type:'NameError',message:"name 'order' is not defined",file:'lesson.py',line:2,column:null,source:'result = [menu for menu in order]'}}});
  assert(!$('problems').hidden && $('problem-location').textContent.includes('lesson.py:2'), 'missing error location panel');
  assert($('problem-type').textContent==='NameError' && $('problem-message').textContent.includes('order'), 'missing diagnostic details');
  assert(selectedLine===null && errorLine===2 && $('editor').style.backgroundImage.includes('#f6d4d2'), 'error stripe is not independent from step highlight');
  $('problem-location').onclick();
  assert($('editor').focused && $('editor').selectionStart===12, 'error link did not navigate to exact source line');
  $('editor').onkeydown({key:'Tab',shiftKey:false,preventDefault(){},target:$('editor')});
  assert($('problems').hidden && errorLine===null, 'Tab editing retained stale diagnostic');
  $('editor').value+=' '; $('editor').oninput();
  assert($('problems').hidden && errorLine===null, 'stale error markers survived edits');
  start(false);worker.onmessage({data:{type:'ready'}});worker.onmessage({data:{type:'done',output:'ok',variables:{},error:'',diagnostic:null}});
  assert($('problems').hidden && errorLine===null && selectedLine===null, 'success retained stale error');
  return 'app input/step/full-run/timer/stop/stale-worker checks PASS';
}
checkApp();`;

