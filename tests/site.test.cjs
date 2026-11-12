const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.join(__dirname, '../public');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const attrs = tag => Object.fromEntries([...tag.matchAll(/([\w:-]+)="([^"]*)"/g)].map(m => [m[1], m[2].replaceAll('&amp;', '&')]));
function exists(url, relative = '/') {
  const u = new URL(url, 'https://headshotfotozas.hu' + relative);
  if (u.origin !== 'https://headshotfotozas.hu') return;
  const file = path.join(root, decodeURIComponent(u.pathname));
  assert(fs.existsSync(file), `Missing local URL: ${url}`);
  if (u.searchParams.has('v')) {
    assert.equal(u.searchParams.get('v'), crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex').slice(0, 12), `Stale asset version: ${url}`);
  }
}
for (const file of ['index.html', 'koszonom/index.html']) {
  test(`${file}: links, image variants and versioned assets resolve`, () => {
    const html = read(file); const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]);
    assert.equal(new Set(ids).size, ids.length, 'Duplicate HTML ids');
    assert.equal((html.match(/<h1\b/g) || []).length, 1);
    assert(!html.includes('{{') && !html.includes('{%'), 'Unrendered template');
    for (const tag of html.match(/<[\w-]+\b[^>]*>/g)) {
      const a = attrs(tag);
      for (const key of ['href', 'src', 'data-highres']) {
        if (!a[key]) continue;
        if (a[key].startsWith('#')) assert(ids.includes(a[key].slice(1)), `Missing anchor ${a[key]}`);
        else if (a[key].startsWith('/')) exists(a[key]);
      }
      if (a.srcset) for (const candidate of a.srcset.split(',')) exists(candidate.trim().split(/\s+/)[0]);
      if (tag.startsWith('<img ')) assert('alt' in a, 'Image missing alt');
      if (a.for) assert(ids.includes(a.for), `Label points to missing control ${a.for}`);
      for (const id of (a['aria-labelledby'] || '').split(' ').filter(Boolean)) assert(ids.includes(id));
    }
    for (const json of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) assert.doesNotThrow(() => JSON.parse(json[1]));
  });
}
test('CSS fonts/images and manifest icons exist', () => {
  for (const name of fs.readdirSync(path.join(root, 'assets/css')).filter(n => n.endsWith('.css'))) {
    for (const match of read('assets/css/' + name).matchAll(/url\(\s*['"]?([^)'"\s]+)['"]?\s*\)/g)) {
      if (!/^(data:|#|https?:)/.test(match[1])) exists(match[1], '/assets/css/' + name);
    }
  }
  for (const icon of JSON.parse(read('assets/favicons/site.webmanifest')).icons) exists(icon.src);
});
test('Thank-you page is noindex, crawlable and absent from sitemap', () => {
  assert.match(read('koszonom/index.html'), /name="robots" content="noindex, nofollow"/);
  assert(!read('sitemap.xml').includes('/koszonom'));
  assert(!read('robots.txt').includes('Disallow: /koszonom'));
  assert(read('sitemap.xml').includes('<loc>https://headshotfotozas.hu/</loc>'));
});
test('Netlify form has the required identity, controls and spam trap', () => {
  const html = read('index.html');
  assert.match(html, /<form[^>]+name="kapcsolat"[^>]+method="POST"[^>]+action="\/koszonom"[^>]+netlify/);
  for (const field of ['form-name', 'nev', 'telefon', 'very-special-field']) assert(html.includes(`name="${field}"`));
  assert.match(html, /<input[^>]+type="tel"[^>]+required/);
  assert.match(html, /class="form-status" role="status" aria-live="polite" hidden/);
});
