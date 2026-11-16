import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildQuery, countWords, yearTerms, fmtTerm, normalizeDomain, googleUrl, normalizeState } from '../lib/query.js';
import { DEFAULT_TEMPLATES, DEFAULT_BLOCKS } from '../lib/defaults.js';
import { toCsv, toUrl } from '../lib/util.js';

test('basic German template', () => {
  const q = buildQuery({
    profession: ['Dachdecker'], location: ['Bielefeld'], signals: ['Copyright 2015'],
    excludes: ['gelbeseiten.de', 'https://www.11880.com/', '-site:dasoertliche.de'],
  });
  assert.equal(q, '"Dachdecker" "Bielefeld" "Copyright 2015" -site:gelbeseiten.de -site:11880.com -site:dasoertliche.de');
});

test('full combination with intitle and OR groups', () => {
  const q = buildQuery({
    profession: ['Dachdecker'], intitle: true, location: ['33602', '33604', '33605'],
    signals: ['Copyright 2013', 'Erstellt mit Jimdo'], excludes: ['facebook.com'],
  });
  assert.equal(q, 'intitle:"Dachdecker" ("33602" OR "33604" OR "33605") ("Copyright 2013" OR "Erstellt mit Jimdo") -site:facebook.com');
});

test('intitle wraps every OR term, location override, site and extra', () => {
  const q = buildQuery({ profession: ['funeral home', 'mortuary'], intitle: true, location: ['Ohio'], site: 'weebly.com', extra: 'inurl:http://  -inurl:https' }, { location: ['Dayton, OH'] });
  assert.equal(q, '(intitle:"funeral home" OR intitle:"mortuary") "Dayton, OH" site:weebly.com inurl:http:// -inurl:https');
});

test('raw terms pass through untouched', () => {
  assert.equal(fmtTerm('inurl:"index.php?option=com_content"'), 'inurl:"index.php?option=com_content"');
  assert.equal(fmtTerm('"already quoted"'), '"already quoted"');
  assert.equal(fmtTerm('  two   spaces '), '"two spaces"');
  assert.equal(fmtTerm('say "hi"'), '"say hi"');
});

test('duplicates are removed and empty state builds nothing', () => {
  assert.equal(buildQuery({ signals: ['a', 'a', ' '] }), '"a"');
  assert.equal(buildQuery({}), '');
});

test('word count ignores OR and punctuation', () => {
  assert.equal(countWords('("Copyright 2012" OR "Powered by Homestead") -site:yelp.com'), 6);
});

test('year terms', () => {
  assert.deepEqual(yearTerms(2018, 2012, 2), ['Copyright 2012', 'Copyright 2014', 'Copyright 2016', 'Copyright 2018']);
  assert.deepEqual(yearTerms(2014, 2014, 1, 'last updated'), ['last updated 2014']);
});

test('domains and google URLs', () => {
  assert.equal(normalizeDomain('https://www.Yelp.com/biz/x'), 'yelp.com');
  assert.equal(googleUrl('"a b"', { googleDomain: 'google.de', hl: 'de' }), 'https://www.google.de/search?q=%22a+b%22&hl=de');
});

test('normalizeState drops junk', () => {
  const s = normalizeState({ profession: 'x', intitle: 1, site: 3, bogus: true });
  assert.deepEqual(s.profession, []);
  assert.equal(s.intitle, true);
  assert.equal(s.site, '');
  assert.ok(!('bogus' in s));
});

test('every default template builds a query, ids are unique', () => {
  for (const t of DEFAULT_TEMPLATES) assert.ok(buildQuery(t.state).length > 5, t.name);
  assert.equal(new Set(DEFAULT_TEMPLATES.map((t) => t.id)).size, DEFAULT_TEMPLATES.length);
  assert.equal(new Set(DEFAULT_BLOCKS.map((b) => b.id)).size, DEFAULT_BLOCKS.length);
});

test('csv escapes and blocks formula injection', () => {
  assert.equal(toCsv([['a,b', '=HYPERLINK("x")', '+1 555 1234', ['x', 'y']]]), '"a,b","\'=HYPERLINK(""x"")",+1 555 1234,"x; y"');
});

test('toUrl', () => {
  assert.equal(toUrl('example.com/a#b'), 'https://example.com/a');
  assert.equal(toUrl('http://old-site.de'), 'http://old-site.de/');
  assert.equal(toUrl('javascript:alert(1)'), null);
  assert.equal(toUrl('localhost'), null);
});
