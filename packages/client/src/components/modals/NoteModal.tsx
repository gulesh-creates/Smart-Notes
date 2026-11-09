import React, { useState, useEffect, useRef } from 'react';
import { Item } from '@smartnotes/shared';
import { IconNote, IconClose } from '../icons/Icons';
import { FolderLocationSelector } from '../common/FolderLocationSelector';

export interface NoteModalProps {
  isOpen: boolean;
  defaultParentId?: string | null;
  items: Item[];
  onClose: () => void;
  onSubmit: (data: { title: string; parentId: string | null }) => void;
}

export const NoteModal: React.FC<NoteModalProps> = ({
  isOpen,
  defaultParentId = null,
  items,
  onClose,
  onSubmit
}) => {
  const [title, setTitle] = useState('');
  const [selectedParentId, setSelectedParentId] = useState<string | null>(defaultParentId);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTitle('');
      setSelectedParentId(defaultParentId);
      setTimeout(() => inputRef.current?.focus(), 80);
    }
  }, [isOpen, defaultParentId]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanTitle = title.trim() || 'Untitled Note';
    onSubmit({
      title: cleanTitle,
      parentId: selectedParentId
    });
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
          maxWidth: '480px',
          boxShadow: 'var(--shadow-lg)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
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
                background: 'rgba(185, 243, 42, 0.15)',
                color: 'var(--lime-primary)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <IconNote size={20} color="var(--lime-primary)" />
            </span>
            <div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
                Create New Note
              </h3>
              <p style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', margin: '2px 0 0 0' }}>
                Enter title and choose where to store this note
              </p>
            </div>
          </div>
          <button type="button" className="btn btn-icon btn-sm" onClick={onClose} aria-label="Close">
            <IconClose size={16} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
          {/* Note Title Input */}
          <div>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '8px' }}>
              Note Title
            </label>
            <input
              ref={inputRef}
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Project Specs, Learning C++, Meeting Notes..."
              style={{
                width: '100%',
                background: 'var(--bg-surface-elevated)',
                border: '1.5px solid var(--border-medium)',
                borderRadius: 'var(--radius-sm)',
                padding: '10px 14px',
                fontSize: '0.92rem',
                color: 'var(--text-main)',
                outline: 'none',
                boxSizing: 'border-box'
              }}
            />
          </div>

          {/* Folder Destination Selector with full nesting hierarchy */}
          <FolderLocationSelector
            items={items}
            selectedFolderId={selectedParentId}
            onSelectFolderId={setSelectedParentId}
            label="Location: Kis folder me note create karna hai?"
          />

          {/* Action Buttons */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', paddingTop: '8px', borderTop: '1px solid var(--border-subtle)' }}>
            <button type="button" className="btn btn-sm" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary btn-sm" style={{ padding: '8px 18px', fontWeight: 700 }}>
              + Create Note
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
