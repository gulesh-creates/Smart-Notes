import React from 'react';
import { Item, wouldCreateCycle } from '@smartnotes/shared';
import { IconFolder, IconFolderOpen, IconCheck } from '../icons/Icons';
import { isSampleOrPrototypeItem } from '../../sampleData';

export interface FolderNode {
  item: Item;
  depth: number;
  path: string;
}

export interface FolderLocationSelectorProps {
  items: Item[];
  selectedFolderId: string | null;
  onSelectFolderId: (id: string | null) => void;
  excludeId?: string | null; // e.g. when editing or moving a folder, exclude itself and descendants
  label?: string;
}

export function buildFolderHierarchy(
  items: Item[],
  excludeId?: string | null
): FolderNode[] {
  const validFolders = items.filter(
    i => i.kind === 'folder' && !i.isDeleted && !isSampleOrPrototypeItem(i)
  );

  const result: FolderNode[] = [];

  const addFolderAndChildren = (
    parentId: string | null,
    depth: number,
    parentPath: string
  ) => {
    const children = validFolders
      .filter(f => f.parentId === parentId)
      .sort((a, b) => (a.title || '').localeCompare(b.title || ''));

    for (const folder of children) {
      if (excludeId && (folder.id === excludeId || wouldCreateCycle(items, excludeId, folder.id))) {
        continue;
      }

      const currentPath = parentPath ? `${parentPath} > ${folder.title}` : folder.title;
      result.push({
        item: folder,
        depth,
        path: currentPath
      });

      // Recurse into subfolders
      addFolderAndChildren(folder.id, depth + 1, currentPath);
    }
  };

  addFolderAndChildren(null, 0, '');
  return result;
}

export const FolderLocationSelector: React.FC<FolderLocationSelectorProps> = ({
  items,
  selectedFolderId,
  onSelectFolderId,
  excludeId = null,
  label = 'Choose Location / Folder'
}) => {
  const folderNodes = buildFolderHierarchy(items, excludeId);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <label style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-main)' }}>
          {label}
        </label>
        <span style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)' }}>
          {selectedFolderId === null ? 'Main Environment (Root)' : 'Inside Selected Folder'}
        </span>
      </div>

      <div
        className="folder-selector-scroll"
        style={{
          maxHeight: '190px',
          overflowY: 'auto',
          border: '1.5px solid var(--border-medium)',
          borderRadius: 'var(--radius-sm)',
          background: 'var(--bg-surface-elevated)',
          padding: '6px',
          display: 'flex',
          flexDirection: 'column',
          gap: '4px'
        }}
      >
        {/* Option 1: Root / Main Environment (Sabhi Folders ke Bahar) */}
        <div
          role="button"
          tabIndex={0}
          style={{
            padding: '8px 12px',
            borderRadius: 'var(--radius-xs)',
            background: selectedFolderId === null ? 'var(--lime-pale, rgba(185, 243, 42, 0.15))' : 'transparent',
            border: selectedFolderId === null ? '1.5px solid var(--lime-primary)' : '1px solid transparent',
            color: selectedFolderId === null ? 'var(--text-main)' : 'var(--text-secondary)',
            fontWeight: selectedFolderId === null ? 700 : 500,
            cursor: 'pointer',
            fontSize: '0.84rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            transition: 'all 0.15s ease'
          }}
          onClick={() => onSelectFolderId(null)}
          onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onSelectFolderId(null)}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '1rem' }}>🌐</span>
            <div>
              <div style={{ color: 'var(--text-main)', fontWeight: selectedFolderId === null ? 800 : 600 }}>
                Main Environment (Root)
              </div>
              <div style={{ fontSize: '0.70rem', color: 'var(--text-tertiary)' }}>
                Sabhi folders ke bahar (Top-level workspace)
              </div>
            </div>
          </div>
          {selectedFolderId === null && (
            <span
              style={{
                width: '20px',
                height: '20px',
                borderRadius: '50%',
                background: 'var(--lime-primary)',
                color: '#000000',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 800,
                fontSize: '0.74rem'
              }}
            >
              ✓
            </span>
          )}
        </div>

        {/* Existing Folders & Subfolders */}
        {folderNodes.map(node => {
          const isSelected = selectedFolderId === node.item.id;
          const folderColor = node.item.color || '#10B981';

          return (
            <div
              key={node.item.id}
              role="button"
              tabIndex={0}
              style={{
                marginLeft: `${node.depth * 16}px`,
                padding: '7px 10px',
                borderRadius: 'var(--radius-xs)',
                background: isSelected ? 'var(--lime-pale, rgba(185, 243, 42, 0.15))' : 'transparent',
                border: isSelected ? '1.5px solid var(--lime-primary)' : '1px solid transparent',
                color: isSelected ? 'var(--text-main)' : 'var(--text-secondary)',
                fontWeight: isSelected ? 700 : 500,
                cursor: 'pointer',
                fontSize: '0.82rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                transition: 'all 0.15s ease'
              }}
              onClick={() => onSelectFolderId(node.item.id)}
              onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onSelectFolderId(node.item.id)}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0, overflow: 'hidden' }}>
                {node.depth > 0 && (
                  <span style={{ color: 'var(--text-tertiary)', fontFamily: 'monospace', fontSize: '0.78rem' }}>
                    └─
                  </span>
                )}
                <span style={{ color: folderColor, display: 'inline-flex', flexShrink: 0 }}>
                  {isSelected ? <IconFolderOpen size={16} color={folderColor} /> : <IconFolder size={16} color={folderColor} />}
                </span>
                <div style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  <span style={{ color: isSelected ? 'var(--text-main)' : 'var(--text-secondary)' }}>
                    {node.item.title || 'Untitled Folder'}
                  </span>
                  {node.depth > 0 && (
                    <span style={{ fontSize: '0.68rem', color: 'var(--text-tertiary)', marginLeft: '6px' }}>
                      ({node.path})
                    </span>
                  )}
                </div>
              </div>
              {isSelected && (
                <span
                  style={{
                    width: '18px',
                    height: '18px',
                    borderRadius: '50%',
                    background: 'var(--lime-primary)',
                    color: '#000000',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 800,
                    fontSize: '0.70rem',
                    flexShrink: 0
                  }}
                >
                  ✓
                </span>
              )}
            </div>
          );
        })}

        {folderNodes.length === 0 && (
          <div style={{ padding: '8px 12px', fontSize: '0.76rem', color: 'var(--text-tertiary)', textAlign: 'center' }}>
            No folders created yet. Item will be added to Main Environment.
          </div>
        )}
      </div>
    </div>
  );
};
