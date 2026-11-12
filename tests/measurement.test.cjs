const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, '../src/assets/js/measurement.js'), 'utf8');

function consentPage() {
  const focusCalls = [];
  let scrollY = 0;
  const document = { activeElement: null, cookie: '' };
  function control(name, consent) {
    const listeners = {};
    return {
      dataset: { consent },
      addEventListener(event, callback) { listeners[event] = callback; },
      focus(options) {
        document.activeElement = this;
        focusCalls.push({ name, options });
        if (!options?.preventScroll) scrollY = name === 'settings' ? 9000 : 8500;
      },
      click() { document.activeElement = this; listeners.click?.(); }
    };
  }
  const settings = control('settings');
  const denied = control('denied', 'denied');
  const granted = control('granted', 'granted');
  const banner = { hidden: true, querySelector: () => denied };
  document.getElementById = id => id === 'measurement-consent' ? banner : settings;
  document.querySelector = () => null;
  document.querySelectorAll = () => [denied, granted];
  document.createElement = () => ({});
  document.head = { appendChild() {} };
  const storage = { getItem: () => null, setItem() {}, removeItem() {} };
  const window = {
    localStorage: storage, sessionStorage: storage,
    location: { hostname: 'localhost', pathname: '/', reload() {} }
  };
  vm.runInNewContext(source, { window, document });
  return { settings, denied, granted, banner, focusCalls,
    get scrollY() { return scrollY; },
    set scrollY(value) { scrollY = value; } };
}

for (const choice of ['granted', 'denied']) {
  test(`First-visit ${choice} keeps the visitor at the hero`, () => {
    const page = consentPage();
    assert.equal(page.banner.hidden, false);
    page[choice].click();
    assert.equal(page.banner.hidden, true);
    assert.equal(page.scrollY, 0);
    assert.equal(page.focusCalls.length, 0);
  });
  test(`Reopened banner restores focus without scrolling after ${choice}`, () => {
    const page = consentPage();
    page.scrollY = 9000;
    page.settings.click();
    assert.equal(page.banner.hidden, false);
    assert.equal(page.scrollY, 9000);
    page[choice].click();
    assert.equal(page.banner.hidden, true);
    assert.equal(page.scrollY, 9000);
    assert.deepEqual(page.focusCalls.map(call => call.name), ['denied', 'settings']);
    assert(page.focusCalls.every(call => call.options?.preventScroll));
  });
}

function scenario({ choice, pathname = '/', receipt, valid = true, honeypot = '', fetchImpl = async () => ({ ok: true }) } = {}) {
  const local = new Map(); const session = new Map(); const scripts = []; const requests = []; const navigations = []; const timeouts = [];
  if (choice) local.set('headshot.ads-consent.v1', JSON.stringify({ choice, at: Date.now() }));
  if (receipt) session.set('headshot.callback-receipt.v1', JSON.stringify(receipt));
  const store = map => ({ getItem: key => map.get(key) ?? null, setItem: (key, value) => map.set(key, value), removeItem: key => map.delete(key) });
  const button = { disabled: false }; const status = { hidden: true, dataset: {} }; const listeners = {}; const attrs = {};
  const form = { reportValidity: () => valid, addEventListener: (name, cb) => listeners[name] = cb,
    querySelector: sel => sel === 'button[type="submit"]' ? button : status,
    setAttribute: (key, value) => attrs[key] = value, removeAttribute: key => delete attrs[key], getAttribute: () => '/koszonom' };
  const document = { cookie: '', getElementById: () => null, querySelector: sel => sel === 'form[name="kapcsolat"]' ? form : null,
    querySelectorAll: () => [], createElement: () => ({}), head: { appendChild: script => scripts.push(script) } };
  const window = { localStorage: store(local), sessionStorage: store(session), crypto: { randomUUID: () => 'test-receipt' },
    location: { hostname: 'localhost', pathname, assign: url => navigations.push(url) }, setTimeout: (callback, delay) => { timeouts.push({ callback, delay }); return 1; }, clearTimeout() {} };
  class Data extends Map { constructor() { super([['form-name', 'kapcsolat'], ['nev', 'Teszt & Név'], ['telefon', '+36 20 123 4567'], ['very-special-field', honeypot]]); } }
  vm.runInNewContext(source, { window, document, FormData: Data, URLSearchParams, AbortController, fetch: (...args) => { requests.push(args); return fetchImpl(...args); } });
  return { window, session, scripts, requests, navigations, button, status, attrs, timeouts, submit: () => listeners.submit({ preventDefault() {} }),
    conversions: () => window.dataLayer.filter(args => args[0] === 'event' && args[1] === 'conversion') };
}

