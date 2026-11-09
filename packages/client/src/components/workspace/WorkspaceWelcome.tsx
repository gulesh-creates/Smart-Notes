import React from 'react';
import { Item } from '@smartnotes/shared';
import { IconNote, IconFolder, IconPlus, IconTarget, IconGitHub, IconPin } from '../icons/Icons';
import { isSampleOrPrototypeItem } from '../../sampleData';

export interface WorkspaceWelcomeProps {
  items: Item[];
  onOpenCreateNoteModal: (parentId?: string | null) => void;
  onOpenCreateFolderModal: (parentId?: string | null) => void;
  onSelectNote: (noteId: string) => void;
  onSelectFolder: (folderId: string | null) => void;
  onSelectSpecialFilter: (filter: 'all' | 'pinned' | 'recent' | 'trash' | 'github' | 'consistency') => void;
  isMobile?: boolean;
}

export const WorkspaceWelcome: React.FC<WorkspaceWelcomeProps> = ({
  items,
  onOpenCreateNoteModal,
  onOpenCreateFolderModal,
  onSelectNote,
  onSelectFolder,
  onSelectSpecialFilter,
  isMobile = false
}) => {
  const activeNotes = items.filter(i => i.kind === 'note' && !i.isDeleted && !isSampleOrPrototypeItem(i));
  const activeFolders = items.filter(i => i.kind === 'folder' && !i.isDeleted && !isSampleOrPrototypeItem(i));
  const pinnedNotes = activeNotes.filter(n => n.isPinned);

  // Recent notes sorted by updatedAt descending
  const recentNotes = [...activeNotes]
    .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
    .slice(0, 4);

  return (
    <div
      className="workspace-welcome-canvas"
      style={{
        flex: 1,
        overflowY: 'auto',
        padding: isMobile ? '20px 16px' : '40px 48px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        background: 'var(--bg-canvas)',
        gap: '28px'
      }}
    >
      <div style={{ maxWidth: '840px', width: '100%', display: 'flex', flexDirection: 'column', gap: '28px' }}>
        {/* Welcome Hero Banner */}
        <div
          style={{
            background: 'linear-gradient(135deg, var(--bg-surface-elevated) 0%, var(--bg-surface) 100%)',
            border: '1.5px solid var(--border-medium)',
            borderRadius: 'var(--radius-card, 16px)',
            padding: isMobile ? '20px 18px' : '32px 36px',
            boxShadow: 'var(--shadow-md)',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div
                style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '12px',
                  background: 'var(--lime-primary)',
                  color: '#000000',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 900,
                  fontSize: '1.5rem',
                  boxShadow: '0 4px 14px rgba(185, 243, 42, 0.3)'
                }}
              >
                📝
              </div>
              <div>
                <h1 style={{ fontSize: isMobile ? '1.3rem' : '1.7rem', fontWeight: 900, color: 'var(--text-main)', margin: 0, letterSpacing: '-0.02em' }}>
                  Smart Notes Workspace
                </h1>
                <p style={{ margin: '4px 0 0 0', fontSize: '0.84rem', color: 'var(--text-secondary)' }}>
                  Offline-first personal knowledge base, projects, prompts & consistency tracker
                </p>
              </div>
            </div>

            {/* Quick Metrics */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span className="badge" style={{ padding: '6px 12px', fontSize: '0.78rem' }}>
                📁 {activeFolders.length} Folders
              </span>
              <span className="badge badge-lime" style={{ padding: '6px 12px', fontSize: '0.78rem' }}>
                📝 {activeNotes.length} Notes
              </span>
            </div>
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', paddingTop: '8px' }}>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => onOpenCreateNoteModal(null)}
              style={{ padding: '10px 20px', fontWeight: 800, fontSize: '0.88rem', display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              <IconPlus size={16} />
              + Create New Note
            </button>

            <button
              type="button"
              className="btn"
              onClick={() => onOpenCreateFolderModal(null)}
              style={{
                padding: '10px 18px',
                fontWeight: 700,
                fontSize: '0.88rem',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-medium)'
              }}
            >
              <IconFolder size={16} color="var(--lime-primary)" />
              + Create New Folder
            </button>

            <button
              type="button"
              className="btn"
              onClick={() => onSelectSpecialFilter('consistency')}
              style={{
                padding: '10px 16px',
                fontWeight: 700,
                fontSize: '0.84rem',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                background: 'transparent',
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-secondary)'
              }}
            >
              <IconTarget size={15} color="var(--lime-primary)" />
              Consistency Tracker
            </button>

            <button
              type="button"
              className="btn"
              onClick={() => onSelectSpecialFilter('github')}
              style={{
                padding: '10px 16px',
                fontWeight: 700,
                fontSize: '0.84rem',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                background: 'transparent',
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-secondary)'
              }}
            >
              <IconGitHub size={15} />
              GitHub Tokens
            </button>
          </div>
        </div>

        {/* Existing Projects / Folders Quick Grid */}
        {activeFolders.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h2 style={{ fontSize: '0.94rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-secondary)', margin: 0 }}>
                📁 Projects & Folders
              </h2>
              <button
                type="button"
                className="btn btn-sm"
                onClick={() => onOpenCreateFolderModal(null)}
                style={{ fontSize: '0.74rem', padding: '3px 10px' }}
              >
                + New Folder
              </button>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(230px, 1fr))',
                gap: '12px'
              }}
            >
              {activeFolders.map(folder => {
                const folderColor = folder.color || '#10B981';
                const folderNotesCount = items.filter(
                  i => i.kind === 'note' && i.parentId === folder.id && !i.isDeleted && !isSampleOrPrototypeItem(i)
                ).length;
                const subfoldersCount = items.filter(
                  i => i.kind === 'folder' && i.parentId === folder.id && !i.isDeleted && !isSampleOrPrototypeItem(i)
                ).length;

                return (
                  <div
                    key={folder.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => onSelectFolder(folder.id)}
                    style={{
                      background: 'var(--bg-surface-elevated)',
                      border: '1.5px solid var(--border-subtle)',
                      borderRadius: 'var(--radius-card, 12px)',
                      padding: '14px 16px',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px',
                      transition: 'all 0.15s ease',
                      boxShadow: 'var(--shadow-sm)'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = folderColor;
                      e.currentTarget.style.transform = 'translateY(-2px)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = 'var(--border-subtle)';
                      e.currentTarget.style.transform = 'none';
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span
                        style={{
                          width: '32px',
                          height: '32px',
                          borderRadius: '8px',
                          background: `${folderColor}20`,
                          color: folderColor,
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                      >
                        <IconFolder size={18} color={folderColor} />
                      </span>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', fontWeight: 600 }}>
                        {folderNotesCount} notes {subfoldersCount > 0 ? `· ${subfoldersCount} subfolders` : ''}
                      </span>
                    </div>

                    <div style={{ fontWeight: 800, fontSize: '0.92rem', color: 'var(--text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {folder.title || 'Untitled Folder'}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Recent Notes Grid */}
        {recentNotes.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h2 style={{ fontSize: '0.94rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-secondary)', margin: 0 }}>
                🕒 Recent Notes
              </h2>
              <span style={{ fontSize: '0.74rem', color: 'var(--text-tertiary)' }}>
                Click note to open and edit
              </span>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(260px, 1fr))',
                gap: '12px'
              }}
            >
              {recentNotes.map(note => {
                const parentFolder = note.parentId ? items.find(i => i.id === note.parentId) : null;
                const hasImprovements = Array.isArray(note.blocks) && note.blocks.some(b => b.type === 'task_item');

                return (
                  <div
                    key={note.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => onSelectNote(note.id)}
                    style={{
                      background: 'var(--bg-surface)',
                      border: '1.5px solid var(--border-subtle)',
                      borderRadius: 'var(--radius-card, 12px)',
                      padding: '14px 16px',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px',
                      transition: 'all 0.15s ease',
                      boxShadow: 'var(--shadow-sm)'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = 'var(--lime-primary)';
                      e.currentTarget.style.transform = 'translateY(-2px)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = 'var(--border-subtle)';
                      e.currentTarget.style.transform = 'none';
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
                      <span style={{ fontWeight: 800, fontSize: '0.92rem', color: 'var(--text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {note.title || 'Untitled Note'}
                      </span>
                      {hasImprovements && (
                        <span className="badge badge-lime" style={{ fontSize: '0.66rem', padding: '1px 6px', flexShrink: 0 }}>
                          ⚡ Prompts
                        </span>
                      )}
                    </div>

                    <div style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', lineHeight: 1.4, maxHeight: '38px', overflow: 'hidden' }}>
                      {note.plainText || 'No content yet. Click to start typing...'}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.68rem', color: 'var(--text-tertiary)', marginTop: '4px' }}>
                      <span>
                        {parentFolder ? `📁 ${parentFolder.title}` : '🌐 Main Environment'}
                      </span>
                      <span>
                        {new Date(note.updatedAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
