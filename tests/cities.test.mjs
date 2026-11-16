import { test } from 'node:test';
import assert from 'node:assert/strict';
import { US_CITIES, TOP_PICKS, REGIONS } from '../lib/cities.js';
import { CITY_LISTS } from '../lib/defaults.js';

test('city list size, range and uniqueness', () => {
  assert.ok(US_CITIES.length >= 200, `only ${US_CITIES.length} cities`);
  for (const c of US_CITIES) {
    assert.ok(c.k >= 25 && c.k <= 250, `${c.label} out of range (${c.k}k)`);
    assert.ok(c.region, `${c.label} has no region`);
  }
  assert.equal(new Set(US_CITIES.map((c) => c.label)).size, US_CITIES.length);
});

test('top picks: 20, all in the list, all Midwest/South', () => {
  assert.equal(TOP_PICKS.length, 20);
  for (const t of TOP_PICKS) {
    const c = US_CITIES.find((x) => x.label === t);
    assert.ok(c, `${t} missing from US_CITIES`);
    assert.ok(c.top && ['Midwest', 'South'].includes(c.region), t);
  }
  assert.deepEqual(CITY_LISTS['US · ★ Top 20 picks (25k–250k)'], TOP_PICKS);
});

test('every state is assigned to exactly one region', () => {
  const all = Object.values(REGIONS).flat();
  assert.equal(new Set(all).size, all.length);
});
