import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  AUTHORIZED_EMAILS,
  isAuthorizedEmail,
  SHARED_VAULT_ID,
  sanitizeItemForFirestore
} from './firebase/firebase';
import { Item } from '@smartnotes/shared';

describe('Multi-Account Access & Shared Vault Authorization', () => {
  it('authorizes gulesh.patel.csit@gmail.com with case insensitivity and whitespace trimming', () => {
    assert.equal(isAuthorizedEmail('gulesh.patel.csit@gmail.com'), true);
    assert.equal(isAuthorizedEmail('GULESH.PATEL.CSIT@GMAIL.COM'), true);
    assert.equal(isAuthorizedEmail('  gulesh.patel.csit@gmail.com  '), true);
  });

  it('authorizes gulesh788@gmail.com with case insensitivity and whitespace trimming', () => {
    assert.equal(isAuthorizedEmail('gulesh788@gmail.com'), true);
    assert.equal(isAuthorizedEmail('Gulesh788@Gmail.Com'), true);
    assert.equal(isAuthorizedEmail('  gulesh788@gmail.com  '), true);
  });

  it('strictly rejects any unauthorized third-party email addresses', () => {
    assert.equal(isAuthorizedEmail('attacker@gmail.com'), false);
    assert.equal(isAuthorizedEmail('other.gulesh@gmail.com'), false);
    assert.equal(isAuthorizedEmail(''), false);
    assert.equal(isAuthorizedEmail(null), false);
    assert.equal(isAuthorizedEmail(undefined), false);
  });

  it('defines SHARED_VAULT_ID as a canonical shared workspace identifier', () => {
    assert.equal(SHARED_VAULT_ID, 'gulesh_shared_vault');
    assert.equal(AUTHORIZED_EMAILS.length, 2);
  });

  it('sanitizes item for Firestore targeting the shared vault ID', () => {
    const item: Item = {
      id: 'test-note-1',
      kind: 'note',
      parentId: null,
      title: 'Shared Note Between PC and Phone',
      contentHtml: '<p>Synchronized note</p>',
      plainText: 'Synchronized note',
      isPinned: true,
      isDeleted: false,
      orderIndex: 0,
      createdAt: 1700000000000,
      updatedAt: 1700000000000,
      version: 1,
      assetIds: [],
      mediaAnnotations: []
    };

    const sanitized = sanitizeItemForFirestore(item, SHARED_VAULT_ID);
    assert.equal(sanitized.id, 'test-note-1');
    assert.equal(sanitized.title, 'Shared Note Between PC and Phone');
    assert.equal(sanitized.userId, 'gulesh_shared_vault');
  });
});

