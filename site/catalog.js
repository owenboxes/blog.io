'use strict';
// Only approved, public entries belong here. Never add private draft metadata.
const BLOG_POSTS = [
  {id:'loop-demo', title:'반복문을 이해하는 가장 좋은 방법', category:'Python', kind:'note',
    published:true, publishedAt:'2026-10-30T15:32:22Z', sequence:1, date:'2026.10.30',
    href:'#article', summary:'코드를 잠시 멈추고, 변수와 흐름을 한 줄씩 따라가 봅니다.', sample:true}
];

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
  const make = (tag, cls, text) => {
    const node = doc.createElement(tag); if (cls) node.className = cls;
    if (text !== undefined) node.textContent = text; return node;
  };
  const link = (post, cls) => {
    const a = make('a', cls); a.href = post.href;
    if (post.href === '#article') a.addEventListener('click', event => {
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
      if (post.href === '#article') a.setAttribute('aria-current','page');
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
