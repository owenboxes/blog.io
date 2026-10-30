'use strict';
const $ = id => document.getElementById(id);
const example = 'total = 0\nfor number in range(1, 4):\n    total += number\nprint(total)';
const lab = $('lab');
let worker = null, control = null, active = false, paused = false;
let timer = null, selectedLine = null, previousVars = {}, expanded = false;
let inputBuffer = null, waitingInput = false;
const canStep = self.crossOriginIsolated && typeof SharedArrayBuffer !== 'undefined';
$('editor').value = example;

function status(message) { $('status').textContent = message; }
function clearConsole() {
  $('output').textContent = ''; $('input-log').textContent = '';
  $('input-history').hidden = true; $('input-prompt').textContent = '';
}
function setControls() {
  $('run').disabled = active && !paused;
  $('step').disabled = !canStep || (active && !paused);
  $('stop').disabled = !active;
  $('editor').disabled = active;
  $('stdin').disabled = !waitingInput;
  $('clear-output').disabled = active;
}
function gutter() {
  const lines = $('editor').value.split('\n');
  $('gutter').replaceChildren(...lines.map((_, i) => {
    const row = document.createElement('div');
    row.textContent = i + 1;
    if (i + 1 === selectedLine) row.className = 'current';
    return row;
  }));
  $('gutter').scrollTop = $('editor').scrollTop;
  // The active stripe scrolls with the text, independently of the toolbar.
  $('editor').style.backgroundImage = selectedLine ? `linear-gradient(to bottom, transparent ${(selectedLine-1)*24+16}px, #f1dfb6 ${(selectedLine-1)*24+16}px, #f1dfb6 ${selectedLine*24+16}px, transparent ${selectedLine*24+16}px)` : 'none';
  $('editor').style.backgroundAttachment = 'local';
  $('position').textContent = selectedLine ? `NEXT LINE ${selectedLine}` : 'LINE —';
}
function variables(values) {
  const entries = Object.entries(values);
  if (!entries.length) {
    $('variables').replaceChildren(Object.assign(document.createElement('p'), {className:'empty', textContent:'아직 생성된 변수가 없습니다.'}));
  } else {
    $('variables').replaceChildren(...entries.map(([name, value]) => {
      const row = document.createElement('div'); row.className = 'var-row';
      if (previousVars[name] !== value) row.classList.add('changed');
      const key = document.createElement('span'); key.textContent = name;
      const val = document.createElement('span'); val.textContent = value;
      row.append(key, val); return row;
    }));
  }
  previousVars = {...values};
}
function clearTimer() { clearTimeout(timer); timer = null; }
function armTimer() {
  clearTimer();
  timer = setTimeout(() => stop('실행 시간 10초 초과 · 코드는 유지했습니다.'), 10000);
}
function stop(message = '실행 중단 · 작성한 코드는 유지했습니다.') {
  clearTimer();
  if (worker) worker.terminate();
  worker = null; control = null; active = false; paused = false;
  inputBuffer = null; waitingInput = false; $('console-input').hidden = true; $('stdin').value = '';
  selectedLine = null; gutter(); setControls(); status(message);
}
function resume(mode) {
  if (!control || !paused) return;
  Atomics.store(control, 0, mode);
  Atomics.notify(control, 0);
  paused = false; setControls(); armTimer();
  status(mode === 2 ? '전체 실행 중…' : '다음 실행 줄로 이동 중…');
}
function start(stepping) {
  if (active) { if (paused) resume(stepping ? 1 : 2); return; }
  if (stepping && !canStep) { status('한 단계 실행에는 보안 격리가 필요합니다. 안내를 확인해 주세요.'); return; }
  const code = $('editor').value;
  if (!code.trim()) { status('실행할 코드를 입력해 주세요.'); return; }
  if (code.length > 50000) { status('첫 버전은 코드 50,000자까지 지원합니다.'); return; }
  active = true; paused = false; selectedLine = null; previousVars = {};
  clearConsole(); variables({}); gutter(); setControls();
  status('Python 실행환경 불러오는 중… 첫 실행은 잠시 걸릴 수 있습니다.');
  const current = new Worker('./worker.js'); worker = current;
  // Initialization is allowed more time than student code execution.
  timer = setTimeout(() => stop('실행환경 로딩 시간 초과 · 인터넷 연결 후 다시 시도해 주세요.'), 60000);
  current.onerror = event => { if (worker !== current) return; stop('실행환경 로딩 실패 · 인터넷/CDN 연결을 확인해 주세요.'); $('output').textContent = event.message || 'Worker error'; };
  current.onmessage = ({data}) => {
    if (worker !== current) return;
    if (data.type === 'ready') {
      if (canStep) {
        control = new Int32Array(new SharedArrayBuffer(4)); Atomics.store(control, 0, stepping ? 1 : 2);
        inputBuffer = new SharedArrayBuffer(65544);
      }
      current.postMessage({type:'execute', code, control:control?.buffer, inputBuffer});
      armTimer(); status(stepping ? '첫 실행 줄을 준비하고 있습니다…' : '전체 실행 중…');
    } else if (data.type === 'input-event') {
      const label = data.kind === 'prompt' ? '입력 안내' : '입력값';
      if (data.kind === 'prompt') $('input-prompt').textContent = data.text || '(안내 문구 없음)';
      const log = $('input-log');
      log.textContent = (log.textContent + `${label}: ${data.text}\n`).slice(-20000);
      $('input-history').hidden = false;
    } else if (data.type === 'input-request') {
      clearTimer(); waitingInput = true; paused = false;
      $('console-input').hidden = false; $('stdin').value = ''; setControls();
      status('입력 대기 · 값을 입력하고 Enter를 누르세요.');
      $('stdin').focus({preventScroll:true});
      $('stdin').scrollIntoView({block:'nearest'});
    } else if (data.type === 'paused') {
      clearTimer(); paused = true; selectedLine = data.line; variables(data.variables);
      const top = (selectedLine-1)*24;
      if (top < $('editor').scrollTop || top > $('editor').scrollTop + $('editor').clientHeight-50) $('editor').scrollTop = Math.max(0, top-65);
      gutter(); setControls(); status(`일시정지 · ${data.line}번 줄 실행 전입니다. 한 단계를 눌러 진행하세요.`);
    } else if (data.type === 'stdout') {
      if ($('output').textContent.length < 20000) $('output').textContent += data.text;
      $('output').scrollTop = $('output').scrollHeight;
    } else if (data.type === 'done') {
      $('output').textContent = data.output + (data.error ? '\n'+data.error : '');
      variables(data.variables); stop(data.error ? '오류로 종료 · 아래 메시지를 확인해 주세요.' : '실행 완료 · 변수와 출력 결과를 확인해 보세요.');
    } else if (data.type === 'error') {
      $('output').textContent += '\n'+data.message; stop('실행 오류 · 작성한 코드는 유지했습니다.');
    }
  };
}
function expand(value) {
  expanded = value; lab.classList.toggle('expanded', value);
  $('expand').textContent = value ? '⤡ 원래 크기' : '⤢ 확대';
  $('expand').setAttribute('aria-pressed', String(value));
  document.body.style.overflow = value ? 'hidden' : '';
  syncDock();
}
function syncDock() {
  const shown = !$('article-view').hidden;
  lab.classList.toggle('docked', shown && !expanded && !document.fullscreenElement);
  const layout = dockLayout(shown, expanded, !!document.fullscreenElement, lab.getBoundingClientRect().height);
  document.body.style.paddingBottom = `${layout.padding}px`;
}
const dockObserver = new ResizeObserver(() => syncDock());
dockObserver.observe(lab);
window.addEventListener('resize', syncDock);
$('toggle-lab').onclick = async () => {
  const open = $('lab-body').hidden;
  if (!open && active) {
    if (!confirm('실행을 중단하고 실습창을 접을까요? 작성한 코드는 유지됩니다.')) return;
    stop();
  }
  if (!open && document.fullscreenElement) await document.exitFullscreen();
  if (!open) expand(false);
  $('lab-body').hidden = !open;
  $('toggle-lab').setAttribute('aria-expanded', String(open));
  $('chevron').textContent = open ? '−' : '＋';
  syncDock();
};
$('run').onclick = () => start(false);
$('step').onclick = () => start(true);
$('stop').onclick = () => stop();
$('console-input').onsubmit = event => {
  event.preventDefault();
  if (!waitingInput || !inputBuffer) return;
  if (!submitInput(inputBuffer, $('stdin').value)) { status('입력은 UTF-8 기준 65,536바이트까지 가능합니다.'); return; }
  waitingInput = false; $('console-input').hidden = true; $('stdin').value = '';
  setControls(); armTimer(); status('입력을 받아 실행을 이어갑니다…');
};
$('reset').onclick = () => { stop('환경 초기화 완료 · 작성한 코드는 유지했습니다.'); clearConsole(); previousVars = {}; variables({}); };
$('restore').onclick = () => {
  if (!confirm('작성한 코드를 지우고 처음 예제로 되돌릴까요?')) return;
  stop('처음 예제로 복원했습니다.'); $('editor').value = example; clearConsole(); previousVars = {}; variables({}); gutter();
};
$('expand').onclick = async () => { if (document.fullscreenElement) await document.exitFullscreen(); expand(!expanded); };
$('fullscreen').onclick = async () => {
  if (document.fullscreenElement) { await document.exitFullscreen(); return; }
  try {
    if (!lab.requestFullscreen) throw new Error('unsupported');
    await lab.requestFullscreen();
  } catch (_) { expand(true); status('이 브라우저에서는 페이지 영역 확대를 사용합니다.'); }
};
document.addEventListener('fullscreenchange', () => { $('fullscreen').textContent = document.fullscreenElement ? '전체화면 종료' : '전체화면'; syncDock(); });
document.addEventListener('keydown', event => { if (event.key === 'Escape' && expanded && !document.fullscreenElement) expand(false); });
$('clear-output').onclick = clearConsole;
$('editor').oninput = () => { selectedLine = null; gutter(); };
$('editor').onscroll = () => { $('gutter').scrollTop = $('editor').scrollTop; };
$('editor').onkeydown = event => {
  if (event.key !== 'Tab' || event.shiftKey) return;
  event.preventDefault();
  const e = event.target; e.setRangeText('    ', e.selectionStart, e.selectionEnd, 'end'); gutter();
};
function showList(show) {
  if (active) {
    if (!confirm('실행을 중단하고 이동할까요? 코드는 이 페이지에 유지됩니다.')) return false;
    stop();
  }
  expand(false); $('listing').hidden = !show; $('article-view').hidden = show;
  syncDock();
  window.scrollTo({top:0, behavior:'instant'}); return true;
}
document.querySelectorAll('[data-home]').forEach(a => a.onclick = event => { event.preventDefault(); if (showList(true)) history.replaceState(null, '', '#notes'); });
if (!canStep) {
  $('support-note').hidden = false;
  $('support-note').textContent = '한 단계 실행에는 cross-origin isolation이 필요합니다. 제공된 serve.py로 localhost:8765를 여세요. 이 환경에서는 전체 실행만 사용할 수 있습니다. 공개 배포 전 별도 설정이 필요합니다.';
}
if (location.hash === '#notes' || location.hash.startsWith('#category-')) showList(true);
gutter(); setControls(); syncDock();

