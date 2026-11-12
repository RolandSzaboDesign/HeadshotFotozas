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
