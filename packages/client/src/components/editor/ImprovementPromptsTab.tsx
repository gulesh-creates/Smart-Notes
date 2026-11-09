import React, { useState } from 'react';
import { Item, NoteBlock } from '@smartnotes/shared';
import { IconChecklist, IconCheck, IconTrash, IconEdit, IconCopy } from '../icons/Icons';

export interface ImprovementPromptsTabProps {
  note: Item;
  onUpdateNote: (updated: Partial<Item>) => void;
  isMobile?: boolean;
}

export type ImprovementCategory = 'prompt' | 'bug' | 'feature' | 'improvement';

const CATEGORIES: { id: ImprovementCategory; label: string; icon: string; color: string; bg: string }[] = [
  { id: 'prompt', label: '⚡ Antigravity Prompt', icon: '⚡', color: 'var(--lime-primary, #b9f32a)', bg: 'rgba(185, 243, 42, 0.12)' },
  { id: 'bug', label: '🐛 Bug / Error', icon: '🐛', color: '#f87171', bg: 'rgba(248, 113, 113, 0.12)' },
  { id: 'feature', label: '🚀 Feature Request', icon: '🚀', color: '#38bdf8', bg: 'rgba(56, 189, 248, 0.12)' },
  { id: 'improvement', label: '🔧 UI / Improvement', icon: '🔧', color: '#c084fc', bg: 'rgba(192, 132, 252, 0.12)' }
];

