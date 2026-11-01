'use strict';
// Only approved, public entries belong here. Never add private draft metadata.
/* editor-catalog:start */
const BLOG_POSTS = [{"id":"loop-demo","title":"반복문을 이해하는 가장 좋은 방법","category":"Python","kind":"note","published":true,"publishedAt":"2026-10-30T15:32:22Z","sequence":1,"date":"2026.10.30","href":"#article","summary":"코드를 잠시 멈추고, 변수와 흐름을 한 줄씩 따라가 봅니다.","sample":true},{"id":"python-data-exceptions","title":"데이터 공부 중 다시 만난 반복문과 예외 처리","category":"Python","kind":"note","date":"2026.10.20","published":true,"publishedAt":"2026-10-31T05:18:45Z","sequence":2,"href":"posts\/python-data-exceptions.html","summary":"NumPy와 pandas를 공부하다가 조건문·반복문과 예외 처리 예제가 함께 나오면서 흐름을 이해하기 어려웠다. for, float(), try\/except가 각각 무슨 역할을 하는지 상세한…"},{"id":"agent-ui-and-runtime","title":"에이전트 UI가 보이는 것과 연구가 돌아가는 것은 달랐다","category":"AI 에이전트","kind":"note","date":"2026.10.21","published":true,"publishedAt":"2026-10-31T05:18:45Z","sequence":3,"href":"posts\/agent-ui-and-runtime.html","summary":"Hermes 기반 R&D Lab을 구성하면서 PowerShell 설정 스크립트 오류와 프로필별 플러그인 불일치를 겪었다. 설정 단계를 다시 진행했고, 플러그인을 동기화한 뒤에는 UI가 표시된다고…"},{"id":"agent-results-and-usage","title":"완료 건수보다 실제 산출물과 사용량을 확인하고 싶었다","category":"AI 에이전트","kind":"note","date":"2026.10.22","published":true,"publishedAt":"2026-10-31T05:18:45Z","sequence":4,"href":"posts\/agent-results-and-usage.html","summary":"R&D Lab 상태를 보다가 완료 작업은 표시되지만 프로젝트로 이어진 결과가 부족하다고 느꼈다. 완료 숫자만 보는 대신 어떤 산출물이 만들어졌는지, 어떤 기준으로 심화 작업으로 넘어가는지 점검을…"},{"id":"application-flow","title":"만든 결과물 너머 프로그램의 공통 흐름을 질문했다","category":"개발 구조","kind":"note","date":"2026.10.23","published":true,"publishedAt":"2026-10-31T05:18:45Z","sequence":5,"href":"posts\/application-flow.html","summary":"AI와 함께 결과물을 만드는 경험이 쌓여도, 다음 작업에서 같은 구조를 스스로 설명할 수 있는지는 별개의 문제였다. 그래서 지금까지 만든 것들을 공통 로직 관점에서 분석해 달라고 요청했다."},{"id":"python-loop-scope","title":"for문 밖에서 변수를 쓸 수 있는 이유가 궁금했다","category":"Python","kind":"note","date":"2026.10.25","published":true,"publishedAt":"2026-10-31T05:18:45Z","sequence":6,"href":"posts\/python-loop-scope.html","summary":"지점별 매출을 집계하는 예제를 읽다가, 반복문 밖의 print(total)이 왜 반복문에서 다룬 값을 사용할 수 있는지 질문했다. total[branch]를 별도의 지역변수처럼 생각한 부분도…"},{"id":"git-config-scope","title":"Git 설정의 범위와 우선순위를 다르게 읽기","category":"Git·개발환경","kind":"note","date":"2026.10.26","published":true,"publishedAt":"2026-10-31T05:18:45Z","sequence":7,"href":"posts\/git-config-scope.html","summary":"Git의 system·global·local 설정을 공부하면서 범위가 넓은 것과 우선 적용되는 것을 혼동했다. system은 회사 전체, global은 개인 계정, local은 특정 저장소에…"},{"id":"practice-git-config","title":"Git 설정 출처와 저장소 경계 확인","category":"Git·개발환경","kind":"practice","date":"2026.10.26","published":true,"publishedAt":"2026-10-31T05:18:45Z","sequence":8,"href":"posts\/practice-git-config.html","summary":"PC의 별도 연습 저장소에서 사용하는 Git 터미널 실습이다. 블로그 Python 실행창에서 실행하지 않는다. 이 문제는 연습 제안이며 작성자의 완료 성과를 뜻하지 않는다."},{"id":"git-tracking-and-history","title":"add·commit·gitignore와 되돌리기를 상태로 구분하기","category":"Git·개발환경","kind":"note","date":"2026.10.27","published":true,"publishedAt":"2026-10-31T05:18:45Z","sequence":9,"href":"posts\/git-tracking-and-history.html","summary":"add와 commit을 비슷하게 생각했던 부분을 ‘변경 선택 → 버전 기록 → 원격 공유’로 나누어 정리했다."},{"id":"practice-git-history","title":"Git 추적·이력 비교·되돌리기 구분","category":"Git·개발환경","kind":"practice","date":"2026.10.27","published":true,"publishedAt":"2026-10-31T05:18:45Z","sequence":10,"href":"posts\/practice-git-history.html","summary":"PC 터미널에서, 원격 연결이 없고 버려도 되는 새 연습 저장소만 사용한다. 실제 프로젝트에서 reset --hard를 시험하지 않는다. Python 실행창용 코드가 아니다."},{"id":"python-values-and-formatting","title":"변수의 값과 화면에 표시하는 형식을 구분하기","category":"Python","kind":"note","date":"2026.10.28","published":true,"publishedAt":"2026-10-31T05:18:45Z","sequence":11,"href":"posts\/python-values-and-formatting.html","summary":"Python의 변수 이름, int·float·str·bool, 비교·논리 연산과 문자열 출력 형식을 공부했다. 편집기인 VS Code와 Python 인터프리터도 구분했다."},{"id":"practice-python-values","title":"변수 재할당·bool·출력 형식 비교","category":"Python","kind":"practice","date":"2026.10.28","published":true,"publishedAt":"2026-10-31T05:18:45Z","sequence":12,"href":"posts\/practice-python-values.html","summary":"블로그 Python 실행창에서 예제를 하나씩 실행할 수 있다. 먼저 결과를 예상하고 실제 실행 결과와 비교한다. 작성자의 기존 수행 결과가 아닌 교육용 실습이다."},{"id":"python-collections-and-input","title":"리스트의 추가, 딕셔너리의 키, 입력 검증을 구분하기","category":"Python","kind":"note","date":"2026.10.29","published":true,"publishedAt":"2026-10-31T05:18:45Z","sequence":13,"href":"posts\/python-collections-and-input.html","summary":"원소가 세 개인 리스트의 인덱스 3에 대입하면 새 항목이 생기는지 질문했다. 기존 TIL의 AI 정정에서는 일반 인덱스 대입은 기존 항목 수정이며 새 원소는 append나 extend로 추가한다고…"},{"id":"practice-python-input","title":"컬렉션 변경과 숫자 입력 검증","category":"Python","kind":"practice","date":"2026.10.29","published":true,"publishedAt":"2026-10-31T05:18:45Z","sequence":14,"href":"posts\/practice-python-input.html","summary":"블로그 Python 실행창에서 실행할 수 있는 작은 예제로 나누었다. 각 문제는 연습 제안이며 본인의 실제 결과는 별도로 기록한다."},{"id":"python-loops-and-comprehensions","title":"반복 종료 조건과 중첩 컴프리헨션의 순서를 읽기","category":"Python","kind":"note","date":"2026.10.30","published":true,"publishedAt":"2026-10-31T05:18:45Z","sequence":15,"href":"posts\/python-loops-and-comprehensions.html","summary":"문자열 출력 형식을 공부한 뒤 for·while을 작성하고, 컴프리헨션으로 변환·필터링·조건별 값을 만드는 실습을 했다. 수업 예시와 개인 작성 코드는 구분했고, 당시 실행 출력은 별도로 남기지…","updatedAt":"2026-11-01T01:05:39.939Z"},{"id":"practice-python-loops","title":"입력 횟수·반복 종료·중첩 컴프리헨션","category":"Python","kind":"practice","date":"2026.10.30","published":true,"publishedAt":"2026-10-31T05:18:45Z","sequence":16,"href":"posts\/practice-python-loops.html","summary":"Python 실행창에서 문제를 나누어 풀고 무한 반복이 생기면 중단 버튼을 사용한다. 실제 인증·보안 시스템이나 결제 코드를 만드는 예제가 아니다.","updatedAt":"2026-11-01T01:05:39.939Z"}];
/* editor-catalog:end */

