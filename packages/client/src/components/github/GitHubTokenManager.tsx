import React, { useState, useEffect } from 'react';
import { GitHubCredential } from '@smartnotes/shared';
import {
  IconGitHub, IconPlus, IconCopy, IconCheck, IconEye, IconEyeOff,
  IconClock, IconTrash, IconEdit, IconSearch, IconKey
} from '../icons/Icons';
import { GitHubTokenModal } from '../modals/GitHubTokenModal';

export interface GitHubTokenManagerProps {
  credentials: GitHubCredential[];
  onSaveCredential: (cred: {
    id?: string;
    username: string;
    token: string;
    label?: string;
    expiresAt: number | null;
  }) => Promise<void>;
  onDeleteCredential: (id: string) => Promise<void>;
}

// Formats the live countdown ("Ulti Ginti") in English
export function formatLiveCountdown(expiresAt: number | null, now: number): {
  text: string;
  status: 'active' | 'warning' | 'expired' | 'never';
  fullDetail: string;
} {
  if (expiresAt === null || expiresAt === undefined) {
    return {
      text: 'Never Expires',
      status: 'never',
      fullDetail: 'This personal access token does not have an expiration date.'
    };
  }

  const diff = expiresAt - now;

  if (diff <= 0) {
    const absDiff = Math.abs(diff);
    const daysAgo = Math.floor(absDiff / 86400000);
    const hoursAgo = Math.floor((absDiff % 86400000) / 3600000);
    const minsAgo = Math.floor((absDiff % 3600000) / 60000);

    let agoStr = '';
    if (daysAgo > 0) {
      agoStr = `${daysAgo} ${daysAgo === 1 ? 'day' : 'days'} ago`;
    } else if (hoursAgo > 0) {
      agoStr = `${hoursAgo} ${hoursAgo === 1 ? 'hour' : 'hours'} ago`;
    } else {
      agoStr = `${Math.max(1, minsAgo)} min ago`;
    }

    return {
      text: `Expired ${agoStr}`,
      status: 'expired',
      fullDetail: `Expired on ${new Date(expiresAt).toLocaleString('en-US')}`
    };
  }

  const seconds = Math.floor((diff / 1000) % 60);
  const minutes = Math.floor((diff / (1000 * 60)) % 60);
  const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  let countdownText = '';
  if (days > 0) {
    countdownText = `Expires in ${days}d ${hours}h ${minutes}m ${seconds}s`;
  } else if (hours > 0) {
    countdownText = `Expires in ${hours}h ${minutes}m ${seconds}s`;
  } else {
    countdownText = `Expires in ${minutes}m ${seconds}s`;
  }

  const isWarning = days < 7;
  return {
    text: countdownText,
    status: isWarning ? 'warning' : 'active',
    fullDetail: `Expires on ${new Date(expiresAt).toLocaleString('en-US')}`
  };
}

