/* Code executes off the UI thread. Stop always terminates this worker. */
importScripts('https://cdn.jsdelivr.net/pyodide/v0.27.7/full/pyodide.js');
importScripts('./input-channel.js');
let runtime;
const loading = (async () => {
  runtime = await loadPyodide();
  const response = await fetch('./engine.py');
  if (!response.ok) throw new Error('Python 실행 엔진을 불러오지 못했습니다.');
  await runtime.runPythonAsync(await response.text());
  postMessage({type: 'ready'});
})();
loading.catch(error => postMessage({type: 'error', message: String(error)}));
onmessage = async ({data}) => {
  if (data.type !== 'execute') return;
  try {
    await loading;
    const control = data.control ? new Int32Array(data.control) : null;
    const step = (line, values) => {
      if (!control || Atomics.load(control, 0) === 2) return;
      Atomics.store(control, 0, 0);
      postMessage({type: 'paused', line, variables: JSON.parse(values)});
      if (Atomics.wait(control, 0, 0, 300000) === 'timed-out') {
        throw new Error('5분 동안 단계 실행이 없어 종료했습니다.');
      }
    };
    let sent = 0;
    const output = text => {
      // Both engine and UI bound output. Never insert student text as HTML.
      if (sent < 20000) postMessage({type: 'stdout', text: String(text)});
      sent += String(text).length;
    };
    const run = runtime.globals.get('run_lesson');
    const read = () => {
      if (!data.inputBuffer) throw new Error('대화형 input()에는 보안 격리가 필요합니다. serve.py로 실행해 주세요.');
      const state = new Int32Array(data.inputBuffer, 0, 2);
      Atomics.store(state, 0, 0);
      postMessage({type: 'input-request'});
      if (Atomics.wait(state, 0, 0, 300000) === 'timed-out') throw new Error('5분 동안 입력이 없어 종료했습니다.');
      return receiveInput(data.inputBuffer);
    };
    const interaction = (kind, text) => postMessage({type:'input-event', kind:String(kind), text:String(text).slice(0, 20000)});
    const result = run(data.code, '', step, output, read, interaction);
    const converted = result.toJs({dict_converter: Object.fromEntries});
    result.destroy(); run.destroy();
    postMessage({type: 'done', ...converted});
  } catch (error) {
    postMessage({type: 'error', message: String(error)});
  }
};