function catalogModel(rows, kind = 'all') {
  const posts = (Array.isArray(rows) ? rows : []).filter(p => p && p.published === true &&
    typeof p.title === 'string' && p.title.trim() && typeof p.category === 'string' &&
    ['note','practice'].includes(p.kind) && Number.isFinite(Date.parse(p.publishedAt)) &&
    typeof p.href === 'string' && (p.href === '#article' || /^posts\/[a-zA-Z0-9_-]+\.html$/.test(p.href)) &&
    (kind === 'all' || p.kind === kind)
  ).slice().sort((a,b) => Date.parse(b.publishedAt)-Date.parse(a.publishedAt) || (b.sequence||0)-(a.sequence||0));
  const groups = [];
  for (const post of posts) {
    let group = groups.find(g => g.category === post.category);
    if (!group) { group = {category:post.category, posts:[]}; groups.push(group); }
    group.posts.push(post);
  }
  return {posts, latest:posts[0] || null, groups};
}

function renderCatalog(doc, rows, openArticle) {
  const get = id => doc.getElementById(id);
  const siteRoot = doc.body?.dataset?.siteRoot || '';
  const currentPost = doc.body?.dataset?.postId || 'loop-demo';
  const make = (tag, cls, text) => {
    const node = doc.createElement(tag); if (cls) node.className = cls;
    if (text !== undefined) node.textContent = text; return node;
  };
  const link = (post, cls) => {
    const a = make('a', cls);
    a.href = post.href === '#article' && currentPost !== 'loop-demo' ? siteRoot+'index.html#article' : siteRoot+post.href;
    if (post.href === '#article' && currentPost === 'loop-demo') a.addEventListener('click', event => {
      event.preventDefault(); openArticle();
    });
    return a;
  };
  const all = catalogModel(rows);
  const categoryIds = new Map(all.groups.map((group,i) => [group.category,'category-'+i]));
  for (const id of ['published-posts','mobile-published-posts']) {
    const host = get(id); host.replaceChildren();
    for (const post of all.posts) {
      const a = link(post, 'sidebar-post');
      if (post.id === currentPost) a.setAttribute('aria-current','page');
      a.append(make('small','',post.date),make('span','',post.title)); host.append(a);
    }
    if (!all.posts.length) host.append(make('p','catalog-empty','아직 공개된 글이 없습니다.'));
  }
  get('published-count').textContent = `${all.posts.length}개의 공개 글`;
  const featured = get('latest-note'); featured.replaceChildren();
  const latest = catalogModel(rows, 'note').latest;
  if (latest) {
    const a = link(latest, 'latest-card');
    const meta = make('div','latest-meta');
    meta.append(make('span','',latest.category + (latest.sample ? ' · 예시 글' : ' · 학습 노트')),make('time','',latest.date));
    a.append(meta,make('h2','',latest.title),make('p','',latest.summary || ''),make('span','read-link','읽기 ↗')); featured.append(a);
  } else featured.append(make('p','catalog-empty','아직 공개된 학습 노트가 없습니다.'));
  function show(kind) {
    const model = catalogModel(rows, kind), host = get('post-groups'); host.replaceChildren();
    for (const group of model.groups) {
      const section = make('section','post-group'), heading = make('h3','',group.category);
      section.id = categoryIds.get(group.category);
      heading.append(make('small','',`${group.posts.length}개`)); section.append(heading);
      const list = make('ul','post-rows');
      for (const post of group.posts) {
        const li = make('li',''), a = link(post,'post-row');
        a.append(make('time','',post.date),make('span','post-row-title',post.title),
          make('small','post-kind',post.kind === 'practice' ? '실습' : '노트'),make('span','row-arrow','↗'));
        li.append(a); list.append(li);
      }
      section.append(list); host.append(section);
    }
    if (!model.posts.length) host.append(make('p','catalog-empty',kind === 'practice' ? '아직 공개된 실습이 없습니다.' : '아직 공개된 글이 없습니다.'));
    for (const button of doc.querySelectorAll('[data-post-kind]')) button.setAttribute('aria-pressed',String(button.dataset.postKind === kind));
    for (const a of doc.querySelectorAll('[data-category-index]')) a.hidden = !model.groups.some(g => g.category === a.dataset.categoryIndex);
  }
  const index = get('category-index'); index.replaceChildren();
  all.groups.forEach((group, i) => {
    const a = make('a','',group.category); a.href = '#category-'+i; a.dataset.categoryIndex = group.category;
    index.append(a);
  });
  for (const button of doc.querySelectorAll('[data-post-kind]')) button.addEventListener('click', () => show(button.dataset.postKind));
  show('all');
}

if (typeof document !== 'undefined') renderCatalog(document, BLOG_POSTS, () => {
  if (showList(false)) history.replaceState(null, '', '#article');
});
