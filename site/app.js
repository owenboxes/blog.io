'use strict';
const $ = id => document.getElementById(id);
const example = $('editor').value.trim() || 'total = 0\nfor number in range(1, 4):\n    total += number\nprint(total)';
const lab = $('lab');
let worker = null, control = null, active = false, paused = false;
let timer = null, selectedLine = null, errorLine = null, previousVars = {}, expanded = false;
let inputBuffer = null, waitingInput = false;
let stepMode = false;
const canStep = self.crossOriginIsolated && typeof SharedArrayBuffer !== 'undefined';
$('editor').value = example;

function status(message) { $('status').textContent = message; }
function clearConsole() {
  $('output').textContent = ''; $('input-log').textContent = '';
  $('input-history').hidden = true; $('input-prompt').textContent = '';
  clearProblem();
}
function clearProblem() {
  errorLine = null; $('problems').hidden = true;
  $('problem-location').onclick = null;
  gutter();
}
function showProblem(diagnostic, fallback) {
  const d = diagnostic || {type:'실행환경 오류',message:fallback};
  const lines = $('editor').value.split('\n');
  errorLine = Number.isInteger(d.line) && d.line >= 1 && d.line <= lines.length ? d.line : null;
  $('problem-type').textContent = d.type || '오류';
  $('problem-message').textContent = d.message || fallback || '오류 정보를 확인하지 못했습니다.';
  $('problem-source').textContent = errorLine ? lines[errorLine-1] : '';
  $('problem-location').textContent = errorLine ? `lesson.py:${errorLine}${d.column ? ':'+d.column : ''}` : '위치 정보 없음';
  $('problem-location').disabled = errorLine === null;
  $('problem-location').onclick = () => {
    if (errorLine === null) return;
    const start = lines.slice(0,errorLine-1).reduce((sum,line)=>sum+line.length+1,0);
    $('editor').focus({preventScroll:true});
    $('editor').setSelectionRange(start,start+lines[errorLine-1].length);
    $('editor').scrollTop = Math.max(0,(errorLine-1)*24-48);
    gutter();
  };
  $('problems').hidden = false; gutter();
  status(errorLine ? `오류 · lesson.py:${errorLine} · ${d.type || '오류'}` : '실행환경 오류 · 문제 패널을 확인해 주세요.');
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
    if (i + 1 === errorLine) row.className = 'error';
    return row;
  }));
  $('gutter').scrollTop = $('editor').scrollTop;
  // The active stripe scrolls with the text, independently of the toolbar.
  const markedLine = errorLine || selectedLine, color = errorLine ? '#f6d4d2' : '#f1dfb6';
  $('editor').style.backgroundImage = markedLine ? `linear-gradient(to bottom, transparent ${(markedLine-1)*24+16}px, ${color} ${(markedLine-1)*24+16}px, ${color} ${markedLine*24+16}px, transparent ${markedLine*24+16}px)` : 'none';
  $('editor').style.backgroundAttachment = 'local';
  $('position').textContent = errorLine ? `ERROR ${errorLine}` : selectedLine ? `LINE ${selectedLine}` : 'LINE —';
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
  stepMode = mode === 1;
  if (!stepMode) { selectedLine = null; gutter(); }
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
  stepMode = stepping;
  clearConsole(); variables({}); gutter(); setControls();
  status('Python 실행환경 불러오는 중… 첫 실행은 잠시 걸릴 수 있습니다.');
  const current = new Worker((document.body.dataset?.siteRoot || './')+'worker.js?v=b00a81622d11'); worker = current;
  // Initialization is allowed more time than student code execution.
  timer = setTimeout(() => stop('실행환경 로딩 시간 초과 · 인터넷 연결 후 다시 시도해 주세요.'), 60000);
  current.onerror = event => { if (worker !== current) return; stop('실행환경 로딩 실패 · 인터넷/CDN 연결을 확인해 주세요.'); $('output').textContent = event.message || 'Worker error'; showProblem(null,event.message || 'Python 실행환경을 불러오지 못했습니다.'); };
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
    } else if (data.type === 'executing') {
      if (!stepMode) return;
      selectedLine = data.line; gutter();
      status(`${data.line}번 줄 실행 중…`);
    } else if (data.type === 'paused') {
      if (!stepMode) return;
      clearTimer(); paused = true; selectedLine = data.line; variables(data.variables);
      const top = (selectedLine-1)*24;
      if (top < $('editor').scrollTop || top > $('editor').scrollTop + $('editor').clientHeight-50) $('editor').scrollTop = Math.max(0, top-65);
      gutter(); setControls();
      status(data.nextLine === null ? `${data.line}번 줄 실행 완료 · 한 단계를 누르면 종료합니다.` : `${data.line}번 줄 실행 완료 · 다음 실행 위치: ${data.nextLine ?? '?'}번 줄`);
    } else if (data.type === 'stdout') {
      if ($('output').textContent.length < 20000) $('output').textContent += data.text;
      $('output').scrollTop = $('output').scrollHeight;
    } else if (data.type === 'done') {
      $('output').textContent = data.output + (data.error ? '\n'+data.error : '');
      variables(data.variables); stop(data.error ? '오류로 종료 · 아래 메시지를 확인해 주세요.' : '실행 완료 · 변수와 출력 결과를 확인해 보세요.');
      if (data.error) showProblem(data.diagnostic,data.error);
    } else if (data.type === 'error') {
      $('output').textContent += '\n'+data.message; stop('실행 오류 · 작성한 코드는 유지했습니다.');
      showProblem(null,data.message);
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
  const shown = !$('article-view').hidden && document.body.dataset?.lab !== 'off';
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
$('editor').oninput = () => { selectedLine = null; clearProblem(); };
$('editor').onscroll = () => { $('gutter').scrollTop = $('editor').scrollTop; };
$('editor').onkeydown = event => {
  if (event.key !== 'Tab' || event.shiftKey) return;
  event.preventDefault();
  const e = event.target; e.setRangeText('    ', e.selectionStart, e.selectionEnd, 'end'); selectedLine = null; clearProblem();
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
if (location.hash === '#notes' || location.hash.startsWith('#category-') || (!location.hash && !document.body.dataset?.postId)) showList(true);
gutter(); setControls(); syncDock();
