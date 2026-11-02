import React, { useState } from 'react';
import { Item } from '@smartnotes/shared';
import { IconSearch, IconPin, IconClose, IconNote, IconSubnote, IconImage, IconPdf, IconFolder } from '../icons/Icons';

export interface NoteListProps {
  title: string;
  folderColor?: string;
  notes: Item[];
  selectedNoteId: string | null;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onSelectNote: (noteId: string) => void;
  onCreateNote: () => void;
}

export const NoteList: React.FC<NoteListProps> = ({
  title,
  folderColor,
  notes,
  selectedNoteId,
  searchQuery,
  onSearchChange,
  onSelectNote,
  onCreateNote
}) => {
  const [filterChip, setFilterChip] = useState<'all' | 'pinned' | 'subnotes' | 'media'>('all');

  // Filter notes by search query and chip
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
          padding: '16px 18px 12px 18px',
          borderBottom: '1px solid var(--border-subtle)',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
            {folderColor && (
              <span style={{ display: 'inline-flex', flexShrink: 0 }}>
                <IconFolder size={18} color={folderColor} />
              </span>
            )}
            <h2 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-main)', letterSpacing: '-0.01em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', margin: 0 }}>
              {title}
            </h2>
          </div>
          <button type="button" className="btn btn-sm btn-primary" onClick={onCreateNote} style={{ flexShrink: 0 }}>
            + Note
          </button>
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

      {/* Note Cards List */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {filteredNotes.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 16px', color: 'var(--text-tertiary)' }}>
            <IconNote size={32} style={{ margin: '0 auto 12px auto', opacity: 0.4 }} />
            <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-secondary)' }}>No notes found</div>
            <div style={{ fontSize: '0.78rem', marginTop: '4px' }}>Try a different search or filter chip</div>
          </div>
        ) : (
          filteredNotes.map(n => {
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
                  <div style={{ fontSize: '0.92rem', fontWeight: 700, color: 'var(--text-main)', lineHeight: 1.3 }}>
                    {highlightMatches(n.title || 'Untitled Note', searchQuery)}
                  </div>
                  {n.isPinned && (
                    <span style={{ color: 'var(--lime-primary)' }} title="Pinned">
                      <IconPin size={14} />
                    </span>
                  )}
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
                  <span>{new Date(n.updatedAt).toLocaleDateString()}</span>
                  <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                    {isSubnote && <span className="badge badge-lime">Sub-note</span>}
                    {mediaCount > 0 && <span className="badge">{mediaCount} doc{mediaCount > 1 ? 's' : ''}</span>}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
};

