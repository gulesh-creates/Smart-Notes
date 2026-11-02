import React, { useState } from 'react';
import { Item, wouldCreateCycle } from '@smartnotes/shared';
import { IconFolder, IconNote, IconClose } from '../icons/Icons';

export interface MoveItemModalProps {
  isOpen: boolean;
  movingItemId: string | null;
  items: Item[];
  onClose: () => void;
  onConfirmMove: (itemId: string, targetParentId: string | null) => void;
}

export const MoveItemModal: React.FC<MoveItemModalProps> = ({
  isOpen,
  movingItemId,
  items,
  onClose,
  onConfirmMove
}) => {
  const [selectedParentId, setSelectedParentId] = useState<string | null>(null);

  if (!isOpen || !movingItemId) return null;

  const movingItem = items.find(i => i.id === movingItemId);
  if (!movingItem) return null;

  // Filter out invalid destinations (items that would cause cycles)
  const availableParents = items.filter(candidate => {
    if (candidate.isDeleted) return false;
    // Cannot move an item into itself or into its own descendants!
    return !wouldCreateCycle(items, movingItemId, candidate.id);
  });

  return (
    <div
      className="modal-backdrop"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(18, 36, 26, 0.65)',
        backdropFilter: 'blur(6px)',
        zIndex: 2000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px'
      }}
    >
      <div
        className="modal-card"
        style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-medium)',
          borderRadius: 'var(--radius-card)',
          width: '100%',
          maxWidth: '480px',
          maxHeight: '80vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: 'var(--shadow-lg)',
          overflow: 'hidden'
        }}
      >
        {/* Header */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-main)' }}>Move Item</h3>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Moving "{movingItem.title}"</p>
          </div>
          <button type="button" className="btn btn-icon btn-sm" onClick={onClose}>
            <IconClose size={16} />
          </button>
        </div>

        {/* Destination List */}
        <div style={{ padding: '16px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {/* Root Option */}
          <div
            style={{
              padding: '10px 14px',
              borderRadius: 'var(--radius-sm)',
              border: selectedParentId === null ? '2px solid var(--lime-primary)' : '1px solid var(--border-subtle)',
              background: selectedParentId === null ? 'var(--lime-pale)' : 'var(--bg-surface-elevated)',
              color: selectedParentId === null ? '#12241A' : 'var(--text-main)',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '0.86rem',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
            onClick={() => setSelectedParentId(null)}
          >
            <IconFolder size={16} />
            <span>Workspace (Top-level Root)</span>
          </div>

          <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', margin: '8px 4px 4px 4px' }}>
            Choose Target Folder or Parent Note
          </div>

          {availableParents.map(target => {
            const isSelected = selectedParentId === target.id;
            return (
              <div
                key={target.id}
                style={{
                  padding: '9px 12px',
                  borderRadius: 'var(--radius-sm)',
                  border: isSelected ? '2px solid var(--lime-primary)' : '1px solid var(--border-subtle)',
                  background: isSelected ? 'var(--lime-pale)' : 'var(--bg-surface-elevated)',
                  color: isSelected ? '#12241A' : 'var(--text-main)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: '0.84rem'
                }}
                onClick={() => setSelectedParentId(target.id)}
              >
                {target.kind === 'folder' ? <IconFolder size={15} /> : <IconNote size={15} />}
                <span style={{ flex: 1 }}>{target.title || 'Untitled'}</span>
                <span className="badge" style={{ fontSize: '0.68rem' }}>{target.kind}</span>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'flex-end', gap: '8px', background: 'var(--bg-surface-subtle)' }}>
          <button type="button" className="btn btn-sm" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-sm btn-primary"
            onClick={() => {
              onConfirmMove(movingItemId, selectedParentId);
              onClose();
            }}
          >
            Move Here
          </button>
        </div>
      </div>
    </div>
  );
};

