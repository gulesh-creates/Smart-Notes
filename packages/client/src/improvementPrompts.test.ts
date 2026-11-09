import { describe, it } from 'node:test';
import assert from 'node:assert';
import { Item, NoteBlock } from '@smartnotes/shared';

describe('Project Improvement Prompts & Tasks Domain Logic', () => {
  it('correctly creates an improvement prompt note block', () => {
    const promptBlock: NoteBlock = {
      id: 'imp-1',
      type: 'task_item',
      checked: false,
      content: 'Fix button click execution lag in today tab',
      meta: {
        title: 'Fix Button Lag',
        category: 'prompt',
        createdAt: 1731170000000,
        completedAt: null
      }
    };

    assert.strictEqual(promptBlock.type, 'task_item');
    assert.strictEqual(promptBlock.checked, false);
    assert.strictEqual(promptBlock.content, 'Fix button click execution lag in today tab');
    assert.strictEqual(promptBlock.meta?.category, 'prompt');
  });

  it('separates active prompts at the top and completed prompts at the bottom', () => {
    const blocks: NoteBlock[] = [
      {
        id: 'imp-1',
        type: 'task_item',
        checked: false,
        content: 'Active Task 1',
        meta: { title: 'Task 1', createdAt: 100 }
      },
      {
        id: 'imp-2',
        type: 'task_item',
        checked: true,
        content: 'Completed Task 2',
        meta: { title: 'Task 2', createdAt: 200, completedAt: 250 }
      },
      {
        id: 'imp-3',
        type: 'task_item',
        checked: false,
        content: 'Active Task 3',
        meta: { title: 'Task 3', createdAt: 300 }
      }
    ];

    const activeItems = blocks.filter(b => b.type === 'task_item' && !b.checked);
    const completedItems = blocks.filter(b => b.type === 'task_item' && Boolean(b.checked));

    assert.strictEqual(activeItems.length, 2);
    assert.strictEqual(completedItems.length, 1);
    assert.strictEqual(activeItems[0].id, 'imp-1');
    assert.strictEqual(activeItems[1].id, 'imp-3');
    assert.strictEqual(completedItems[0].id, 'imp-2');
  });

  it('marks active item as completed and moves it to completed group', () => {
    let blocks: NoteBlock[] = [
      { id: 'imp-1', type: 'task_item', checked: false, content: 'Prompt 1' },
      { id: 'imp-2', type: 'task_item', checked: false, content: 'Prompt 2' }
    ];

    // Toggle imp-1 to completed
    const completedTimestamp = Date.now();
    blocks = blocks.map(b => {
      if (b.id === 'imp-1') {
        return {
          ...b,
          checked: true,
          meta: { ...b.meta, completedAt: completedTimestamp }
        };
      }
      return b;
    });

    const active = blocks.filter(b => !b.checked);
    const completed = blocks.filter(b => Boolean(b.checked));

    assert.strictEqual(active.length, 1);
    assert.strictEqual(completed.length, 1);
    assert.strictEqual(active[0].id, 'imp-2');
    assert.strictEqual(completed[0].id, 'imp-1');
    assert.strictEqual(completed[0].meta?.completedAt, completedTimestamp);
  });

  it('unchecking a completed prompt restores it to active group', () => {
    let blocks: NoteBlock[] = [
      { id: 'imp-1', type: 'task_item', checked: true, content: 'Prompt 1', meta: { completedAt: 12345 } }
    ];

    // Uncheck imp-1
    blocks = blocks.map(b => {
      if (b.id === 'imp-1') {
        return {
          ...b,
          checked: false,
          meta: { ...b.meta, completedAt: null }
        };
      }
      return b;
    });

    const active = blocks.filter(b => !b.checked);
    assert.strictEqual(active.length, 1);
    assert.strictEqual(active[0].checked, false);
    assert.strictEqual(active[0].meta?.completedAt, null);
  });
});

