import React, { useState, useEffect } from 'react';
import { Item } from '@smartnotes/shared';
import { isSampleOrPrototypeItem } from '../../sampleData';
import {
  IconFolder, IconFolderOpen, IconNote, IconSubnote, IconPlus,
  IconChevronRight, IconChevronDown, IconTrash, IconPin, IconSync,
  IconSettings, IconMove, IconEdit, IconGitHub, IconTarget
} from '../icons/Icons';

export interface TreeRailProps {
  items: Item[];
  selectedFolderId: string | null;
  selectedNoteId: string | null;
  specialFilter: 'all' | 'projects' | 'pinned' | 'recent' | 'trash' | 'github' | 'consistency';
  githubCount?: number;
  consistencyStreak?: number;
  onSelectFolder: (folderId: string | null) => void;
  onSelectNote: (noteId: string) => void;
  onSelectSpecialFilter: (filter: 'all' | 'projects' | 'pinned' | 'recent' | 'trash' | 'github' | 'consistency') => void;
  onCreateFolder: (parentId: string | null) => void;
  onRenameFolder: (folderId: string) => void;
  onCreateNote: (parentId: string | null) => void;
  onMoveItem: (itemId: string) => void;
  onDeleteItem: (itemId: string) => void;
}

export const TreeRail: React.FC<TreeRailProps> = ({
  items,
  selectedFolderId,
  selectedNoteId,
  specialFilter,
  githubCount = 0,
  consistencyStreak = 0,
  onSelectFolder,
  onSelectNote,
  onSelectSpecialFilter,
  onCreateFolder,
  onRenameFolder,
  onCreateNote,
  onMoveItem,
  onDeleteItem
}) => {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  // Auto-expand ancestors when a note or folder is selected
  useEffect(() => {
    if (selectedNoteId) {
      const activeItem = items.find(i => i.id === selectedNoteId);
      if (activeItem?.parentId) {
        setExpandedIds(prev => {
          const next = new Set(prev);
          let currParentId: string | null = activeItem.parentId;
          while (currParentId) {
            next.add(currParentId);
            const parent = items.find(i => i.id === currParentId);
            currParentId = parent?.parentId || null;
          }
          return next;
        });
      }
    }
  }, [selectedNoteId, items]);

  const toggleExpand = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const activeNotes = items.filter(i => i.kind === 'note' && !i.isDeleted && !isSampleOrPrototypeItem(i));
  const activeFolders = items.filter(i => i.kind === 'folder' && !i.isDeleted && !isSampleOrPrototypeItem(i));
  const pinnedNotes = activeNotes.filter(n => n.isPinned);
  const trashedItems = items.filter(i => i.isDeleted && !isSampleOrPrototypeItem(i));

  // Recursive tree renderer for unlimited depth
  const renderTreeItem = (item: Item, depth = 0) => {
    const childFolders = items.filter(i => i.kind === 'folder' && i.parentId === item.id && !i.isDeleted && !isSampleOrPrototypeItem(i));
    const childNotes = items.filter(i => i.kind === 'note' && i.parentId === item.id && !i.isDeleted && !isSampleOrPrototypeItem(i));
    const hasChildren = childFolders.length + childNotes.length > 0;
    const isExpanded = expandedIds.has(item.id);

    // Active Note being viewed in editor
    const isActiveNote = item.kind === 'note' && selectedNoteId === item.id;

    // Folder states
    const isFolder = item.kind === 'folder';
    const isFolderSelected = isFolder && selectedFolderId === item.id && specialFilter === 'all';
    const isAnyNoteActive = Boolean(selectedNoteId);
    const folderColor = item.color || '#10B981';

    // Disambiguate folder and child note visual styles
    let rowClassName = 'tree-row';
    let rowBg = 'transparent';
    let rowColor = 'var(--text-secondary)';
    let rowFontWeight = 500;
    let rowBorderLeft = '3px solid transparent';
    let rowBoxShadow = 'none';

    if (isActiveNote) {
      // 1. ACTIVE NOTE: Primary vibrant lime card
      rowClassName += ' selected active-note';
      rowBg = 'var(--lime-primary)';
      rowColor = 'var(--text-on-lime)';
      rowFontWeight = 700;
      rowBoxShadow = '0 2px 8px var(--lime-glow)';
    } else if (isFolderSelected && isAnyNoteActive) {
      // 2. PARENT FOLDER OF ACTIVE NOTE: Subtle container card, NOT clashing lime!
      rowClassName += ' active-parent-folder';
      rowBg = 'var(--bg-surface-subtle)';
      rowColor = 'var(--text-main)';
      rowFontWeight = 700;
      rowBorderLeft = `3px solid ${folderColor}`;
    } else if (isFolderSelected && !isAnyNoteActive) {
      // 3. FOLDER DIRECTLY SELECTED (No note active): Pale lime container
      rowClassName += ' active-folder-direct';
      rowBg = 'var(--lime-pale)';
      rowColor = '#12241A';
      rowFontWeight = 700;
      rowBorderLeft = `3px solid ${folderColor}`;
    }

    return (
      <div key={item.id} className="tree-node-item">
        <div
          className={rowClassName}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '6px 8px',
            paddingLeft: depth === 0 ? '8px' : '6px',
            borderRadius: 'var(--radius-sm)',
            cursor: 'pointer',
            fontSize: '0.84rem',
            color: rowColor,
            background: rowBg,
            fontWeight: rowFontWeight,
            borderLeft: rowBorderLeft,
            boxShadow: rowBoxShadow,
            transition: 'background var(--transition-fast)'
          }}
          onClick={() => {
            if (item.kind === 'folder') onSelectFolder(item.id);
            else onSelectNote(item.id);
          }}
        >
          {/* Fold arrow toggle */}
          <span
            style={{ width: '16px', height: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: hasChildren ? 0.8 : 0.2 }}
            onClick={(e) => hasChildren && toggleExpand(item.id, e)}
          >
            {hasChildren && (isExpanded ? <IconChevronDown size={14} /> : <IconChevronRight size={14} />)}
          </span>

          {/* Node Icon */}
          <span style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
            {item.kind === 'folder' ? (
              isExpanded ? (
                <IconFolderOpen size={16} color={isActiveNote ? 'currentColor' : folderColor} />
              ) : (
                <IconFolder size={16} color={isActiveNote ? 'currentColor' : folderColor} />
              )
            ) : item.parentId && items.find(p => p.id === item.parentId)?.kind === 'note' ? (
              <IconSubnote size={15} color={isActiveNote ? 'var(--text-on-lime)' : 'var(--text-tertiary)'} />
            ) : (
              <IconNote size={15} color={isActiveNote ? 'var(--text-on-lime)' : 'var(--text-tertiary)'} />
            )}
          </span>

          {/* Title */}
          <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {item.title || (item.kind === 'folder' ? 'Untitled Folder' : 'Untitled Note')}
          </span>

          {/* Row Actions on hover / selection */}
          <div className="tree-row-actions">
            {item.kind === 'folder' ? (
              <>
                <button
                  type="button"
                  className="tree-action-btn"
                  title="Rename & Customize Folder"
                  onClick={(e) => { e.stopPropagation(); onRenameFolder(item.id); }}
                >
                  <IconEdit size={13} />
                </button>
                <button
                  type="button"
                  className="tree-action-btn"
                  title="New Subfolder"
                  onClick={(e) => { e.stopPropagation(); onCreateFolder(item.id); }}
                >
                  <IconFolder size={13} color={folderColor} />
                </button>
                <button
                  type="button"
                  className="tree-action-btn"
                  title="New Note in Folder"
                  onClick={(e) => { e.stopPropagation(); onCreateNote(item.id); }}
                >
                  <IconPlus size={13} />
                </button>
              </>
            ) : (
              <button
                type="button"
                className="tree-action-btn"
                title="Move Note..."
                onClick={(e) => { e.stopPropagation(); onMoveItem(item.id); }}
              >
                <IconMove size={14} />
              </button>
            )}
            <button
              type="button"
              className="tree-action-btn tree-action-delete"
              title="Delete"
              onClick={(e) => { e.stopPropagation(); onDeleteItem(item.id); }}
            >
              <IconTrash size={14} />
            </button>
          </div>
        </div>

        {/* Nested Child Items with guide line */}
        {hasChildren && isExpanded && (
          <div
            className="tree-sub-list"
            style={{
              marginLeft: '16px',
              paddingLeft: '4px',
              borderLeft: '1.5px solid var(--border-subtle)',
              marginTop: '2px',
              marginBottom: '3px',
              display: 'flex',
              flexDirection: 'column',
              gap: '2px'
            }}
          >
            {childFolders.map(cf => renderTreeItem(cf, depth + 1))}
            {childNotes.map(cn => renderTreeItem(cn, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  const rootFolders = items.filter(i => i.kind === 'folder' && i.parentId === null && !i.isDeleted && !isSampleOrPrototypeItem(i));
  const rootNotes = items.filter(i => i.kind === 'note' && i.parentId === null && !i.isDeleted && !isSampleOrPrototypeItem(i));

  return (
    <aside
      className="tree-rail-sidebar"
      style={{
        width: 'var(--sidebar-w)',
        background: 'var(--bg-surface)',
        borderRight: '1px solid var(--border-subtle)',
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
        height: '100%',
        userSelect: 'none'
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '16px 16px 12px 16px',
          borderBottom: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}
      >
        <span style={{ fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-tertiary)' }}>
          Workspace
        </span>
        <div style={{ display: 'flex', gap: '4px' }}>
          <button type="button" className="btn btn-icon btn-sm" onClick={() => onCreateFolder(null)} title="Create Root Folder">
            <IconFolder size={14} />
          </button>
          <button type="button" className="btn btn-icon btn-sm" onClick={() => onCreateNote(null)} title="Create Root Note">
            <IconPlus size={14} />
          </button>
        </div>
      </div>

      {/* Navigation & System Filters */}
      <div style={{ padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
        <button
          type="button"
          className="btn"
          style={{
            justifyContent: 'flex-start',
            border: 'none',
            background: specialFilter === 'all' && selectedFolderId === null ? 'var(--bg-surface-subtle)' : 'transparent',
            color: specialFilter === 'all' && selectedFolderId === null ? 'var(--text-main)' : 'var(--text-secondary)',
            fontWeight: specialFilter === 'all' && selectedFolderId === null ? 700 : 500,
            padding: '7px 10px',
            borderRadius: 'var(--radius-sm)'
          }}
          onClick={() => onSelectSpecialFilter('all')}
        >
          <IconNote size={16} />
          All Notes
          <span className="badge" style={{ marginLeft: 'auto' }}>{activeNotes.length}</span>
        </button>

        <button
          type="button"
          className="btn"
          style={{
            justifyContent: 'flex-start',
            border: 'none',
            background: specialFilter === 'projects' ? 'var(--bg-surface-subtle)' : 'transparent',
            color: specialFilter === 'projects' ? 'var(--text-main)' : 'var(--text-secondary)',
            fontWeight: specialFilter === 'projects' ? 700 : 500,
            padding: '7px 10px',
            borderRadius: 'var(--radius-sm)'
          }}
          onClick={() => onSelectSpecialFilter('projects')}
        >
          <IconFolder size={16} color={specialFilter === 'projects' ? 'var(--lime-primary)' : 'currentColor'} />
          Projects
          <span className="badge" style={{ marginLeft: 'auto' }}>{activeFolders.length}</span>
        </button>

        <button
          type="button"
          className="btn"
          style={{
            justifyContent: 'flex-start',
            border: 'none',
            background: specialFilter === 'pinned' ? 'var(--bg-surface-subtle)' : 'transparent',
            color: specialFilter === 'pinned' ? 'var(--text-main)' : 'var(--text-secondary)',
            fontWeight: specialFilter === 'pinned' ? 700 : 500,
            padding: '7px 10px',
            borderRadius: 'var(--radius-sm)'
          }}
          onClick={() => onSelectSpecialFilter('pinned')}
        >
          <IconPin size={16} />
          Pinned
          <span className="badge" style={{ marginLeft: 'auto' }}>{pinnedNotes.length}</span>
        </button>

        <button
          type="button"
          className="btn"
          style={{
            justifyContent: 'flex-start',
            border: 'none',
            background: specialFilter === 'trash' ? 'var(--bg-surface-subtle)' : 'transparent',
            color: specialFilter === 'trash' ? 'var(--text-main)' : 'var(--text-secondary)',
            fontWeight: specialFilter === 'trash' ? 700 : 500,
            padding: '7px 10px',
            borderRadius: 'var(--radius-sm)'
          }}
          onClick={() => onSelectSpecialFilter('trash')}
        >
          <IconTrash size={16} />
          Trash
          <span className="badge" style={{ marginLeft: 'auto' }}>{trashedItems.length}</span>
        </button>

        <button
          type="button"
          className="btn"
          style={{
            justifyContent: 'flex-start',
            border: 'none',
            background: specialFilter === 'github' ? 'var(--bg-surface-subtle)' : 'transparent',
            color: specialFilter === 'github' ? 'var(--text-main)' : 'var(--text-secondary)',
            fontWeight: specialFilter === 'github' ? 700 : 500,
            padding: '7px 10px',
            borderRadius: 'var(--radius-sm)'
          }}
          onClick={() => onSelectSpecialFilter('github')}
        >
          <IconGitHub size={16} />
          GitHub Tokens
          <span
            className="badge"
            style={{
              marginLeft: 'auto',
              background: specialFilter === 'github' ? 'var(--lime-primary)' : undefined,
              color: specialFilter === 'github' ? '#000000' : undefined,
              fontWeight: 700
            }}
          >
            {githubCount}
          </span>
        </button>

        <button
          type="button"
          className="btn"
          style={{
            justifyContent: 'flex-start',
            border: 'none',
            background: specialFilter === 'consistency' ? 'var(--bg-surface-subtle)' : 'transparent',
            color: specialFilter === 'consistency' ? 'var(--text-main)' : 'var(--text-secondary)',
            fontWeight: specialFilter === 'consistency' ? 700 : 500,
            padding: '7px 10px',
            borderRadius: 'var(--radius-sm)'
          }}
          onClick={() => onSelectSpecialFilter('consistency')}
        >
          <IconTarget size={16} color={specialFilter === 'consistency' ? 'var(--lime-primary)' : 'currentColor'} />
          Consistency
          {consistencyStreak > 0 ? (
            <span
              className="badge"
              style={{
                marginLeft: 'auto',
                background: 'var(--lime-primary)',
                color: 'var(--text-on-lime)',
                fontWeight: 800,
                fontSize: '0.72rem'
              }}
            >
              🔥 {consistencyStreak}d
            </span>
          ) : (
            <span
              className="badge"
              style={{
                marginLeft: 'auto',
                background: specialFilter === 'consistency' ? 'var(--lime-primary)' : undefined,
                color: specialFilter === 'consistency' ? '#000000' : undefined,
                fontWeight: 700
              }}
            >
              Focus
            </span>
          )}
        </button>
      </div>

      {/* Unlimited Hierarchy Section */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '6px 8px' }}>
        <div style={{ fontSize: '0.68rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-tertiary)', padding: '6px 8px', letterSpacing: '0.04em' }}>
          Folders & Sub-notes
        </div>

        {rootFolders.map(rf => renderTreeItem(rf, 0))}
        {rootNotes.map(rn => renderTreeItem(rn, 0))}

        {rootFolders.length === 0 && rootNotes.length === 0 && (
          <div style={{ padding: '16px 8px', fontSize: '0.78rem', color: 'var(--text-tertiary)', textAlign: 'center' }}>
            No folders or notes yet.
          </div>
        )}
      </div>
    </aside>
  );
};

