import React, { useState } from 'react';
import { Item } from '@smartnotes/shared';
import {
  IconSearch,
  IconPin,
  IconClose,
  IconNote,
  IconFolder,
  IconFolderOpen,
  IconTrash,
  IconBack,
  IconChevronRight,
  IconPlus
} from '../icons/Icons';

export interface NoteListProps {
  title: string;
  folderColor?: string;
  notes: Item[];
  subfolders?: Item[];
  items?: Item[];
  parentFolder?: Item | null;
  selectedNoteId: string | null;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onSelectNote: (noteId: string) => void;
  onSelectFolder?: (folderId: string | null) => void;
  onCreateNote: () => void;
  onCreateFolder?: () => void;
  onDeleteNote?: (noteId: string) => void;
}

export const NoteList: React.FC<NoteListProps> = ({
  title,
  folderColor,
  notes,
  subfolders = [],
  items = [],
  parentFolder,
  selectedNoteId,
  searchQuery,
  onSearchChange,
  onSelectNote,
  onSelectFolder,
  onCreateNote,
  onCreateFolder,
  onDeleteNote
}) => {
  const [filterChip, setFilterChip] = useState<'all' | 'pinned' | 'subnotes' | 'media'>('all');

  // Filter subfolders by search query
  const matchingSubfolders = subfolders.filter(sub => {
    if (!searchQuery.trim()) return true;
    return (sub.title || '').toLowerCase().includes(searchQuery.toLowerCase());
  });

  // Filter notes by search query and chip, sorted by pinned then most recently updated first
  const filteredNotes = notes.filter(n => {
    // Search query filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const titleMatch = (n.title || '').toLowerCase().includes(q);
      const bodyMatch = (n.plainText || '').toLowerCase().includes(q);
      if (!titleMatch && !bodyMatch) return false;
    }

    // Chip filter
    if (filterChip === 'pinned') return n.isPinned;
    if (filterChip === 'subnotes') return n.parentId !== null;
    if (filterChip === 'media') return n.assetIds && n.assetIds.length > 0;

    return true;
  }).sort((a, b) => {
    if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
    return (b.updatedAt || 0) - (a.updatedAt || 0);
  });

  const highlightMatches = (text: string, q: string) => {
    if (!q.trim()) return text;
    const parts = text.split(new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'));
    return parts.map((part, i) =>
      part.toLowerCase() === q.toLowerCase() ? (
        <mark key={i} style={{ background: 'var(--lime-primary)', color: 'var(--text-on-lime)', padding: '0 3px', borderRadius: '2px', fontWeight: 700 }}>
          {part}
        </mark>
      ) : (
        part
      )
    );
  };

  return (
    <section
      className="notes-column-section"
      style={{
        width: 'var(--notes-list-w)',
        background: 'var(--bg-canvas)',
        borderRight: '1px solid var(--border-subtle)',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        flexShrink: 0
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '14px 18px 12px 18px',
          borderBottom: '1px solid var(--border-subtle)',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px'
        }}
      >
        {/* Navigation Breadcrumb / Back button when inside a folder */}
        {onSelectFolder && parentFolder !== undefined && (
          <button
            type="button"
            onClick={() => onSelectFolder(parentFolder ? parentFolder.id : null)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '0.76rem',
              fontWeight: 600,
              color: 'var(--text-secondary)',
              background: 'transparent',
              border: 'none',
              padding: '2px 0',
              cursor: 'pointer',
              alignSelf: 'flex-start',
              transition: 'color var(--transition-fast)'
            }}
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--lime-primary)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-secondary)')}
            title={parentFolder ? `Back to ${parentFolder.title}` : 'Back to All Notes'}
          >
            <IconBack size={13} />
            <span>Back to {parentFolder ? parentFolder.title : 'All Notes'}</span>
          </button>
        )}

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
            {folderColor && (
              <span style={{ display: 'inline-flex', flexShrink: 0 }}>
                <IconFolder size={18} color={folderColor} />
              </span>
            )}
            <h2 style={{ fontSize: '1.12rem', fontWeight: 800, color: 'var(--text-main)', letterSpacing: '-0.01em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', margin: 0 }}>
              {title}
            </h2>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
            {onCreateFolder && (
              <button
                type="button"
                className="btn btn-sm btn-secondary"
                onClick={onCreateFolder}
                style={{ padding: '5px 8px', fontSize: '0.76rem' }}
                title="Create Folder here"
              >
                + Folder
              </button>
            )}
            <button type="button" className="btn btn-sm btn-primary" onClick={onCreateNote} style={{ flexShrink: 0 }}>
              + Note
            </button>
          </div>
        </div>

        {/* Search Bar */}
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
          <span style={{ position: 'absolute', left: '12px', color: 'var(--text-tertiary)', display: 'flex' }}>
            <IconSearch size={15} />
          </span>
          <input
            type="text"
            value={searchQuery}
            onChange={e => onSearchChange(e.target.value)}
            placeholder="Search notes & content..."
            spellCheck={false}
            autoCorrect="off"
            style={{
              width: '100%',
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-pill)',
              padding: '8px 14px 8px 36px',
              fontSize: '0.84rem',
              color: 'var(--text-main)',
              outline: 'none'
            }}
          />
          {searchQuery && (
            <button
              type="button"
              style={{ position: 'absolute', right: '10px', background: 'transparent', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer' }}
              onClick={() => onSearchChange('')}
            >
              <IconClose size={14} />
            </button>
          )}
        </div>

        {/* Filter Chips */}
        <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '2px' }}>
          {(['all', 'pinned', 'subnotes', 'media'] as const).map(chip => (
            <button
              key={chip}
              type="button"
              className={`btn btn-sm ${filterChip === chip ? 'btn-primary' : ''}`}
              style={{
                fontSize: '0.74rem',
                padding: '3px 10px',
                minHeight: '26px',
                textTransform: 'capitalize'
              }}
              onClick={() => setFilterChip(chip)}
            >
              {chip === 'all' && 'All'}
              {chip === 'pinned' && 'Pinned'}
              {chip === 'subnotes' && 'Sub-notes'}
              {chip === 'media' && 'With Docs'}
            </button>
          ))}
        </div>
      </div>

      {/* Cards List (Subfolders + Notes) */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {/* SUBFOLDERS SECTION */}
        {matchingSubfolders.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 4px' }}>
              <span style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-tertiary)' }}>
                Subfolders ({matchingSubfolders.length})
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {matchingSubfolders.map(subfolder => {
                const childNotesCount = (items || []).filter(i => i.kind === 'note' && i.parentId === subfolder.id && !i.isDeleted).length;
                const childFoldersCount = (items || []).filter(i => i.kind === 'folder' && i.parentId === subfolder.id && !i.isDeleted).length;

                return (
                  <div
                    key={subfolder.id}
                    className="subfolder-card"
                    style={{
                      background: 'var(--bg-surface)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 'var(--radius-card)',
                      padding: '10px 14px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '10px',
                      transition: 'all var(--transition-fast)'
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.borderColor = 'var(--lime-primary)';
                      e.currentTarget.style.background = 'var(--bg-surface-elevated)';
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.borderColor = 'var(--border-subtle)';
                      e.currentTarget.style.background = 'var(--bg-surface)';
                    }}
                    onClick={() => onSelectFolder?.(subfolder.id)}
                    title={`Open ${subfolder.title}`}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                      <span style={{ display: 'flex', color: subfolder.color || 'var(--lime-primary)', flexShrink: 0 }}>
                        <IconFolder size={18} />
                      </span>
                      <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                        <span style={{ fontSize: '0.86rem', fontWeight: 700, color: 'var(--text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {highlightMatches(subfolder.title, searchQuery)}
                        </span>
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)' }}>
                          {childNotesCount} note{childNotesCount !== 1 ? 's' : ''}
                          {childFoldersCount > 0 ? ` • ${childFoldersCount} subfolder${childFoldersCount !== 1 ? 's' : ''}` : ''}
                        </span>
                      </div>
                    </div>
                    <span style={{ color: 'var(--text-tertiary)', display: 'flex', flexShrink: 0 }}>
                      <IconChevronRight size={14} />
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* NOTES SECTION */}
        {filteredNotes.length > 0 && matchingSubfolders.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 4px 0 4px' }}>
            <span style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-tertiary)' }}>
              Notes ({filteredNotes.length})
            </span>
          </div>
        )}

        {filteredNotes.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {filteredNotes.map(n => {
              const isSelected = selectedNoteId === n.id;
              const isSubnote = Boolean(n.parentId);
              const mediaCount = (n.assetIds || []).length;
              const plain = n.plainText || '';

              return (
                <div
                  key={n.id}
                  className={`note-list-card ${isSelected ? 'active' : ''}`}
                  style={{
                    background: isSelected ? 'var(--bg-surface)' : 'var(--bg-surface)',
                    border: isSelected ? '2px solid var(--lime-primary)' : '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-card)',
                    padding: '14px 16px',
                    cursor: 'pointer',
                    transition: 'all var(--transition-fast)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px',
                    boxShadow: isSelected ? 'var(--shadow-md)' : 'var(--shadow-sm)'
                  }}
                  onClick={() => onSelectNote(n.id)}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
                    <div style={{ fontSize: '0.92rem', fontWeight: 700, color: 'var(--text-main)', lineHeight: 1.3, flex: 1 }}>
                      {highlightMatches(n.title || 'Untitled Note', searchQuery)}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      {n.isPinned && (
                        <span style={{ color: 'var(--lime-primary)' }} title="Pinned">
                          <IconPin size={14} />
                        </span>
                      )}
                      {onDeleteNote && (
                        <button
                          type="button"
                          className="btn btn-icon btn-sm"
                          style={{
                            width: '26px',
                            height: '26px',
                            padding: 0,
                            border: 'none',
                            background: 'transparent',
                            color: 'var(--text-tertiary)',
                            borderRadius: '4px',
                            cursor: 'pointer'
                          }}
                          onMouseEnter={e => (e.currentTarget.style.color = 'var(--danger, #ef4444)')}
                          onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-tertiary)')}
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteNote(n.id);
                          }}
                          title="Delete Note"
                          aria-label="Delete Note"
                        >
                          <IconTrash size={14} />
                        </button>
                      )}
                    </div>
                  </div>

                  <div
                    style={{
                      fontSize: '0.78rem',
                      color: 'var(--text-secondary)',
                      lineHeight: 1.45,
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden'
                    }}
                  >
                    {highlightMatches(plain.slice(0, 100) || 'Empty note content...', searchQuery)}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.7rem', color: 'var(--text-tertiary)', marginTop: '4px' }}>
                    <span>{new Date(n.updatedAt).toLocaleDateString('en-GB')}</span>
                    <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                      {isSubnote && <span className="badge badge-lime">Sub-note</span>}
                      {mediaCount > 0 && <span className="badge">{mediaCount} doc{mediaCount > 1 ? 's' : ''}</span>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* EMPTY STATES */}
        {filteredNotes.length === 0 && matchingSubfolders.length > 0 && (
          <div
            style={{
              textAlign: 'center',
              padding: '24px 16px',
              color: 'var(--text-tertiary)',
              border: '1px dashed var(--border-subtle)',
              borderRadius: 'var(--radius-card)',
              marginTop: '4px'
            }}
          >
            <div style={{ fontSize: '0.84rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
              No direct notes in this folder
            </div>
            <div style={{ fontSize: '0.74rem', marginTop: '4px' }}>
              Select a subfolder above to view its notes, or click "+ Note" to create a note here.
            </div>
          </div>
        )}

        {filteredNotes.length === 0 && matchingSubfolders.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px 16px', color: 'var(--text-tertiary)' }}>
            <IconNote size={32} style={{ margin: '0 auto 12px auto', opacity: 0.4 }} />
            <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-secondary)' }}>No notes found</div>
            <div style={{ fontSize: '0.78rem', marginTop: '4px' }}>Try a different search or click "+ Note"</div>
          </div>
        )}
      </div>
    </section>
  );
};