export const ImprovementPromptsTab: React.FC<ImprovementPromptsTabProps> = ({
  note,
  onUpdateNote,
  isMobile = false
}) => {
  const blocks: NoteBlock[] = Array.isArray(note.blocks) ? note.blocks : [];

  // Form states
  const [newTitle, setNewTitle] = useState('');
  const [newPrompt, setNewPrompt] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<ImprovementCategory>('prompt');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editPrompt, setEditPrompt] = useState('');
  const [editTitle, setEditTitle] = useState('');

  // Extract improvement blocks (type === 'task_item')
  const improvementBlocks = blocks.filter(b => b.type === 'task_item');

  // Separate active (unchecked) and completed (checked)
  const activeItems = improvementBlocks.filter(b => !b.checked);
  const completedItems = improvementBlocks.filter(b => Boolean(b.checked));

  const saveBlocks = (newBlocks: NoteBlock[]) => {
    onUpdateNote({ blocks: newBlocks });
  };

  const handleAddImprovement = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPrompt.trim() && !newTitle.trim()) return;

    const titleText = newTitle.trim() || newPrompt.trim().substring(0, 60);
    const promptText = newPrompt.trim() || titleText;

    const newBlock: NoteBlock = {
      id: `imp-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      type: 'task_item',
      checked: false,
      content: promptText,
      meta: {
        title: titleText,
        category: selectedCategory,
        createdAt: Date.now(),
        completedAt: null
      }
    };

    // Prepend to active items so newest is on top of uncompleted items
    const nonTaskBlocks = blocks.filter(b => b.type !== 'task_item');
    const updatedTasks = [newBlock, ...improvementBlocks];
    saveBlocks([...nonTaskBlocks, ...updatedTasks]);

    setNewTitle('');
    setNewPrompt('');
  };

  const handleToggleCheck = (id: string) => {
    const nonTaskBlocks = blocks.filter(b => b.type !== 'task_item');
    const updatedTasks = improvementBlocks.map(item => {
      if (item.id === id) {
        const nextChecked = !item.checked;
        return {
          ...item,
          checked: nextChecked,
          meta: {
            ...item.meta,
            completedAt: nextChecked ? Date.now() : null
          }
        };
      }
      return item;
    });

    saveBlocks([...nonTaskBlocks, ...updatedTasks]);
  };

  const handleDeleteItem = (id: string) => {
    const updated = blocks.filter(b => b.id !== id);
    saveBlocks(updated);
  };

  const handleCopyPrompt = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2200);
    } catch (err) {
      console.warn('Clipboard copy failed:', err);
    }
  };

  const handleStartEdit = (item: NoteBlock) => {
    setEditingId(item.id);
    setEditTitle((item.meta?.title as string) || '');
    setEditPrompt(item.content || '');
  };

  const handleSaveEdit = (id: string) => {
    const updated = blocks.map(b => {
      if (b.id === id) {
        return {
          ...b,
          content: editPrompt.trim() || b.content,
          meta: {
            ...b.meta,
            title: editTitle.trim() || b.meta?.title
          }
        };
      }
      return b;
    });

    saveBlocks(updated);
    setEditingId(null);
  };

  const renderImprovementCard = (item: NoteBlock, isCompleted: boolean) => {
    const categoryId = (item.meta?.category as ImprovementCategory) || 'prompt';
    const catObj = CATEGORIES.find(c => c.id === categoryId) || CATEGORIES[0];
    const title = (item.meta?.title as string) || item.content.substring(0, 50);
    const createdAt = item.meta?.createdAt as number | undefined;
    const isCopied = copiedId === item.id;
    const isEditing = editingId === item.id;

    return (
      <div
        key={item.id}
        className="improvement-card"
        style={{
          background: isCompleted ? 'var(--bg-surface-subtle)' : 'var(--bg-surface-elevated)',
          border: isCompleted ? '1px dashed var(--border-subtle)' : '1.5px solid var(--border-medium)',
          borderRadius: 'var(--radius-card, 12px)',
          padding: isMobile ? '12px' : '16px',
          opacity: isCompleted ? 0.6 : 1,
          transition: 'all 0.25s ease',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
          boxShadow: isCompleted ? 'none' : 'var(--shadow-sm, 0 2px 8px rgba(0,0,0,0.1))'
        }}
      >
        {/* Card Header: Checkbox + Title + Category + Actions */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: 0 }}>
            {/* Checkbox */}
            <button
              type="button"
              onClick={() => handleToggleCheck(item.id)}
              style={{
                width: '24px',
                height: '24px',
                borderRadius: '6px',
                border: isCompleted ? '2px solid var(--text-tertiary)' : '2px solid var(--lime-primary)',
                background: isCompleted ? 'var(--border-medium)' : 'transparent',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                transition: 'all 0.15s ease'
              }}
              title={isCompleted ? 'Mark as Uncompleted (Move to Top)' : 'Mark as Completed (Move to Bottom)'}
            >
              {isCompleted && <IconCheck size={14} color="var(--text-main)" strokeWidth={3} />}
            </button>

            {/* Title & Category Badge */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <span
                  style={{
                    fontSize: '0.94rem',
                    fontWeight: 700,
                    color: isCompleted ? 'var(--text-tertiary)' : 'var(--text-main)',
                    textDecoration: isCompleted ? 'line-through' : 'none',
                    wordBreak: 'break-word'
                  }}
                >
                  {title}
                </span>

                <span
                  style={{
                    fontSize: '0.68rem',
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: 'var(--radius-pill, 12px)',
                    color: catObj.color,
                    background: catObj.bg,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    flexShrink: 0
                  }}
                >
                  {catObj.icon} {catObj.label.split(' ')[1] || catObj.label}
                </span>
              </div>

              {createdAt && (
                <span style={{ fontSize: '0.68rem', color: 'var(--text-tertiary)' }}>
                  {new Date(createdAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
                </span>
              )}
            </div>
          </div>

          {/* Quick Actions: Copy, Edit, Delete */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
            <button
              type="button"
              className="btn btn-sm"
              onClick={() => handleCopyPrompt(item.id, item.content)}
              style={{
                height: '30px',
                padding: '0 10px',
                fontSize: '0.74rem',
                fontWeight: 700,
                background: isCopied ? 'var(--lime-primary)' : 'var(--bg-surface)',
                color: isCopied ? '#000000' : 'var(--lime-primary)',
                border: isCopied ? '1px solid var(--lime-primary)' : '1px solid rgba(185, 243, 42, 0.3)',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                borderRadius: '6px',
                transition: 'all 0.15s ease'
              }}
              title="Copy prompt text to clipboard"
            >
              {isCopied ? (
                <>
                  <IconCheck size={13} strokeWidth={3} /> Copied!
                </>
              ) : (
                <>
                  <IconCopy size={13} /> Copy Prompt
                </>
              )}
            </button>

            <button
              type="button"
              className="btn btn-icon btn-sm"
              onClick={() => handleStartEdit(item)}
              title="Edit Prompt"
              style={{ width: '28px', height: '28px', color: 'var(--text-secondary)' }}
            >
              <IconEdit size={13} />
            </button>

            <button
              type="button"
              className="btn btn-icon btn-sm"
              onClick={() => handleDeleteItem(item.id)}
              title="Delete Prompt"
              style={{ width: '28px', height: '28px', color: 'var(--danger, #ef4444)' }}
            >
              <IconTrash size={13} />
            </button>
          </div>
        </div>

        {/* Prompt Content Box (ChatGPT / Antigravity styled box) */}
        {isEditing ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '6px' }}>
            <input
              type="text"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              placeholder="Improvement title..."
              style={{
                padding: '8px 12px',
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-medium)',
                borderRadius: '6px',
                color: 'var(--text-main)',
                fontSize: '0.86rem',
                outline: 'none'
              }}
            />
            <textarea
              value={editPrompt}
              onChange={(e) => setEditPrompt(e.target.value)}
              rows={4}
              style={{
                padding: '10px 12px',
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-medium)',
                borderRadius: '6px',
                color: 'var(--text-main)',
                fontSize: '0.84rem',
                fontFamily: 'Consolas, Monaco, monospace',
                outline: 'none',
                resize: 'vertical'
              }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button type="button" className="btn btn-sm" onClick={() => setEditingId(null)}>
                Cancel
              </button>
              <button type="button" className="btn btn-primary btn-sm" onClick={() => handleSaveEdit(item.id)}>
                Save Changes
              </button>
            </div>
          </div>
        ) : (
          <div
            style={{
              background: 'var(--bg-canvas, #0f1712)',
              border: '1px solid var(--border-subtle, rgba(255,255,255,0.08))',
              borderRadius: '8px',
              padding: '12px 14px',
              color: isCompleted ? 'var(--text-tertiary)' : 'var(--text-main)',
              fontFamily: 'Consolas, Monaco, "Courier New", monospace',
              fontSize: '0.82rem',
              lineHeight: 1.55,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              maxHeight: '300px',
              overflowY: 'auto',
              textDecoration: isCompleted ? 'line-through' : 'none'
            }}
          >
            {item.content}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="improvement-prompts-container" style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
      {/* Header Banner & Stats */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
          padding: '16px 20px',
          background: 'var(--bg-surface-elevated)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-card, 12px)'
        }}
      >
        <div>
          <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>⚡</span> Project Improvements & AI Prompts
          </h3>
          <p style={{ margin: '3px 0 0 0', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
            Write errors & prompt requirements for Antigravity. Check off items to move them to completed.
          </p>
        </div>

        {/* Counter Pills */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span
            className="badge"
            style={{
              background: 'var(--lime-primary)',
              color: '#000000',
              fontWeight: 800,
              padding: '4px 10px',
              fontSize: '0.74rem'
            }}
          >
            {activeItems.length} Pending
          </span>
          <span
            className="badge"
            style={{
              background: 'var(--bg-surface-subtle)',
              color: 'var(--text-secondary)',
              fontWeight: 600,
              padding: '4px 10px',
              fontSize: '0.74rem'
            }}
          >
            {completedItems.length} Completed
          </span>
        </div>
      </div>

      {/* Form: Add New Improvement Prompt */}
      <form
        onSubmit={handleAddImprovement}
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          padding: isMobile ? '14px' : '20px',
          background: 'var(--bg-surface)',
          border: '1.5px solid var(--border-medium)',
          borderRadius: 'var(--radius-card, 12px)',
          boxShadow: 'var(--shadow-sm)'
        }}
      >
        <div style={{ fontSize: '0.86rem', fontWeight: 800, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <IconChecklist size={16} color="var(--lime-primary)" />
          Add New Improvement / Antigravity Prompt
        </div>

        {/* Category Pills */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {CATEGORIES.map(cat => {
            const isSelected = selectedCategory === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCategory(cat.id)}
                style={{
                  padding: '5px 12px',
                  borderRadius: 'var(--radius-pill, 20px)',
                  fontSize: '0.76rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  border: isSelected ? `1.5px solid ${cat.color}` : '1px solid var(--border-subtle)',
                  background: isSelected ? cat.bg : 'transparent',
                  color: isSelected ? cat.color : 'var(--text-secondary)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  transition: 'all 0.15s ease'
                }}
              >
                <span>{cat.icon}</span>
                <span>{cat.label}</span>
              </button>
            );
          })}
        </div>

        {/* Title Input */}
        <input
          type="text"
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          placeholder="Title / Summary (e.g. Fix button click delay in today tab, Add project section...)"
          style={{
            padding: '10px 14px',
            background: 'var(--bg-surface-elevated)',
            border: '1.5px solid var(--border-medium)',
            borderRadius: 'var(--radius-sm, 8px)',
            color: 'var(--text-main)',
            fontSize: '0.88rem',
            outline: 'none',
            boxSizing: 'border-box'
          }}
        />

        {/* Prompt Textarea */}
        <textarea
          value={newPrompt}
          onChange={(e) => setNewPrompt(e.target.value)}
          placeholder="Write your prompt for Antigravity or error explanation here... (Directly copyable with 1 click)"
          rows={4}
          style={{
            padding: '12px 14px',
            background: 'var(--bg-canvas, #0f1712)',
            border: '1.5px solid var(--border-medium)',
            borderRadius: 'var(--radius-sm, 8px)',
            color: 'var(--text-main)',
            fontSize: '0.84rem',
            fontFamily: 'Consolas, Monaco, "Courier New", monospace',
            lineHeight: 1.5,
            outline: 'none',
            resize: 'vertical',
            boxSizing: 'border-box'
          }}
        />

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button
            type="submit"
            className="btn btn-primary btn-sm"
            style={{
              padding: '8px 20px',
              fontWeight: 800,
              fontSize: '0.84rem',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <span>+</span> Add Improvement Prompt
          </button>
        </div>
      </form>

      {/* SECTION 1: Active / Pending Improvements (TOP) */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: '0.78rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--lime-primary)', letterSpacing: '0.04em' }}>
            ⚡ Active Improvements ({activeItems.length})
          </span>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)' }}>
            Unchecked items stay at top
          </span>
        </div>

        {activeItems.map(item => renderImprovementCard(item, false))}

        {activeItems.length === 0 && (
          <div
            style={{
              padding: '28px 16px',
              textAlign: 'center',
              background: 'var(--bg-surface-elevated)',
              borderRadius: 'var(--radius-card, 12px)',
              border: '1px dashed var(--border-subtle)',
              color: 'var(--text-tertiary)',
              fontSize: '0.84rem'
            }}
          >
            🎉 All active improvements are completed! Add a new prompt above to track next goals.
          </div>
        )}
      </div>

      {/* SECTION 2: Completed / Resolved Improvements (BOTTOM) */}
      {completedItems.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid var(--border-subtle)', paddingTop: '16px' }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-tertiary)', letterSpacing: '0.04em' }}>
              ✓ Completed Improvements ({completedItems.length})
            </span>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)' }}>
              Faded & moved to bottom
            </span>
          </div>

          {completedItems.map(item => renderImprovementCard(item, true))}
        </div>
      )}
    </div>
  );
};