export const GitHubTokenManager: React.FC<GitHubTokenManagerProps> = ({
  credentials,
  onSaveCredential,
  onDeleteCredential
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTab, setFilterTab] = useState<'all' | 'active' | 'warning' | 'expired'>('all');
  const [now, setNow] = useState(Date.now());
  const [revealedTokenIds, setRevealedTokenIds] = useState<Set<string>>(new Set());
  const [copiedMap, setCopiedMap] = useState<Record<string, boolean>>({});
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCred, setEditingCred] = useState<GitHubCredential | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Live timer tick every 1000ms for continuous real-time countdown ("ulti ginti")
  useEffect(() => {
    const timer = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const handleCopy = (text: string, copyKey: string) => {
    navigator.clipboard.writeText(text);
    setCopiedMap(prev => ({ ...prev, [copyKey]: true }));
    setTimeout(() => {
      setCopiedMap(prev => ({ ...prev, [copyKey]: false }));
    }, 2200);
  };

  const toggleReveal = (id: string) => {
    setRevealedTokenIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const maskToken = (token: string): string => {
    if (!token) return '••••••••••••••••••••••••••••••••';
    const prefix = token.slice(0, 4);
    const suffix = token.slice(-4);
    return `${prefix}${'•'.repeat(Math.max(16, token.length - 8))}${suffix}`;
  };

  const openCreateModal = () => {
    setModalMode('create');
    setEditingCred(null);
    setIsModalOpen(true);
  };

  const openEditModal = (cred: GitHubCredential) => {
    setModalMode('edit');
    setEditingCred(cred);
    setIsModalOpen(true);
  };

  const handleModalSave = async (data: {
    username: string;
    token: string;
    label?: string;
    expiresAt: number | null;
  }) => {
    await onSaveCredential({
      id: editingCred?.id,
      ...data
    });
  };

  const confirmDelete = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this GitHub credential? This cannot be undone.')) {
      setDeletingId(id);
      try {
        await onDeleteCredential(id);
      } finally {
        setDeletingId(null);
      }
    }
  };

  // Filter accounts
  const filteredCredentials = credentials.filter(c => {
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch =
      !q ||
      c.username.toLowerCase().includes(q) ||
      (c.label && c.label.toLowerCase().includes(q));

    if (!matchesSearch) return false;

    if (filterTab === 'all') return true;
    const cd = formatLiveCountdown(c.expiresAt, now);
    if (filterTab === 'active') return cd.status === 'active' || cd.status === 'never';
    if (filterTab === 'warning') return cd.status === 'warning';
    if (filterTab === 'expired') return cd.status === 'expired';
    return true;
  });

  // Calculate stats
  const totalCount = credentials.length;
  const activeCount = credentials.filter(c => {
    const cd = formatLiveCountdown(c.expiresAt, now);
    return cd.status === 'active' || cd.status === 'never';
  }).length;
  const warningCount = credentials.filter(c => {
    const cd = formatLiveCountdown(c.expiresAt, now);
    return cd.status === 'warning';
  }).length;
  const expiredCount = credentials.filter(c => {
    const cd = formatLiveCountdown(c.expiresAt, now);
    return cd.status === 'expired';
  }).length;

  return (
    <div
      className="github-token-manager"
      style={{
        flex: 1,
        height: '100%',
        overflowY: 'auto',
        background: 'var(--bg-canvas)',
        display: 'flex',
        flexDirection: 'column'
      }}
    >
      {/* Top Banner / Hero Header */}
      <div
        style={{
          padding: '24px 32px 20px 32px',
          borderBottom: '1px solid var(--border-subtle)',
          background: 'var(--bg-surface)',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div
              style={{
                width: '44px',
                height: '44px',
                borderRadius: '12px',
                background: '#161b22',
                border: '1px solid #30363d',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
              }}
            >
              <IconGitHub size={28} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <h1 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-main)', letterSpacing: '-0.02em' }}>
                  GitHub Accounts & Tokens
                </h1>
                <span
                  style={{
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: '999px',
                    background: 'rgba(185, 243, 42, 0.15)',
                    color: 'var(--lime-primary)',
                    border: '1px solid rgba(185, 243, 42, 0.3)'
                  }}
                >
                  Secure Vault
                </span>
              </div>
              <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                Store your GitHub usernames & Personal Access Tokens (PAT) with live expiration countdowns and instant copy.
              </p>
            </div>
          </div>

          {/* Primary Add Button */}
          <button
            type="button"
            className="btn"
            onClick={openCreateModal}
            style={{
              background: 'var(--lime-primary)',
              color: '#000000',
              fontWeight: 700,
              fontSize: '0.88rem',
              padding: '10px 18px',
              borderRadius: 'var(--radius-sm)',
              border: 'none',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              cursor: 'pointer',
              boxShadow: '0 2px 10px rgba(185, 243, 42, 0.25)',
              transition: 'all 0.15s ease'
            }}
          >
            <IconPlus size={16} />
            Add GitHub Token
          </button>
        </div>

        {/* Status Metrics Bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', paddingTop: '4px' }}>
          <div
            style={{
              padding: '6px 14px',
              borderRadius: '8px',
              background: 'var(--bg-surface-elevated)',
              border: '1px solid var(--border-subtle)',
              fontSize: '0.8rem',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              color: 'var(--text-secondary)'
            }}
          >
            <IconKey size={14} color="var(--text-tertiary)" />
            <span>Total Accounts:</span>
            <strong style={{ color: 'var(--text-main)' }}>{totalCount}</strong>
          </div>

          <div
            style={{
              padding: '6px 14px',
              borderRadius: '8px',
              background: 'var(--bg-surface-elevated)',
              border: '1px solid var(--border-subtle)',
              fontSize: '0.8rem',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              color: 'var(--text-secondary)'
            }}
          >
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10B981', display: 'inline-block' }} />
            <span>Active:</span>
            <strong style={{ color: '#10B981' }}>{activeCount}</strong>
          </div>

          {warningCount > 0 && (
            <div
              style={{
                padding: '6px 14px',
                borderRadius: '8px',
                background: 'rgba(245, 158, 11, 0.12)',
                border: '1px solid rgba(245, 158, 11, 0.3)',
                fontSize: '0.8rem',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                color: '#f59e0b'
              }}
            >
              <IconClock size={14} />
              <span>Expiring Soon (&lt; 7d):</span>
              <strong>{warningCount}</strong>
            </div>
          )}

          {expiredCount > 0 && (
            <div
              style={{
                padding: '6px 14px',
                borderRadius: '8px',
                background: 'rgba(239, 68, 68, 0.12)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                fontSize: '0.8rem',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                color: '#ef4444'
              }}
            >
              <span>●</span>
              <span>Expired:</span>
              <strong>{expiredCount}</strong>
            </div>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      <div style={{ flex: 1, padding: '24px 32px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {/* Search & Filter Toolbar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
          {/* Search Input */}
          <div style={{ position: 'relative', width: '320px', maxWidth: '100%' }}>
            <span
              style={{
                position: 'absolute',
                left: '12px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--text-tertiary)',
                pointerEvents: 'none'
              }}
            >
              <IconSearch size={15} />
            </span>
            <input
              type="text"
              className="input"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by username or label..."
              style={{ width: '100%', paddingLeft: '34px', fontSize: '0.85rem' }}
            />
          </div>

          {/* Filter Tabs */}
          <div style={{ display: 'flex', gap: '6px', background: 'var(--bg-surface)', padding: '4px', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
            {(
              [
                { id: 'all', label: `All (${totalCount})` },
                { id: 'active', label: `Active (${activeCount})` },
                { id: 'warning', label: `Expiring Soon (${warningCount})` },
                { id: 'expired', label: `Expired (${expiredCount})` }
              ] as { id: 'all' | 'active' | 'warning' | 'expired'; label: string }[]
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFilterTab(tab.id)}
                style={{
                  border: 'none',
                  background: filterTab === tab.id ? 'var(--bg-surface-elevated)' : 'transparent',
                  color: filterTab === tab.id ? 'var(--text-main)' : 'var(--text-tertiary)',
                  fontWeight: filterTab === tab.id ? 700 : 500,
                  fontSize: '0.78rem',
                  padding: '5px 12px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Credentials Cards List */}
        {filteredCredentials.length === 0 ? (
          <div
            style={{
              padding: '64px 24px',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '14px',
              background: 'var(--bg-surface)',
              borderRadius: 'var(--radius-card)',
              border: '1px dashed var(--border-medium)'
            }}
          >
            <div
              style={{
                width: '56px',
                height: '56px',
                borderRadius: '16px',
                background: 'rgba(255, 255, 255, 0.05)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--text-tertiary)'
              }}
            >
              <IconGitHub size={32} />
            </div>
            <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-main)' }}>
              {searchQuery ? 'No matching GitHub credentials found' : 'No GitHub Accounts Added Yet'}
            </h3>
            <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)', maxWidth: '440px', lineHeight: 1.5 }}>
              {searchQuery
                ? 'Try adjusting your search terms or clearing the filter.'
                : 'Click "+ Add GitHub Token" to save your GitHub username and token. Track countdowns in real time and copy them with one click.'}
            </p>
            {!searchQuery && (
              <button
                type="button"
                className="btn btn-primary"
                onClick={openCreateModal}
                style={{
                  background: 'var(--lime-primary)',
                  color: '#000000',
                  fontWeight: 700,
                  marginTop: '8px'
                }}
              >
                + Add Your First GitHub Token
              </button>
            )}
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(460px, 1fr))', gap: '20px' }}>
            {filteredCredentials.map((cred) => {
              const countdown = formatLiveCountdown(cred.expiresAt, now);
              const isRevealed = revealedTokenIds.has(cred.id);
              const usernameCopyKey = `user-${cred.id}`;
              const tokenCopyKey = `token-${cred.id}`;
              const isUsernameCopied = Boolean(copiedMap[usernameCopyKey]);
              const isTokenCopied = Boolean(copiedMap[tokenCopyKey]);

              // Badge colors based on status
              let badgeBg = 'rgba(16, 185, 129, 0.12)';
              let badgeBorder = 'rgba(16, 185, 129, 0.3)';
              let badgeColor = '#10B981';

              if (countdown.status === 'warning') {
                badgeBg = 'rgba(245, 158, 11, 0.15)';
                badgeBorder = 'rgba(245, 158, 11, 0.4)';
                badgeColor = '#f59e0b';
              } else if (countdown.status === 'expired') {
                badgeBg = 'rgba(239, 68, 68, 0.15)';
                badgeBorder = 'rgba(239, 68, 68, 0.4)';
                badgeColor = '#ef4444';
              } else if (countdown.status === 'never') {
                badgeBg = 'rgba(148, 163, 184, 0.12)';
                badgeBorder = 'rgba(148, 163, 184, 0.3)';
                badgeColor = 'var(--text-secondary)';
              }

              return (
                <div
                  key={cred.id}
                  className="github-cred-card"
                  style={{
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-card)',
                    boxShadow: 'var(--shadow-sm)',
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column',
                    transition: 'border-color 0.15s ease, transform 0.15s ease'
                  }}
                >
                  {/* Card Header */}
                  <div
                    style={{
                      padding: '16px 20px',
                      borderBottom: '1px solid var(--border-subtle)',
                      background: 'var(--bg-surface-elevated)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '12px'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
                      <div
                        style={{
                          width: '38px',
                          height: '38px',
                          borderRadius: '10px',
                          background: '#161b22',
                          border: '1px solid #30363d',
                          color: '#ffffff',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0
                        }}
                      >
                        <IconGitHub size={22} />
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <h3
                            style={{
                              margin: 0,
                              fontSize: '0.98rem',
                              fontWeight: 700,
                              color: 'var(--text-main)',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis'
                            }}
                          >
                            {cred.label || cred.username}
                          </h3>
                        </div>
                        <div style={{ fontSize: '0.76rem', color: 'var(--text-tertiary)', marginTop: '2px' }}>
                          @{cred.username}
                        </div>
                      </div>
                    </div>

                    {/* Header Actions */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <button
                        type="button"
                        className="btn btn-icon btn-sm"
                        title="Edit Credential"
                        onClick={() => openEditModal(cred)}
                        style={{ color: 'var(--text-secondary)' }}
                      >
                        <IconEdit size={15} />
                      </button>
                      <button
                        type="button"
                        className="btn btn-icon btn-sm"
                        title="Delete Credential"
                        disabled={deletingId === cred.id}
                        onClick={() => confirmDelete(cred.id)}
                        style={{ color: '#ef4444' }}
                      >
                        <IconTrash size={15} />
                      </button>
                    </div>
                  </div>

                  {/* Real-Time Countdown Pill ("Ulti Ginti") */}
                  <div
                    style={{
                      padding: '10px 20px',
                      background: badgeBg,
                      borderBottom: `1px solid ${badgeBorder}`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      color: badgeColor
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <IconClock size={16} />
                      <span style={{ fontFamily: 'Consolas, monospace', letterSpacing: '0.02em', fontSize: '0.84rem' }}>
                        {countdown.text}
                      </span>
                    </div>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', fontWeight: 500 }}>
                      Live Timer
                    </span>
                  </div>

                  {/* Body: Two ChatGPT-Style Code Blocks */}
                  <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    {/* CHATGPT CODE BLOCK 1: USERNAME */}
                    <div
                      style={{
                        borderRadius: '8px',
                        overflow: 'hidden',
                        border: '1px solid #30363d',
                        background: '#0d1117'
                      }}
                    >
                      {/* ChatGPT Top Header Bar */}
                      <div
                        style={{
                          background: '#161b22',
                          padding: '6px 12px',
                          borderBottom: '1px solid #30363d',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between'
                        }}
                      >
                        <span
                          style={{
                            fontSize: '0.7rem',
                            fontWeight: 700,
                            letterSpacing: '0.06em',
                            textTransform: 'uppercase',
                            color: '#8b949e'
                          }}
                        >
                          GITHUB USERNAME
                        </span>

                        {/* Direct Copy Button */}
                        <button
                          type="button"
                          onClick={() => handleCopy(cred.username, usernameCopyKey)}
                          style={{
                            background: isUsernameCopied ? 'rgba(16, 185, 129, 0.2)' : 'transparent',
                            color: isUsernameCopied ? '#10B981' : '#c9d1d9',
                            border: `1px solid ${isUsernameCopied ? '#10B981' : '#30363d'}`,
                            borderRadius: '4px',
                            padding: '3px 8px',
                            fontSize: '0.74rem',
                            fontWeight: 600,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '5px',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease'
                          }}
                          title="Copy Username"
                        >
                          {isUsernameCopied ? <IconCheck size={13} color="#10B981" /> : <IconCopy size={13} />}
                          <span>{isUsernameCopied ? 'Copied!' : 'Copy'}</span>
                        </button>
                      </div>

                      {/* Monospace Code Content */}
                      <div
                        style={{
                          padding: '10px 14px',
                          color: '#58a6ff',
                          fontFamily: 'Consolas, Monaco, "Courier New", monospace',
                          fontSize: '0.9rem',
                          fontWeight: 600,
                          userSelect: 'all',
                          wordBreak: 'break-all'
                        }}
                      >
                        {cred.username}
                      </div>
                    </div>

                    {/* CHATGPT CODE BLOCK 2: PERSONAL ACCESS TOKEN */}
                    <div
                      style={{
                        borderRadius: '8px',
                        overflow: 'hidden',
                        border: '1px solid #30363d',
                        background: '#0d1117'
                      }}
                    >
                      {/* ChatGPT Top Header Bar */}
                      <div
                        style={{
                          background: '#161b22',
                          padding: '6px 12px',
                          borderBottom: '1px solid #30363d',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between'
                        }}
                      >
                        <span
                          style={{
                            fontSize: '0.7rem',
                            fontWeight: 700,
                            letterSpacing: '0.06em',
                            textTransform: 'uppercase',
                            color: '#8b949e'
                          }}
                        >
                          PERSONAL ACCESS TOKEN
                        </span>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          {/* Toggle Mask/Reveal */}
                          <button
                            type="button"
                            onClick={() => toggleReveal(cred.id)}
                            style={{
                              background: 'transparent',
                              color: '#8b949e',
                              border: '1px solid #30363d',
                              borderRadius: '4px',
                              padding: '3px 8px',
                              fontSize: '0.74rem',
                              fontWeight: 500,
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                              cursor: 'pointer'
                            }}
                            title={isRevealed ? 'Mask Token' : 'Reveal Token'}
                          >
                            {isRevealed ? <IconEyeOff size={13} /> : <IconEye size={13} />}
                            <span>{isRevealed ? 'Hide' : 'Show'}</span>
                          </button>

                          {/* Direct Copy Token Button */}
                          <button
                            type="button"
                            onClick={() => handleCopy(cred.token, tokenCopyKey)}
                            style={{
                              background: isTokenCopied ? 'rgba(16, 185, 129, 0.2)' : 'transparent',
                              color: isTokenCopied ? '#10B981' : '#c9d1d9',
                              border: `1px solid ${isTokenCopied ? '#10B981' : '#30363d'}`,
                              borderRadius: '4px',
                              padding: '3px 8px',
                              fontSize: '0.74rem',
                              fontWeight: 600,
                              display: 'flex',
                              alignItems: 'center',
                              gap: '5px',
                              cursor: 'pointer',
                              transition: 'all 0.15s ease'
                            }}
                            title="Copy Token to Clipboard"
                          >
                            {isTokenCopied ? <IconCheck size={13} color="#10B981" /> : <IconCopy size={13} />}
                            <span>{isTokenCopied ? 'Copied!' : 'Copy Token'}</span>
                          </button>
                        </div>
                      </div>

                      {/* Monospace Code Content */}
                      <div
                        style={{
                          padding: '10px 14px',
                          color: isRevealed ? '#7ee787' : '#8b949e',
                          fontFamily: 'Consolas, Monaco, "Courier New", monospace',
                          fontSize: '0.86rem',
                          fontWeight: 500,
                          userSelect: 'all',
                          wordBreak: 'break-all',
                          letterSpacing: isRevealed ? 'normal' : '0.12em'
                        }}
                      >
                        {isRevealed ? cred.token : maskToken(cred.token)}
                      </div>
                    </div>
                  </div>

                  {/* Card Footer Details */}
                  <div
                    style={{
                      padding: '10px 20px',
                      borderTop: '1px solid var(--border-subtle)',
                      background: 'var(--bg-surface-elevated)',
                      fontSize: '0.74rem',
                      color: 'var(--text-tertiary)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: '8px'
                    }}
                  >
                    <span>
                      {cred.expiresAt
                        ? `Exact Expiry: ${new Date(cred.expiresAt).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric'
                        })} · ${new Date(cred.expiresAt).toLocaleTimeString('en-US', {
                          hour: '2-digit',
                          minute: '2-digit'
                        })}`
                        : 'No Expiration Date Configured'}
                    </span>
                    <a
                      href="https://github.com/settings/tokens"
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        color: 'var(--lime-primary)',
                        textDecoration: 'none',
                        fontWeight: 600,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}
                    >
                      Manage on GitHub ↗
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Creation & Editing Modal */}
      <GitHubTokenModal
        isOpen={isModalOpen}
        mode={modalMode}
        initialData={editingCred}
        onClose={() => setIsModalOpen(false)}
        onSave={handleModalSave}
      />
    </div>
  );
};

