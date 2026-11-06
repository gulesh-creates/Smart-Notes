import { test, describe } from 'node:test';
import assert from 'node:assert';
import { formatLiveCountdown } from './components/github/GitHubTokenManager';
import { reconcileGitHubCredentials } from './storage/db';
import { GitHubCredential } from '@smartnotes/shared';

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

describe('GitHub Credentials Reconciliation & Deletion Preservation', () => {
  const tokenA: GitHubCredential = {
    id: 'tok-a',
    username: 'userA',
    token: 'ghp_tokenA',
    label: 'Token A',
    expiresAt: null,
    createdAt: 1000,
    updatedAt: 1000
  };

  const tokenB: GitHubCredential = {
    id: 'tok-b',
    username: 'userB',
    token: 'ghp_tokenB',
    label: 'Token B',
    expiresAt: null,
    createdAt: 1000,
    updatedAt: 1000
  };

  test('prevents deleted token from being resurrected by stale remote sync', () => {
    // Token B was deleted locally at timestamp 2000
    const local = [tokenA];
    const remote = [tokenA, tokenB]; // Remote still has older Token B (updatedAt: 1000)
    const tombstones = { 'tok-b': 2000 };

    const result = reconcileGitHubCredentials(local, remote, tombstones);
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].id, 'tok-a');
    assert.strictEqual(result.find(c => c.id === 'tok-b'), undefined);
  });

  test('discards credentials with isDeleted flag', () => {
    const remote = [
      tokenA,
      { ...tokenB, isDeleted: true, updatedAt: 3000 }
    ];
    const result = reconcileGitHubCredentials([], remote, {});
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].id, 'tok-a');
  });

  test('allows re-created or newer remote token if updatedAt is after tombstone', () => {
    const tombstones = { 'tok-b': 2000 };
    // Remote has an updated/recreated Token B at timestamp 3000 (after tombstone)
    const newerTokenB: GitHubCredential = {
      ...tokenB,
      updatedAt: 3000
    };
    const result = reconcileGitHubCredentials([tokenA], [tokenA, newerTokenB], tombstones);
    assert.strictEqual(result.length, 2);
    assert.ok(result.some(c => c.id === 'tok-b'));
  });
});

