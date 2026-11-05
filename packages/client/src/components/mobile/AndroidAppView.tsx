import React, { useState } from 'react';
import { Item, Asset, MediaAnnotationRecord, GitHubCredential } from '@smartnotes/shared';
import {
  IconFolder, IconNote, IconSearch, IconPin, IconSettings,
  IconPlus, IconBack, IconSync, IconChevronRight, IconImage, IconPdf,
  IconPen, IconTrash, IconUndo, IconChecklist, IconListBullet, IconQuote,
  IconGitHub, IconKey
} from '../icons/Icons';
import { RichEditor } from '../editor/RichEditor';
import { GitHubTokenManager } from '../github/GitHubTokenManager';

export interface AndroidAppViewProps {
  items: Item[];
  selectedNote: Item | null;
  breadcrumbs: Array<{ id: string | null; title: string; kind: 'root' | 'folder' | 'note' }>;
  childNotes: Item[];
  localSaveState: 'saving' | 'saved' | 'error';
  cloudSyncState: 'synced' | 'pending' | 'offline' | 'conflict';
  githubCredentials?: GitHubCredential[];
  onSelectNote: (id: string) => void;
  onUpdateNote: (updated: Partial<Item>) => void;
  onCreateNote: (parentId?: string | null) => void;
  onCreateFolder: (parentId?: string | null) => void;
  onCreateChildNote: () => void;
  onAttachAsset: (file: File) => void;
  onDeleteAsset: (assetId: string) => void;
  onSaveAnnotation: (annotation: MediaAnnotationRecord) => void;
  onOpenSettings: () => void;
  onSaveGitHubCredential?: (cred: {
    id?: string;
    username: string;
    token: string;
    label?: string;
    expiresAt: number | null;
  }) => Promise<void>;
  onDeleteGitHubCredential?: (id: string) => Promise<void>;
}

