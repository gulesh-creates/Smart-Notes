import test from 'node:test';
import assert from 'node:assert';
import request from 'http';
import app from './server';
import { dbService } from './db';
import { Item } from '@smartnotes/shared';

let serverInstance: any;
let serverPort = 4099;
let authToken = '';
let testUserId = '';

function apiRequest(method: string, path: string, body?: any, token?: string): Promise<{ status: number; body: any }> {
  return new Promise((resolve, reject) => {
    const postData = body ? JSON.stringify(body) : '';
    const req = request.request(
      {
        hostname: 'localhost',
        port: serverPort,
        path,
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(postData ? { 'Content-Length': Buffer.byteLength(postData) } : {}),
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        }
      },
      (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const parsed = data ? JSON.parse(data) : {};
            resolve({ status: res.statusCode || 500, body: parsed });
          } catch (e) {
            resolve({ status: res.statusCode || 500, body: data });
          }
        });
      }
    );
    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

test('Server setup', async () => {
  await new Promise<void>((resolve) => {
    serverInstance = app.listen(serverPort, () => resolve());
  });
});

test('Auth: Register and Login flow', async () => {
  const email = `testuser_${Date.now()}@example.com`;
  const registerRes = await apiRequest('POST', '/api/auth/register', {
    email,
    password: 'SecurePassword123!',
    displayName: 'Test Researcher'
  });

  assert.strictEqual(registerRes.status, 201);
  assert.ok(registerRes.body.token);
  assert.strictEqual(registerRes.body.user.email, email);

  authToken = registerRes.body.token;
  testUserId = registerRes.body.user.id;

  const loginRes = await apiRequest('POST', '/api/auth/login', {
    email,
    password: 'SecurePassword123!'
  });

  assert.strictEqual(loginRes.status, 200);
  assert.ok(loginRes.body.token);
});

test('Sync: Push and Pull items', async () => {
  const noteId = `note-${Date.now()}`;
  const testNote: Item = {
    id: noteId,
    kind: 'note',
    parentId: null,
    title: 'Cloud Synced Research Note',
    contentHtml: '<p>Verified production sync payload.</p>',
    plainText: 'Verified production sync payload.',
    isPinned: true,
    isDeleted: false,
    orderIndex: 0,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    version: 1,
    assetIds: [],
    mediaAnnotations: []
  };

  // Push mutation
  const pushRes = await apiRequest('POST', '/api/sync/push', {
    mutations: [
      {
        opId: 'op-1',
        itemId: noteId,
        action: 'upsert',
        baseVersion: 0,
        item: testNote,
        timestamp: Date.now()
      }
    ]
  }, authToken);

  assert.strictEqual(pushRes.status, 200);
  assert.deepStrictEqual(pushRes.body.acceptedOpIds, ['op-1']);
  assert.strictEqual(pushRes.body.conflicts.length, 0);

  // Pull items
  const pullRes = await apiRequest('POST', '/api/sync/pull', { sinceRevision: 0 }, authToken);
  assert.strictEqual(pullRes.status, 200);
  assert.ok(pullRes.body.items.some((i: Item) => i.id === noteId));
});

test('Sync: Concurrent edit triggers conflict detection without data loss', async () => {
  const noteId = `note-conflict-${Date.now()}`;
  const initialNote: Item = {
    id: noteId,
    kind: 'note',
    parentId: null,
    title: 'Conflict Test Base',
    contentHtml: '<p>Base version</p>',
    isPinned: false,
    isDeleted: false,
    orderIndex: 0,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    version: 1,
    assetIds: [],
    mediaAnnotations: []
  };

  // First client commits v1
  await apiRequest('POST', '/api/sync/push', {
    mutations: [{ opId: 'c1', itemId: noteId, action: 'upsert', baseVersion: 0, item: initialNote, timestamp: Date.now() }]
  }, authToken);

  // Client A pushes edit (advances server version to v2)
  const clientAEdit: Item = {
    ...initialNote,
    title: 'Title edited by Device A',
    contentHtml: '<p>Device A edits</p>',
    updatedAt: Date.now() + 1000
  };
  await apiRequest('POST', '/api/sync/push', {
    mutations: [{ opId: 'c2', itemId: noteId, action: 'upsert', baseVersion: 1, item: clientAEdit, timestamp: Date.now() }]
  }, authToken);

  // Client B pushes concurrent edit based on baseVersion 1!
  const clientBEdit: Item = {
    ...initialNote,
    title: 'Title edited by Device B',
    contentHtml: '<p>Device B concurrent offline edits</p>',
    updatedAt: Date.now() + 2000
  };
  const conflictPushRes = await apiRequest('POST', '/api/sync/push', {
    mutations: [{ opId: 'c3', itemId: noteId, action: 'upsert', baseVersion: 1, item: clientBEdit, timestamp: Date.now() }]
  }, authToken);

  assert.strictEqual(conflictPushRes.status, 200);
  assert.strictEqual(conflictPushRes.body.conflicts.length, 1);
  assert.strictEqual(conflictPushRes.body.conflicts[0].itemId, noteId);
  assert.strictEqual(conflictPushRes.body.conflicts[0].conflictType, 'concurrent_edit');
});

test('Server teardown', async () => {
  if (serverInstance) {
    await new Promise<void>((resolve) => serverInstance.close(() => resolve()));
  }
  await dbService.close();
});