test('Successful form posts encoded fields and redirects only after acknowledgement', async () => {
  const p = scenario(); await p.submit();
  assert.equal(p.requests.length, 1); assert.equal(p.requests[0][0], '/');
  const body = new URLSearchParams(p.requests[0][1].body);
  assert.equal(body.get('form-name'), 'kapcsolat'); assert.equal(body.get('nev'), 'Teszt & Név');
  assert.deepEqual(p.navigations, ['/koszonom']); assert(p.session.has('headshot.callback-receipt.v1'));
  assert.equal(p.button.disabled, false); assert.equal(p.attrs['aria-busy'], undefined);
});
for (const failure of ['http', 'network']) test(`Form ${failure} failure allows retry without a conversion receipt`, async () => {
  const p = scenario({ fetchImpl: async () => { if (failure === 'http') return { ok: false }; throw new Error(failure); } });
  await p.submit(); assert.equal(p.status.dataset.error, 'true'); assert.equal(p.button.disabled, false);
  assert.equal(p.navigations.length, 0); assert.equal(p.session.size, 0);
  await p.submit(); assert.equal(p.requests.length, 2);
});
test('A stalled form request aborts after 20 seconds and becomes retryable', async () => {
  const p = scenario({ fetchImpl: (_, options) => new Promise((resolve, reject) => options.signal.addEventListener('abort', () => reject(new Error('aborted')))) });
  const pending = p.submit();
  assert.equal(p.timeouts[0].delay, 20000);
  p.timeouts[0].callback(); await pending;
  assert.equal(p.requests[0][1].signal.aborted, true);
  assert.equal(p.status.dataset.error, 'true'); assert.equal(p.button.disabled, false);
  assert.equal(p.navigations.length, 0); assert.equal(p.session.size, 0);
});
test('Concurrent submissions produce a single request', async () => {
  let resolve; const p = scenario({ fetchImpl: () => new Promise(r => resolve = r) });
  const pending = p.submit(); assert.equal(p.button.disabled, true); await p.submit(); assert.equal(p.requests.length, 1);
  resolve({ ok: true }); await pending;
});
for (const options of [{ valid: false }, { honeypot: 'spam' }]) test(`Invalid or honeypot submission is blocked: ${JSON.stringify(options)}`, async () => {
  const p = scenario(options); await p.submit(); assert.equal(p.requests.length, 0); assert.equal(p.navigations.length, 0);
});
test('Denied advertising consent still permits form submission without tracking', async () => {
  const p = scenario({ choice: 'denied' }); await p.submit();
  assert.deepEqual(p.navigations, ['/koszonom']); assert.equal(p.session.size, 0); assert.equal(p.scripts.length, 0);
});
test('Google tag stays unloaded before explicit advertising consent', () => { assert.equal(scenario().scripts.length, 0); });
test('Confirmed thank-you visit records one conversion and consumes receipt', () => {
  const p = scenario({ choice: 'granted', pathname: '/koszonom/', receipt: { id: 'lead-id', at: Date.now() } });
  p.scripts[0].onload(); p.scripts[0].onload(); assert.equal(p.conversions().length, 1); assert.equal(p.session.size, 0);
});
for (const receipt of [undefined, { id: 'expired', at: Date.now() - 31 * 60000 }, { id: 'future', at: Date.now() + 60000 }, { at: Date.now() }]) test(`Direct/invalid thank-you visit cannot create a conversion: ${JSON.stringify(receipt)}`, () => {
  const p = scenario({ choice: 'granted', pathname: '/koszonom', receipt }); p.scripts[0].onload(); assert.equal(p.conversions().length, 0);
});