export const AndroidAppView: React.FC<AndroidAppViewProps> = ({
  items,
  selectedNote,
  breadcrumbs,
  childNotes,
  localSaveState,
  cloudSyncState,
  githubCredentials = [],
  onSelectNote,
  onUpdateNote,
  onCreateNote,
  onCreateFolder,
  onCreateChildNote,
  onAttachAsset,
  onDeleteAsset,
  onSaveAnnotation,
  onOpenSettings,
  onSaveGitHubCredential,
  onDeleteGitHubCredential
}) => {
  const [activeTab, setActiveTab] = useState<'library' | 'search' | 'recent' | 'settings'>('library');
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState<boolean>(false);
  const [isGitHubOpen, setIsGitHubOpen] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');

  const activeNotes = items.filter(i => i.kind === 'note' && !i.isDeleted);
  const pinnedNotes = activeNotes.filter(n => n.isPinned);
  const recentNotes = [...activeNotes].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 10);

  const openNoteInEditor = (noteId: string) => {
    onSelectNote(noteId);
    setIsEditorOpen(true);
  };

  const handleBackFromEditor = () => {
    setIsEditorOpen(false);
  };

  // Full-screen GitHub Tokens view on Android
  if (isGitHubOpen) {
    return (
      <div className="android-fullscreen-github" style={{ width: '100vw', height: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg-canvas)' }}>
        <div
          style={{
            height: '52px',
            padding: '0 12px',
            background: 'var(--bg-surface)',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            gap: '12px'
          }}
        >
          <button type="button" className="btn btn-icon btn-sm" onClick={() => setIsGitHubOpen(false)} aria-label="Back to Settings">
            <IconBack size={18} />
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <IconGitHub size={18} />
            <span style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-main)' }}>GitHub Tokens Vault</span>
          </div>
        </div>
        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <GitHubTokenManager
            credentials={githubCredentials}
            onSaveCredential={onSaveGitHubCredential || (async () => {})}
            onDeleteCredential={onDeleteGitHubCredential || (async () => {})}
          />
        </div>
      </div>
    );
  }

  // Full-screen note editor on Android
  if (isEditorOpen && selectedNote) {
    return (
      <div className="android-fullscreen-editor" style={{ width: '100vw', height: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg-canvas)' }}>
        {/* Android Top Action Bar */}
        <div
          style={{
            height: '52px',
            padding: '0 12px',
            background: 'var(--bg-surface)',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <button type="button" className="btn btn-icon btn-sm" onClick={handleBackFromEditor} aria-label="Back to Library">
            <IconBack size={18} />
          </button>

          <span className="badge badge-lime" style={{ fontSize: '0.74rem' }}>
            {localSaveState === 'saving' ? 'Saving...' : 'Saved Locally'}
          </span>

          <button type="button" className="btn btn-sm btn-primary" onClick={handleBackFromEditor}>
            Done
          </button>
        </div>

        {/* Editor Body */}
        <div style={{ flex: 1, overflow: 'hidden' }}>
          <RichEditor
            note={selectedNote}
            breadcrumbs={breadcrumbs}
            childNotes={childNotes}
            localSaveState={localSaveState}
            cloudSyncState={cloudSyncState}
            onUpdateNote={onUpdateNote}
            onNavigateBreadcrumb={(id) => {
              if (id) {
                const target = items.find(i => i.id === id);
                if (target?.kind === 'note') onSelectNote(id);
                else {
                  setCurrentFolderId(id);
                  setIsEditorOpen(false);
                }
              } else {
                setCurrentFolderId(null);
                setIsEditorOpen(false);
              }
            }}
            onSelectChildNote={openNoteInEditor}
            onCreateChildNote={onCreateChildNote}
            onAttachAsset={onAttachAsset}
            onDeleteAsset={onDeleteAsset}
            onSaveAnnotation={onSaveAnnotation}
            isMobile={true}
          />
        </div>
      </div>
    );
  }

  // Current folder items
  const folderItems = currentFolderId ? items.find(i => i.id === currentFolderId) : null;
  const subfoldersInCurrent = items.filter(i => i.kind === 'folder' && i.parentId === currentFolderId && !i.isDeleted);
  const notesInCurrent = items.filter(i => i.kind === 'note' && i.parentId === currentFolderId && !i.isDeleted);

  return (
    <div className="android-fullscreen-app" style={{ width: '100vw', height: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg-canvas)', position: 'relative', overflow: 'hidden' }}>
      {/* Top App Bar */}
      <header
        style={{
          height: '56px',
          padding: '0 16px',
          background: 'var(--bg-surface)',
          borderBottom: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {currentFolderId && (
            <button type="button" className="btn btn-icon btn-sm" onClick={() => setCurrentFolderId(null)} aria-label="Back">
              <IconBack size={18} />
            </button>
          )}
          <h1 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-main)', letterSpacing: '-0.02em' }}>
            {currentFolderId ? (folderItems?.title || 'Folder') : 'Smart Notes'}
          </h1>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span
            className={`badge ${cloudSyncState === 'synced' ? 'badge-lime' : ''}`}
            style={{ fontSize: '0.7rem', padding: '3px 8px' }}
            title={cloudSyncState === 'synced' ? 'Connected to Cloud' : 'Offline / Syncing'}
          >
            <span
              style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                background: cloudSyncState === 'synced' ? 'var(--lime-primary)' : cloudSyncState === 'pending' ? 'var(--warning)' : 'var(--text-tertiary)',
                marginRight: '2px'
              }}
            />
            {cloudSyncState === 'synced' ? 'Synced' : cloudSyncState === 'pending' ? 'Syncing...' : 'Local'}
          </span>
          <button type="button" className="btn btn-icon btn-sm" onClick={onOpenSettings} aria-label="Settings">
            <IconSettings size={18} />
          </button>
        </div>
      </header>

      {/* Main Screen Content Area */}
      <main style={{ flex: 1, overflowY: 'auto', padding: '16px 16px 90px 16px' }}>
        {/* SCREEN 1: LIBRARY / FOLDER VIEW */}
        {activeTab === 'library' && (
          <div>
            {!currentFolderId && (
              <>
                {/* Stats Accent Card */}
                <div
                  className="stat-accent-card"
                  style={{
                    background: 'var(--card-dark-accent)',
                    color: 'var(--card-dark-text)',
                    borderRadius: 'var(--radius-card)',
                    padding: '18px 20px',
                    marginBottom: '18px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    boxShadow: 'var(--shadow-md)'
                  }}
                >
                  <div>
                    <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--lime-primary)', textTransform: 'uppercase' }}>
                      {cloudSyncState === 'synced' ? 'Cloud Synced Library' : cloudSyncState === 'pending' ? 'Syncing with Cloud...' : 'Personal Library'}
                    </div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 800, marginTop: '2px' }}>
                      {activeNotes.length} Notes
                    </div>
                  </div>
                  <span className={`badge ${cloudSyncState === 'synced' ? 'badge-lime' : ''}`}>
                    {cloudSyncState === 'synced' ? 'Cloud Connected' : '100% On-Device'}
                  </span>
                </div>

                {/* Pinned Notes Carousel */}
                {pinnedNotes.length > 0 && (
                  <div style={{ marginBottom: '20px' }}>
                    <div style={{ fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-tertiary)', marginBottom: '8px' }}>
                      Pinned Notes
                    </div>
                    <div style={{ display: 'flex', gap: '10px', overflowX: 'auto', paddingBottom: '4px' }}>
                      {pinnedNotes.map(p => (
                        <div
                          key={p.id}
                          className="android-pinned-card"
                          style={{
                            minWidth: '150px',
                            background: 'var(--bg-surface)',
                            border: '1px solid var(--border-medium)',
                            borderRadius: 'var(--radius-md)',
                            padding: '12px 14px',
                            cursor: 'pointer',
                            flexShrink: 0
                          }}
                          onClick={() => openNoteInEditor(p.id)}
                        >
                          <div style={{ fontSize: '0.86rem', fontWeight: 700, color: 'var(--text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {p.title || 'Untitled'}
                          </div>
                          <div style={{ fontSize: '0.7rem', color: 'var(--lime-primary)', fontWeight: 700, marginTop: '4px' }}>
                            PINNED
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Folders List */}
            <div style={{ marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-tertiary)' }}>
                  {currentFolderId ? 'Subfolders' : 'Folders'}
                </span>
                <button type="button" className="btn btn-sm" onClick={() => onCreateFolder(currentFolderId)} style={{ fontSize: '0.75rem', padding: '3px 10px', minHeight: '26px' }}>
                  + Folder
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {subfoldersInCurrent.map(f => {
                  const count = items.filter(i => i.parentId === f.id && !i.isDeleted).length;
                  return (
                    <div
                      key={f.id}
                      className="android-folder-card"
                      style={{
                        background: 'var(--bg-surface)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: 'var(--radius-md)',
                        padding: '12px 16px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        cursor: 'pointer'
                      }}
                      onClick={() => setCurrentFolderId(f.id)}
                    >
                      <IconFolder size={18} color="var(--lime-primary)" />
                      <span style={{ fontWeight: 600, fontSize: '0.88rem', color: 'var(--text-main)', flex: 1 }}>{f.title}</span>
                      <span className="badge">{count}</span>
                      <IconChevronRight size={16} color="var(--text-tertiary)" />
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Notes List */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-tertiary)' }}>
                  {currentFolderId ? 'Notes in this Folder' : 'Recent Notes'}
                </span>
                <button type="button" className="btn btn-sm btn-primary" onClick={() => onCreateNote(currentFolderId)} style={{ fontSize: '0.75rem', padding: '3px 10px', minHeight: '26px' }}>
                  + Note
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {notesInCurrent.map(note => (
                  <div
                    key={note.id}
                    className="android-note-card"
                    style={{
                      background: 'var(--bg-surface)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 'var(--radius-md)',
                      padding: '14px 16px',
                      cursor: 'pointer'
                    }}
                    onClick={() => openNoteInEditor(note.id)}
                  >
                    <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-main)' }}>{note.title || 'Untitled'}</div>
                    <div style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', marginTop: '2px', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                      {note.plainText?.slice(0, 80) || 'Empty note...'}
                    </div>
                    <div style={{ fontSize: '0.68rem', color: 'var(--text-tertiary)', marginTop: '6px' }}>
                      {new Date(note.updatedAt).toLocaleDateString()}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* SCREEN 2: SEARCH */}
        {activeTab === 'search' && (
          <div>
            <div style={{ position: 'relative', marginBottom: '16px' }}>
              <span style={{ position: 'absolute', left: '12px', top: '12px', color: 'var(--text-tertiary)' }}>
                <IconSearch size={16} />
              </span>
              <input
                type="text"
                autoFocus
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search notes and documents..."
                spellCheck={false}
                autoCorrect="off"
                style={{
                  width: '100%',
                  padding: '10px 14px 10px 36px',
                  borderRadius: 'var(--radius-pill)',
                  border: '1px solid var(--border-medium)',
                  background: 'var(--bg-surface)',
                  color: 'var(--text-main)',
                  fontSize: '0.9rem',
                  outline: 'none'
                }}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {activeNotes
                .filter(n => {
                  if (!searchQuery.trim()) return false;
                  const q = searchQuery.toLowerCase();
                  return (n.title || '').toLowerCase().includes(q) || (n.plainText || '').toLowerCase().includes(q);
                })
                .map(n => (
                  <div
                    key={n.id}
                    style={{
                      background: 'var(--bg-surface)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 'var(--radius-md)',
                      padding: '12px 16px',
                      cursor: 'pointer'
                    }}
                    onClick={() => openNoteInEditor(n.id)}
                  >
                    <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-main)' }}>{n.title || 'Untitled'}</div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                      {n.plainText?.slice(0, 90)}
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* SCREEN 3: RECENT */}
        {activeTab === 'recent' && (
          <div>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 800, marginBottom: '14px', color: 'var(--text-main)' }}>Recent Notes</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {recentNotes.map(n => (
                <div
                  key={n.id}
                  style={{
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-md)',
                    padding: '14px 16px',
                    cursor: 'pointer'
                  }}
                  onClick={() => openNoteInEditor(n.id)}
                >
                  <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-main)' }}>{n.title || 'Untitled'}</div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', marginTop: '4px' }}>
                    Modified {new Date(n.updatedAt).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* SCREEN 4: SETTINGS SHORTCUT */}
        {activeTab === 'settings' && (
          <div>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 800, marginBottom: '14px', color: 'var(--text-main)' }}>Settings & Profile</h2>
            
            {/* GitHub Accounts & Tokens Card */}
            <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: '16px', marginBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                <IconGitHub size={18} />
                <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-main)' }}>GitHub Accounts & Tokens</span>
                <span
                  style={{
                    marginLeft: 'auto',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: '999px',
                    background: 'rgba(185, 243, 42, 0.15)',
                    color: 'var(--lime-primary)'
                  }}
                >
                  {githubCredentials.length} Saved
                </span>
              </div>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '12px' }}>
                Manage personal access tokens, live expiration countdowns, and copy tokens directly on phone.
              </p>
              <button
                type="button"
                className="btn btn-sm btn-secondary"
                onClick={() => setIsGitHubOpen(true)}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600 }}
              >
                <IconKey size={14} />
                Open GitHub Tokens Vault
              </button>
            </div>

            <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: '16px', marginBottom: '12px' }}>
              <div style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: '6px' }}>Cloud Sync & Account</div>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '12px' }}>
                Manage cloud backup, light/dark themes, ZIP export, and prototype migrations.
              </p>
              <button type="button" className="btn btn-sm btn-primary" onClick={onOpenSettings}>
                Open Full Settings Panel
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Floating Action Button (+) for Rapid Creation */}
      <button
        type="button"
        className="android-fab-btn"
        style={{
          position: 'absolute',
          bottom: '88px',
          right: '20px',
          width: '54px',
          height: '54px',
          borderRadius: '50%',
          background: 'var(--lime-primary)',
          color: 'var(--text-on-lime)',
          border: 'none',
          boxShadow: '0 8px 24px var(--lime-glow)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          zIndex: 1000
        }}
        onClick={() => onCreateNote(currentFolderId)}
        aria-label="Create Note"
      >
        <IconPlus size={24} />
      </button>

      {/* Android Floating Bottom Navigation Dock */}
      <nav
        className="android-bottom-dock"
        style={{
          position: 'absolute',
          bottom: '14px',
          left: '16px',
          right: '16px',
          height: '62px',
          background: 'var(--bg-surface-glass)',
          backdropFilter: 'blur(16px)',
          border: '1px solid var(--border-medium)',
          borderRadius: 'var(--radius-pill)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-around',
          boxShadow: 'var(--shadow-float)',
          zIndex: 900
        }}
      >
        {[
          { id: 'library', label: 'Library', icon: <IconNote size={18} /> },
          { id: 'search', label: 'Search', icon: <IconSearch size={18} /> },
          { id: 'recent', label: 'Recent', icon: <IconPin size={18} /> },
          { id: 'settings', label: 'Settings', icon: <IconSettings size={18} /> }
        ].map(dock => {
          const isActive = activeTab === dock.id;
          return (
            <button
              key={dock.id}
              type="button"
              style={{
                background: 'transparent',
                border: 'none',
                color: isActive ? 'var(--text-main)' : 'var(--text-secondary)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '3px',
                fontSize: '0.68rem',
                fontWeight: isActive ? 700 : 500,
                cursor: 'pointer',
                padding: '6px 12px',
                borderRadius: 'var(--radius-pill)',
                minWidth: '60px'
              }}
              onClick={() => setActiveTab(dock.id as any)}
            >
              <span
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '4px',
                  borderRadius: '50%',
                  background: isActive ? 'var(--lime-pale)' : 'transparent',
                  color: isActive ? '#12241A' : 'currentColor'
                }}
              >
                {dock.icon}
              </span>
              <span>{dock.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
};
