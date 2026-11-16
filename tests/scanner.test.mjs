import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  extractEmails, extractPhones, extractLinks, cfDecode, copyrightYears, lastUpdatedYears,
  detectBuilders, detectSignals, analyze, pickCandidates, scanSite, htmlToText, ageScore,
} from '../lib/scanner.js';

const cfEncode = (email, key = 0x42) =>
  key.toString(16).padStart(2, '0') + [...email].map((c) => (c.charCodeAt(0) ^ key).toString(16).padStart(2, '0')).join('');

test('emails: plain, mailto, entities, obfuscated, cloudflare', () => {
  const html = `
    <a href="mailto:Info%40Mueller-Dach.de?subject=Hi">Mail</a>
    <p>kontakt&#64;mueller-dach.de</p>
    <p>buero [at] mueller-dach [punkt] de</p>
    <p>office(at)example-roofing.com</p>
    <a class="__cf_email__" data-cfemail="${cfEncode('owner@funeral-home.com')}">[email protected]</a>
    <img src="logo@2x.png"> <script>dsn="https://0123456789abcdef0123@sentry.io/1"</script>
    <p>name@domain.com  max.mustermann@musterfirma.de</p>`;
  const emails = extractEmails(html).sort();
  assert.deepEqual(emails, [
    'buero@mueller-dach.de', 'info@mueller-dach.de', 'kontakt@mueller-dach.de',
    'office@example-roofing.com', 'owner@funeral-home.com',
  ]);
});

test('cfDecode round trip', () => {
  assert.equal(cfDecode(cfEncode('a.b@c.de', 0x7f)), 'a.b@c.de');
});

test('phones from tel: links and labelled text, fax skipped', () => {
  const links = [{ href: 'tel:+1%20(937)%20555-0100' }];
  const text = 'Phone: (937) 555-0100\nTelefon: 0521 / 12 34 56\nFax: 0521 / 12 34 57\nIn business since 1987';
  assert.deepEqual(extractPhones(text, links), ['+1 (937) 555-0100', '0521 / 12 34 56']);
});

test('copyright and last-updated years', () => {
  const t = '© 2009-2014 Schmidt GmbH\nCopyright (c) 2012 by Foo\nCopyright © Bestattungen Meier 2011\nLast updated: March 2013\nStand: 04.2015';
  assert.deepEqual(copyrightYears(t, 2026), [2014, 2012, 2011]);
  assert.deepEqual(lastUpdatedYears(t, 2026), [2013, 2015]);
  assert.deepEqual(copyrightYears('© 3000 future'), []);
});

test('builders: generator wins, old flag set', () => {
  const b = detectBuilders('<link href="/wp-content/x.css">', 'Microsoft FrontPage 4.0');
  assert.equal(b[0].name, 'Microsoft FrontPage');
  assert.equal(b[0].old, true);
  assert.ok(b.some((x) => x.name === 'WordPress'));
  assert.equal(detectBuilders('<footer>123 Homestead Ave</footer>').length, 0);
});

test('old-site signals', () => {
  const html = '<frameset><frame src="a.htm"></frameset><font color=red>Hi</font><embed src="intro.swf">';
  const text = 'Sie sind Besucher Nr. 004711 – Gästebuch – optimiert für Internet Explorer bei 1024x768';
  const keys = detectSignals(html, text).map((s) => s.key).sort();
  assert.deepEqual(keys, ['counter', 'flash', 'font', 'frames', 'guestbook', 'ie', 'resolution']);
});

test('htmlToText drops scripts and comments', () => {
  assert.equal(htmlToText('<p>A&amp;B</p><script>x="©2020"</script><!-- © 2021 --><div>C</div>'), 'A&B\nC');
});

test('candidate pages: same host, prioritised', () => {
  const links = extractLinks(`
    <a href="/kontakt.html">Kontakt</a><a href="impressum.php">Impressum</a>
    <a href="https://www.other.com/contact">x</a><a href="/about-us/">About</a><a href="/brochure.pdf">contact pdf</a>
    <frameset><frame src="main.htm"></frameset>`, 'http://www.dach.de/index.html');
  const c = pickCandidates(links, 'http://dach.de/').sort((a, b) => a.prio - b.prio).map((x) => x.href);
  assert.deepEqual(c, ['http://www.dach.de/main.htm', 'http://www.dach.de/impressum.php', 'http://www.dach.de/kontakt.html', 'http://www.dach.de/about-us/']);
});

