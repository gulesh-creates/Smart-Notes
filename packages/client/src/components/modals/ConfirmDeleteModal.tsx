import React from 'react';
import { Item, getDescendantIds } from '@smartnotes/shared';
import { IconTrash, IconClose } from '../icons/Icons';

export interface ConfirmDeleteModalProps {
  isOpen: boolean;
  itemToDelete: Item | null;
  items: Item[];
  onClose: () => void;
  onConfirmDelete: (itemId: string) => void;
}

export const ConfirmDeleteModal: React.FC<ConfirmDeleteModalProps> = ({
  isOpen,
  itemToDelete,
  items,
  onClose,
  onConfirmDelete
}) => {
  if (!isOpen || !itemToDelete) return null;

  const isFolder = itemToDelete.kind === 'folder';
  const descendantIds = getDescendantIds(items, itemToDelete.id);
  const totalItemsCount = 1 + descendantIds.size;

  const handleConfirm = () => {
    onConfirmDelete(itemToDelete.id);
    onClose();
  };

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
      onClick={onClose}
    >
      <div
        className="modal-card"
        style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-medium)',
          borderRadius: 'var(--radius-card)',
          width: '100%',
          maxWidth: '440px',
          boxShadow: 'var(--shadow-lg)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span
              style={{
                width: '36px',
                height: '36px',
                borderRadius: 'var(--radius-xs)',
                background: 'var(--danger-bg)',
                color: 'var(--danger)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <IconTrash size={20} color="var(--danger)" />
            </span>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
              {isFolder ? 'Move Folder to Trash?' : 'Move Note to Trash?'}
            </h3>
          </div>
          <button type="button" className="btn btn-icon btn-sm" onClick={onClose} aria-label="Close">
            <IconClose size={16} />
          </button>
        </div>

        {/* Content Body */}
        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <p style={{ fontSize: '0.9rem', color: 'var(--text-main)', margin: 0, lineHeight: 1.5 }}>
            Are you sure you want to move{' '}
            <strong style={{ color: 'var(--text-main)' }}>"{itemToDelete.title || (isFolder ? 'Untitled Folder' : 'Untitled Note')}"</strong>{' '}
            to the Trash?
          </p>

          {descendantIds.size > 0 && (
            <div
              style={{
                padding: '12px 14px',
                borderRadius: 'var(--radius-sm)',
                background: 'var(--danger-bg)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                fontSize: '0.82rem',
                color: '#B91C1C',
                lineHeight: 1.45
              }}
            >
              <strong>Warning:</strong> This {isFolder ? 'folder' : 'note'} contains{' '}
              <strong>{descendantIds.size}</strong> nested {descendantIds.size === 1 ? 'item' : 'items'} ({totalItemsCount} total). All nested contents will also be moved to the Trash.
            </div>
          )}

          <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: 0 }}>
            Items in the Trash can be restored anytime or permanently emptied.
          </p>

          {/* Action Buttons */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '8px' }}>
            <button type="button" className="btn btn-sm" onClick={onClose}>
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-sm"
              style={{
                background: 'var(--danger)',
                borderColor: 'var(--danger)',
                color: '#FFFFFF',
                fontWeight: 700,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px'
              }}
              onClick={handleConfirm}
            >
              <IconTrash size={14} color="#FFFFFF" />
              Move to Trash
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
