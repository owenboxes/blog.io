// Runs site/edit-link.js against a minimal page: the editor link stays hidden
// for visitors and appears only after the owner opts in with ?owner=on.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.resolve(__dirname, '../site/edit-link.js'), 'utf8');

function visit(search, store, {blockedStorage = false} = {}) {
  const appended = [];
  const replaced = [];
  const storage = {
    getItem: key => { if (blockedStorage) throw Error('blocked'); return store.has(key) ? store.get(key) : null; },
    setItem: (key, value) => { if (blockedStorage) throw Error('blocked'); store.set(key, String(value)); },
    removeItem: key => { if (blockedStorage) throw Error('blocked'); store.delete(key); },
  };
  const context = {
    URL, URLSearchParams,
    OWNER_EDITOR_ORIGIN: 'https://editor.example.workers.dev',
    location: {search, pathname: '/blog.io/posts/a.html', hash: '#section-1'},
    history: {state: null, replaceState: (state, title, url) => replaced.push(url)},
    localStorage: storage,
    document: {
      body: {dataset: {postId: 'python-loop-scope'}},
      getElementById: id => (id === 'article' ? {append: node => appended.push(node)} : null),
      createElement: () => ({style: {}, setAttribute(name, value) { this[name] = value; }}),
    },
  };
  context.globalThis = context;
  vm.runInNewContext(source, context);
  return {appended, replaced};
}

function check(condition, message) { if (!condition) throw Error(message); }

const store = new Map();
check(visit('', store).appended.length === 0, 'visitors must not see the editor link');

const on = visit('?owner=on&ref=x', store);
check(on.appended.length === 1, 'owner opt-in shows the link');
check(on.appended[0].href === 'https://editor.example.workers.dev/admin?post=python-loop-scope', 'link targets this post');
check(on.replaced[0] === '/blog.io/posts/a.html?ref=x#section-1', 'opt-in parameter is removed, others kept');

check(visit('', store).appended.length === 1, 'opt-in persists in this browser');

const off = visit('?owner=off', store);
check(off.appended.length === 0, 'opt-out hides the link immediately');
check(off.replaced[0] === '/blog.io/posts/a.html#section-1', 'opt-out parameter is removed');
check(visit('', store).appended.length === 0, 'opt-out persists');

check(visit('?owner=on', new Map(), {blockedStorage: true}).appended.length === 0, 'blocked storage keeps the link hidden without errors');

console.log('Edit link visibility: 9 checks passed');
