import React from 'react';
import { SyncConflict, Item, mergeConflictingNotes } from '@smartnotes/shared';
import { IconConflict, IconClose } from '../icons/Icons';

export interface ConflictModalProps {
  conflict: SyncConflict | null;
  onResolve: (resolvedItem: Item) => void;
  onDismiss: () => void;
}

export const ConflictModal: React.FC<ConflictModalProps> = ({
  conflict,
  onResolve,
  onDismiss
}) => {
  if (!conflict) return null;

  const { clientItem, serverItem } = conflict;

  const handleKeepClient = () => {
    onResolve({
      ...clientItem,
      version: Math.max(clientItem.version, serverItem.version) + 1,
      updatedAt: Date.now()
    });
  };

  const handleKeepServer = () => {
    onResolve(serverItem);
  };

  const handleMergeBoth = () => {
    const merged = mergeConflictingNotes(clientItem, serverItem);
    onResolve(merged);
  };

  return (
    <div
      className="modal-backdrop"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(18, 36, 26, 0.75)',
        backdropFilter: 'blur(6px)',
        zIndex: 2500,
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
          maxWidth: '680px',
          maxHeight: '85vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: 'var(--shadow-lg)',
          overflow: 'hidden'
        }}
      >
        {/* Header */}
        <div style={{ padding: '16px 22px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ color: 'var(--warning)', display: 'flex' }}>
              <IconConflict size={20} />
            </span>
            <div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-main)' }}>Sync Conflict Detected</h3>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                "{clientItem.title}" was modified on another device while offline.
              </p>
            </div>
          </div>
          <button type="button" className="btn btn-icon btn-sm" onClick={onDismiss}>
            <IconClose size={16} />
          </button>
        </div>

        {/* Diff Comparison Body */}
        <div style={{ padding: '18px 22px', overflowY: 'auto', flex: 1 }}>
          <p style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', marginBottom: '14px', lineHeight: 1.5 }}>
            To prevent any accidental data loss, Smart Notes preserves both versions until you choose how to proceed.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            {/* Local Device Version */}
            <div
              style={{
                background: 'var(--bg-surface-elevated)',
                border: '1px solid var(--border-medium)',
                borderRadius: 'var(--radius-sm)',
                padding: '14px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--lime-primary)' }}>
                  This Device (Local)
                </span>
                <span className="badge badge-lime">v{clientItem.version}</span>
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', marginBottom: '8px' }}>
                Edited: {new Date(clientItem.updatedAt).toLocaleTimeString()}
              </div>
              <div style={{ fontSize: '0.86rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '6px' }}>
                {clientItem.title}
              </div>
              <div
                style={{
                  fontSize: '0.78rem',
                  color: 'var(--text-secondary)',
                  maxHeight: '160px',
                  overflowY: 'auto',
                  lineHeight: 1.5
                }}
                dangerouslySetInnerHTML={{ __html: clientItem.contentHtml || '<em>Empty note</em>' }}
              />
            </div>

            {/* Cloud Version */}
            <div
              style={{
                background: 'var(--bg-surface-elevated)',
                border: '1px solid var(--border-medium)',
                borderRadius: 'var(--radius-sm)',
                padding: '14px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--info)' }}>
                  Cloud / Remote Device
                </span>
                <span className="badge">v{serverItem.version}</span>
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', marginBottom: '8px' }}>
                Edited: {new Date(serverItem.updatedAt).toLocaleTimeString()}
              </div>
              <div style={{ fontSize: '0.86rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '6px' }}>
                {serverItem.title}
              </div>
              <div
                style={{
                  fontSize: '0.78rem',
                  color: 'var(--text-secondary)',
                  maxHeight: '160px',
                  overflowY: 'auto',
                  lineHeight: 1.5
                }}
                dangerouslySetInnerHTML={{ __html: serverItem.contentHtml || '<em>Empty note</em>' }}
              />
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div
          style={{
            padding: '14px 22px',
            borderTop: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: '8px',
            background: 'var(--bg-surface-subtle)'
          }}
        >
          <button type="button" className="btn btn-sm" onClick={handleKeepClient}>
            Keep This Device
          </button>
          <button type="button" className="btn btn-sm" onClick={handleKeepServer}>
            Keep Cloud Version
          </button>
          <button type="button" className="btn btn-sm btn-primary" onClick={handleMergeBoth}>
            Merge Both (Combined Note)
          </button>
        </div>
      </div>
    </div>
  );
};

