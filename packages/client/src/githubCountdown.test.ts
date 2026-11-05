import { test, describe } from 'node:test';
import assert from 'node:assert';
import { formatLiveCountdown } from './components/github/GitHubTokenManager';

describe('GitHub Token Countdown & Expiration Formatting', () => {
  const baseTime = 1700000000000; // Reference timestamp

  test('handles null/undefined expiration as Never Expires', () => {
    const resNull = formatLiveCountdown(null, baseTime);
    assert.strictEqual(resNull.status, 'never');
    assert.strictEqual(resNull.text, 'Never Expires');

    const resUndef = formatLiveCountdown(undefined as any, baseTime);
    assert.strictEqual(resUndef.status, 'never');
    assert.strictEqual(resUndef.text, 'Never Expires');
  });

  test('formats future active expiration with days, hours, minutes, seconds', () => {
    // 30 days ahead
    const expiresAt = baseTime + 30 * 86400000 + 4 * 3600000 + 20 * 60000 + 15000;
    const res = formatLiveCountdown(expiresAt, baseTime);
    assert.strictEqual(res.status, 'active');
    assert.ok(res.text.includes('Expires in 30d 4h 20m 15s'));
  });

  test('marks less than 7 days as warning status', () => {
    // 3 days ahead
    const expiresAt = baseTime + 3 * 86400000 + 12 * 3600000;
    const res = formatLiveCountdown(expiresAt, baseTime);
    assert.strictEqual(res.status, 'warning');
    assert.ok(res.text.includes('Expires in 3d 12h'));
  });

  test('formats countdown within same day (hours and minutes)', () => {
    // 5 hours 30 mins ahead
    const expiresAt = baseTime + 5 * 3600000 + 30 * 60000 + 45000;
    const res = formatLiveCountdown(expiresAt, baseTime);
    assert.strictEqual(res.status, 'warning');
    assert.ok(res.text.includes('Expires in 5h 30m 45s'));
  });

  test('formats past expiration as Expired in days/hours ago', () => {
    // Expired 2 days ago
    const expiredAt = baseTime - 2 * 86400000;
    const res = formatLiveCountdown(expiredAt, baseTime);
    assert.strictEqual(res.status, 'expired');
    assert.ok(res.text.includes('Expired 2 days ago'));
  });

  test('formats past expiration as Expired in hours ago', () => {
    // Expired 3 hours ago
    const expiredAt = baseTime - 3 * 3600000;
    const res = formatLiveCountdown(expiredAt, baseTime);
    assert.strictEqual(res.status, 'expired');
    assert.ok(res.text.includes('Expired 3 hours ago'));
  });
});

