import React, { useState, useEffect, useRef } from 'react';
import { Item } from '@smartnotes/shared';
import { IconFolder, IconClose, IconCheck } from '../icons/Icons';

export interface FolderColorOption {
  id: string;
  name: string;
  hex: string;
  bgLight: string;
}

export const FOLDER_COLORS: FolderColorOption[] = [
  { id: 'lime', name: 'Lime', hex: '#B9F32A', bgLight: '#E7F9B5' },
  { id: 'emerald', name: 'Emerald', hex: '#10B981', bgLight: '#D1FAE5' },
  { id: 'forest', name: 'Forest', hex: '#15803D', bgLight: '#DCFCE7' },
  { id: 'sky', name: 'Sky Blue', hex: '#0284C7', bgLight: '#E0F2FE' },
  { id: 'ocean', name: 'Ocean Blue', hex: '#2563EB', bgLight: '#DBEAFE' },
  { id: 'indigo', name: 'Indigo', hex: '#6366F1', bgLight: '#EEF2FF' },
  { id: 'purple', name: 'Purple', hex: '#8B5CF6', bgLight: '#F3E8FF' },
  { id: 'rose', name: 'Rose', hex: '#F43F5E', bgLight: '#FFE4E6' },
  { id: 'amber', name: 'Amber', hex: '#F59E0B', bgLight: '#FEF3C7' },
  { id: 'teal', name: 'Teal', hex: '#0D9488', bgLight: '#CCFBF1' },
  { id: 'slate', name: 'Slate', hex: '#64748B', bgLight: '#F1F5F9' },
];

export interface FolderModalProps {
  isOpen: boolean;
  mode: 'create' | 'edit';
  parentId?: string | null;
  folderToEdit?: Item | null;
  items: Item[];
  onClose: () => void;
  onSubmit: (data: { title: string; color: string; parentId?: string | null }) => void;
}

export const FolderModal: React.FC<FolderModalProps> = ({
  isOpen,
  mode,
  parentId = null,
  folderToEdit = null,
  items,
  onClose,
  onSubmit
}) => {
  const [title, setTitle] = useState('');
  const [selectedColor, setSelectedColor] = useState(FOLDER_COLORS[1].hex); // Default emerald green
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      if (mode === 'edit' && folderToEdit) {
        setTitle(folderToEdit.title);
        setSelectedColor(folderToEdit.color || FOLDER_COLORS[1].hex);
      } else {
        setTitle('');
        setSelectedColor(FOLDER_COLORS[1].hex);
      }
      setTimeout(() => inputRef.current?.focus(), 80);
    }
  }, [isOpen, mode, folderToEdit]);

  if (!isOpen) return null;

  const parentFolder = parentId ? items.find(i => i.id === parentId) : null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanTitle = title.trim() || (mode === 'create' ? 'Untitled Folder' : (folderToEdit?.title || 'Untitled Folder'));
    onSubmit({
      title: cleanTitle,
      color: selectedColor,
      parentId: mode === 'create' ? parentId : undefined
    });
    onClose();
  };

  const activeColorObj = FOLDER_COLORS.find(c => c.hex.toLowerCase() === selectedColor.toLowerCase()) || {
    id: 'custom',
    name: 'Custom',
    hex: selectedColor,
    bgLight: 'rgba(0,0,0,0.06)'
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
          maxWidth: '460px',
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
                width: '34px',
                height: '34px',
                borderRadius: 'var(--radius-xs)',
                background: `${selectedColor}22`,
                color: selectedColor,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <IconFolder size={20} color={selectedColor} />
            </span>
            <div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
                {mode === 'create' ? 'Create New Folder' : 'Rename & Customize Folder'}
              </h3>
              <p style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', margin: '2px 0 0 0' }}>
                {mode === 'create'
                  ? (parentFolder ? `Inside: ${parentFolder.title}` : 'Root level workspace folder')
                  : `Editing "${folderToEdit?.title}"`}
              </p>
            </div>
          </div>
          <button type="button" className="btn btn-icon btn-sm" onClick={onClose} aria-label="Close">
            <IconClose size={16} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
          {/* Folder Name Input */}
          <div>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '8px' }}>
              Folder Name
            </label>
            <input
              ref={inputRef}
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Work, Engineering, Personal..."
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

          {/* Color Theme Selector */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <label style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-main)' }}>
                Folder Color Theme
              </label>
              <span style={{ fontSize: '0.74rem', fontWeight: 700, color: selectedColor, textTransform: 'capitalize' }}>
                {activeColorObj.name}
              </span>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(6, 1fr)',
                gap: '10px',
                padding: '10px',
                background: 'var(--bg-surface-subtle)',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border-subtle)'
              }}
            >
              {FOLDER_COLORS.map(c => {
                const isSelected = selectedColor.toLowerCase() === c.hex.toLowerCase();
                return (
                  <button
                    key={c.id}
                    type="button"
                    title={c.name}
                    onClick={() => setSelectedColor(c.hex)}
                    style={{
                      height: '38px',
                      borderRadius: 'var(--radius-sm)',
                      background: c.hex,
                      border: isSelected ? '3px solid #12241A' : '1px solid rgba(0,0,0,0.1)',
                      boxShadow: isSelected ? '0 0 0 2px var(--lime-primary), 0 4px 10px rgba(0,0,0,0.15)' : 'none',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transform: isSelected ? 'scale(1.08)' : 'scale(1)',
                      transition: 'all var(--transition-fast)'
                    }}
                  >
                    {isSelected && (
                      <IconCheck
                        size={16}
                        color={['#B9F32A', '#E7F9B5', '#D1FAE5'].includes(c.hex) ? '#12241A' : '#FFFFFF'}
                        strokeWidth={3}
                      />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Live Preview Card */}
          <div
            style={{
              padding: '12px 14px',
              borderRadius: 'var(--radius-sm)',
              background: 'var(--bg-surface-elevated)',
              border: `1.5px solid ${selectedColor}`,
              display: 'flex',
              alignItems: 'center',
              gap: '10px'
            }}
          >
            <IconFolder size={22} color={selectedColor} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '0.86rem', fontWeight: 700, color: 'var(--text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {title.trim() || 'Folder Name Preview'}
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                Theme color will apply to folder icons & navigation badges
              </div>
            </div>
            <span
              style={{
                fontSize: '0.7rem',
                fontWeight: 700,
                padding: '2px 8px',
                borderRadius: 'var(--radius-pill)',
                background: selectedColor,
                color: ['#B9F32A', '#E7F9B5', '#D1FAE5'].includes(selectedColor) ? '#12241A' : '#FFFFFF'
              }}
            >
              {activeColorObj.name}
            </span>
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '6px' }}>
            <button type="button" className="btn btn-sm" onClick={onClose}>
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary btn-sm"
              style={{
                minWidth: '120px',
                background: selectedColor === '#B9F32A' ? 'var(--lime-primary)' : selectedColor,
                borderColor: selectedColor,
                color: ['#B9F32A', '#E7F9B5', '#D1FAE5'].includes(selectedColor) ? '#12241A' : '#FFFFFF'
              }}
            >
              {mode === 'create' ? '+ Create Folder' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

