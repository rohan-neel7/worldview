import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { computeFreshness, FreshnessStatus } from '../index.js';

describe('Freshness Evaluation', () => {
  const NOW = 1755600000000; // Fixed reference timestamp
  const MAX_AGE_MS = 60000; // 1 minute max age

  test('classifies recent observations within maxAge as LIVE', () => {
    const observedAt = new Date(NOW - 20000).toISOString(); // 20s old
    const receivedAt = new Date(NOW - 1000).toISOString(); // 1s ago
    const res = computeFreshness(observedAt, receivedAt, MAX_AGE_MS, NOW);

    assert.equal(res.status, FreshnessStatus.LIVE);
    assert.equal(res.ageMs, 20000);
  });

  test('classifies observations between 1x and 2x maxAge as RECENT', () => {
    const observedAt = new Date(NOW - 90000).toISOString(); // 1.5 min old
    const receivedAt = new Date(NOW - 2000).toISOString();
    const res = computeFreshness(observedAt, receivedAt, MAX_AGE_MS, NOW);

    assert.equal(res.status, FreshnessStatus.RECENT);
  });

  test('classifies observations between 2x and 5x maxAge as STALE', () => {
    const observedAt = new Date(NOW - 200000).toISOString(); // 3.3 min old
    const receivedAt = new Date(NOW - 2000).toISOString();
    const res = computeFreshness(observedAt, receivedAt, MAX_AGE_MS, NOW);

    assert.equal(res.status, FreshnessStatus.STALE);
  });

  test('classifies observations older than 5x maxAge as EXPIRED', () => {
    const observedAt = new Date(NOW - 400000).toISOString(); // 6.6 min old
    const receivedAt = new Date(NOW - 1000).toISOString();
    const res = computeFreshness(observedAt, receivedAt, MAX_AGE_MS, NOW);

    assert.equal(res.status, FreshnessStatus.EXPIRED);
  });

  test('does NOT mark stale observations as LIVE merely because receivedAt is fresh', () => {
    // Satellite observation from 20 minutes ago received 2 seconds ago
    const observedAt = new Date(NOW - 20 * 60 * 1000).toISOString();
    const receivedAt = new Date(NOW - 2000).toISOString();
    const res = computeFreshness(observedAt, receivedAt, MAX_AGE_MS, NOW);

    // Must be EXPIRED/STALE, never LIVE
    assert.notEqual(res.status, FreshnessStatus.LIVE);
    assert.equal(res.status, FreshnessStatus.EXPIRED);
  });

  test('handles missing or unparseable observedAt as UNKNOWN', () => {
    const res1 = computeFreshness(null, new Date().toISOString(), MAX_AGE_MS, NOW);
    assert.equal(res1.status, FreshnessStatus.UNKNOWN);

    const res2 = computeFreshness('invalid-date', new Date().toISOString(), MAX_AGE_MS, NOW);
    assert.equal(res2.status, FreshnessStatus.UNKNOWN);
  });
});
