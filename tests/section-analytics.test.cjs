const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../src/assets/js/section-analytics.js'), 'utf8');
function page(ready = true) {
  const events = []; const timers = new Map(); let id = 0; let callback; let onLoad; let onVisibility;
  const heading = {}; const removed = []; const observed = [];
  const document = { visibilityState: 'visible',
    querySelectorAll: () => [{ dataset: { analyticsSection: 'portfolio' }, querySelector: () => heading }],
    querySelector: () => ({ addEventListener: (_, listener) => onLoad = listener }),
    addEventListener: (_, listener) => onVisibility = listener };
  const api = { sendEvent: (...args) => events.push(JSON.parse(JSON.stringify(args))) };
  const window = { IntersectionObserver: class { constructor(cb, options) { callback = cb; assert(options.threshold.includes(0.5)); } observe(target) { observed.push(target); } unobserve(target) { removed.push(target); } },
    setTimeout: (cb, delay) => { assert.equal(delay, 1000); timers.set(++id, cb); return id; }, clearTimeout: key => timers.delete(key) };
  if (ready) window.AhrefsAnalytics = api;
  vm.runInNewContext(source, { window, document });
  return { events, removed, observed, heading, window,
    intersect: ratio => callback([{ target: heading, isIntersecting: ratio > 0, intersectionRatio: ratio }]),
    tick: () => { for (const [key, cb] of [...timers]) { timers.delete(key); cb(); } },
    visibility: state => { document.visibilityState = state; onVisibility(); },
    load: () => { window.AhrefsAnalytics = api; onLoad(); } };
}
test('A section heading visible for one second sends the agreed event and property once', () => {
  const p = page(); assert.equal(p.observed[0], p.heading); p.intersect(0.5); assert.equal(p.events.length, 0); p.tick();
  assert.deepEqual(p.events, [['section_view', { props: { section: 'portfolio' } }]]);
  p.intersect(0); p.intersect(1); p.tick(); assert.equal(p.events.length, 1); assert.equal(p.removed[0], p.heading);
});
test('Fast scrolling and a barely visible heading do not count', () => {
  const p = page(); p.intersect(0.49); p.tick(); p.intersect(1); p.intersect(0); p.tick(); assert.equal(p.events.length, 0);
});
test('Leaving and returning starts a fresh uninterrupted visibility period', () => {
  const p = page(); p.intersect(1); p.intersect(0); p.tick(); p.intersect(1); p.tick(); assert.equal(p.events.length, 1);
});
test('Background tabs do not qualify views; returning starts a fresh timer', () => {
  const p = page(); p.intersect(1); p.visibility('hidden'); p.tick(); assert.equal(p.events.length, 0);
  p.visibility('visible'); assert.equal(p.events.length, 0); p.tick(); assert.equal(p.events.length, 1);
});
test('Delayed Ahrefs script receives qualified views once it loads', () => {
  const p = page(false); p.intersect(1); p.tick(); assert.equal(p.events.length, 0); p.load(); p.load(); assert.equal(p.events.length, 1);
});
test('Unavailable or throwing analytics does not break the page', () => {
  const p = page(false); p.intersect(1); assert.doesNotThrow(p.tick);
  const q = page(); q.window.AhrefsAnalytics.sendEvent = () => { throw new Error('blocked'); }; q.intersect(1); assert.doesNotThrow(q.tick);
});
test('Browsers without IntersectionObserver skip section tracking safely', () => {
  assert.doesNotThrow(() => vm.runInNewContext(source, { window: {}, document: {} }));
});
test('The built homepage tracks all eight agreed sections and thank-you has no section markers', () => {
  const root = path.join(__dirname, '../public');
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const names = [...html.matchAll(/data-analytics-section="([^"]+)"/g)].map(m => m[1]);
  assert.deepEqual(names, ['hero', 'portfolio', 'about', 'reviews', 'pricing', 'contact', 'faq', 'company']);
  assert(!fs.readFileSync(path.join(root, 'koszonom/index.html'), 'utf8').includes('data-analytics-section='));
  assert.match(html, /<script src="\/assets\/js\/section-analytics.js\?v=[a-f0-9]+" defer><\/script>/);
});