test('analyze picks up title, viewport, socials', () => {
  const a = analyze(`<html><head><title>Meier &amp; Sohn</title><meta content="width=device-width" name="viewport">
    <meta name="generator" content="WordPress 4.7.2"></head><body>
    <a href="https://www.facebook.com/meierundsohn">fb</a><a href="https://www.facebook.com/sharer.php?u=x">share</a></body></html>`, 'https://meier.de/');
  assert.equal(a.title, 'Meier & Sohn');
  assert.equal(a.viewport, true);
  assert.equal(a.oldCms, 'WordPress 4.7');
  assert.deepEqual(a.socials, { facebook: 'https://www.facebook.com/meierundsohn' });
});

test('age score', () => {
  assert.equal(ageScore({ copyrightYear: 2012, mobile: false, https: false, oldBuilder: 'Homestead', signals: [1, 2, 3] }, 2026), 100);
  assert.equal(ageScore({ copyrightYear: 2025, mobile: true, https: true, signals: [] }, 2026), 0);
});

// ---- scanSite with a fake fetch

function fakeFetch(pages) {
  const calls = [];
  const fn = async (url) => {
    calls.push(url);
    if (url.startsWith('https://broken-ssl.com')) throw new TypeError('Failed to fetch');
    const body = pages[url];
    if (body == null) return { ok: false, status: 404, url, headers: { get: () => 'text/html' }, arrayBuffer: async () => new ArrayBuffer(0) };
    const enc = typeof body === 'string' ? new TextEncoder().encode(body) : body;
    return { ok: true, status: 200, url, headers: { get: () => 'text/html' }, arrayBuffer: async () => enc.buffer };
  };
  fn.calls = calls;
  return fn;
}

test('scanSite crawls home + imprint, merges and scores, falls back to http', async () => {
  // Latin-1 encoded page (very common on old German sites): "Gästebuch" with byte 0xE4.
  const latin = Uint8Array.from([...'<meta charset="iso-8859-1"><a href="impressum.htm">Impressum</a> G\xe4stebuch &copy; 2010'].map((c) => c.charCodeAt(0)));
  const fetch = fakeFetch({
    'http://broken-ssl.com/leistungen.html': latin,
    'http://broken-ssl.com/': '<title>Dach Meier</title><a href="/impressum.htm">Impressum</a>',
    'http://broken-ssl.com/impressum.htm': 'E-Mail: info(at)broken-ssl.com Tel.: 05241 / 123456 Erstellt mit Zeta Producer',
  });
  const r = await scanSite('https://broken-ssl.com/leistungen.html', { fetchImpl: fetch, maxPages: 4 });
  assert.equal(r.https, false);
  assert.equal(r.mobile, false);
  assert.deepEqual(r.emails, ['info@broken-ssl.com']);
  assert.deepEqual(r.phones, ['05241 / 123456']);
  assert.equal(r.copyrightYear, 2010);
  assert.equal(r.oldBuilder, 'Zeta Producer');
  assert.ok(r.signals.includes('Guestbook'));
  assert.equal(r.title, 'Dach Meier');
  assert.equal(r.pages.length, 3);
  assert.ok(r.score >= 80, 'score ' + r.score);
});

test('scanSite respects maxPages and throws on dead sites', async () => {
  const fetch = fakeFetch({
    'https://a.com/': '<a href="/contact">Contact</a><a href="/about">About</a><a href="/imprint">Imprint</a>',
    'https://a.com/contact': 'x', 'https://a.com/about': 'x', 'https://a.com/imprint': 'x',
  });
  const r = await scanSite('https://a.com/', { fetchImpl: fetch, maxPages: 2 });
  assert.equal(r.pages.length, 2);
  assert.equal(r.pages[1].url, 'https://a.com/imprint');
  await assert.rejects(scanSite('https://dead.com/', { fetchImpl: fakeFetch({}) }), /HTTP 404/);
});
