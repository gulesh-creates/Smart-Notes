import React, { useState, useEffect, useRef } from 'react';
import {
  IconPlay,
  IconPause,
  IconUndo,
  IconTrash,
  IconPlus,
  IconClose,
  IconClock,
  IconCheck
} from '../icons/Icons';
import { playTimerTone, getSavedTimerTone } from './timerAudio';

export interface BreakTimerItem {
  id: string;
  title: string;
  totalSeconds: number;
  remainingSeconds: number;
  isRunning: boolean;
  isCompleted: boolean;
  tag?: string;
  color?: string;
}

const STORAGE_KEY = 'smartnotes_break_timers';

const DEFAULT_PRESET_TIMERS: BreakTimerItem[] = [
  {
    id: 'preset-5m-break',
    title: '5 Min Short Break',
    totalSeconds: 300,
    remainingSeconds: 300,
    isRunning: false,
    isCompleted: false,
    tag: 'Break',
    color: '#10B981'
  },
  {
    id: 'preset-15m-rest',
    title: '15 Min Long Rest & Walk',
    totalSeconds: 900,
    remainingSeconds: 900,
    isRunning: false,
    isCompleted: false,
    tag: 'Rest',
    color: '#3B82F6'
  },
  {
    id: 'preset-45m-water',
    title: '45 Min Hydration (Water Drink)',
    totalSeconds: 2700,
    remainingSeconds: 2700,
    isRunning: false,
    isCompleted: false,
    tag: 'Health',
    color: '#06B6D4'
  },
  {
    id: 'preset-20m-eye',
    title: '20 Min Eye Rest (20-20-20 Rule)',
    totalSeconds: 1200,
    remainingSeconds: 1200,
    isRunning: false,
    isCompleted: false,
    tag: 'Wellness',
    color: '#8B5CF6'
  }
];

function loadLocalTimers(): BreakTimerItem[] {
  try {
    if (typeof localStorage !== 'undefined') {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Pause all on fresh reload to prevent desync
          return parsed.map((t: BreakTimerItem) => ({ ...t, isRunning: false }));
        }
      }
    }
  } catch (err) {
    console.warn('Failed to load local break timers:', err);
  }
  return DEFAULT_PRESET_TIMERS;
}

function saveLocalTimers(timers: BreakTimerItem[]) {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(timers));
    }
  } catch (err) {
    console.warn('Failed to save local break timers:', err);
  }
}

export const BreakTimerSuite: React.FC = () => {
  const [timers, setTimers] = useState<BreakTimerItem[]>(() => loadLocalTimers());
  const [showAddModal, setShowAddModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newHours, setNewHours] = useState(0);
  const [newMinutes, setNewMinutes] = useState(5);
  const [newSeconds, setNewSeconds] = useState(0);
  const [newTag, setNewTag] = useState('Break');
  const [alertTimer, setAlertTimer] = useState<BreakTimerItem | null>(null);

  const timersRef = useRef<BreakTimerItem[]>(timers);
  timersRef.current = timers;

  // Persist locally on state change
  useEffect(() => {
    saveLocalTimers(timers);
  }, [timers]);

  // Request browser notification permission once on mount
  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'default') {
        Notification.requestPermission().catch(() => {});
      }
    }
  }, []);

  // Concurrent timer heartbeat tick (1000ms)
  useEffect(() => {
    const interval = setInterval(() => {
      const activeList = timersRef.current;
      const anyRunning = activeList.some(t => t.isRunning && t.remainingSeconds > 0);
      if (!anyRunning) return;

      const updated = activeList.map(t => {
        if (!t.isRunning || t.remainingSeconds <= 0) return t;

        const nextSec = t.remainingSeconds - 1;
        if (nextSec === 0) {
          // Timer finished!
          playTimerTone(getSavedTimerTone());
          if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
            try {
              new Notification(`⏰ Timer Complete: ${t.title}`, {
                body: `Your ${Math.round(t.totalSeconds / 60)} minute timer has finished!`,
                icon: '/icons/icon-192.png'
              });
            } catch {}
          }
          setAlertTimer(t);
          return {
            ...t,
            remainingSeconds: 0,
            isRunning: false,
            isCompleted: true
          };
        }

        return {
          ...t,
          remainingSeconds: nextSec
        };
      });

      setTimers(updated);
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const handleToggleTimer = (id: string) => {
    setTimers(prev =>
      prev.map(t => {
        if (t.id === id) {
          if (t.remainingSeconds <= 0) {
            // Reset and start
            return { ...t, remainingSeconds: t.totalSeconds, isRunning: true, isCompleted: false };
          }
          return { ...t, isRunning: !t.isRunning };
        }
        return t;
      })
    );
  };

  const handleResetTimer = (id: string) => {
    setTimers(prev =>
      prev.map(t =>
        t.id === id
          ? { ...t, remainingSeconds: t.totalSeconds, isRunning: false, isCompleted: false }
          : t
      )
    );
  };

  const handleDeleteTimer = (id: string) => {
    setTimers(prev => prev.filter(t => t.id !== id));
  };

  const handleAddCustomTimer = (e: React.FormEvent) => {
    e.preventDefault();
    const totalSec = (newHours * 3600) + (newMinutes * 60) + newSeconds;
    if (totalSec <= 0) return;

    const customItem: BreakTimerItem = {
      id: `custom-timer-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      title: newTitle.trim() || `${newMinutes}m Timer`,
      totalSeconds: totalSec,
      remainingSeconds: totalSec,
      isRunning: false,
      isCompleted: false,
      tag: newTag,
      color: '#10B981'
    };

    setTimers(prev => [customItem, ...prev]);
    setShowAddModal(false);
    setNewTitle('');
    setNewHours(0);
    setNewMinutes(5);
    setNewSeconds(0);
  };

  const handleQuickAdd = (minutes: number, title: string, tag: string, color: string) => {
    const totalSec = minutes * 60;
    const item: BreakTimerItem = {
      id: `quick-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      title,
      totalSeconds: totalSec,
      remainingSeconds: totalSec,
      isRunning: true, // auto start quick timers
      isCompleted: false,
      tag,
      color
    };
    setTimers(prev => [item, ...prev]);
  };

  const formatTime = (sec: number): string => {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    if (h > 0) {
      return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    }
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  return (
    <div style={{ maxWidth: '1060px', margin: '0 auto', padding: '24px 20px' }}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '16px',
          marginBottom: '24px'
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h1 style={{ fontSize: '1.45rem', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
              Break & Custom Timers
            </h1>
            <span
              style={{
                fontSize: '0.72rem',
                padding: '2px 8px',
                borderRadius: '999px',
                background: 'rgba(16, 185, 129, 0.15)',
                color: '#10B981',
                fontWeight: 700
              }}
            >
              Offline / Local Only
            </span>
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.84rem', margin: '4px 0 0 0' }}>
            Run concurrent timers for breaks, hydration, water drinking, and custom tasks. Strictly local device storage.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setShowAddModal(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 16px',
              fontWeight: 700,
              fontSize: '0.84rem'
            }}
          >
            <IconPlus size={15} />
            + Add Timer
          </button>
        </div>
      </div>

      {/* Quick Preset Buttons */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          flexWrap: 'wrap',
          marginBottom: '28px',
          padding: '12px 16px',
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-subtle)',
          borderRadius: '12px'
        }}
      >
        <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-tertiary)', marginRight: '6px' }}>
          ⚡ Quick Launch:
        </span>
        <button
          type="button"
          className="btn btn-ghost"
          style={{ fontSize: '0.8rem', padding: '6px 12px', border: '1px solid var(--border-subtle)' }}
          onClick={() => handleQuickAdd(5, '5 Min Coffee Break', 'Break', '#10B981')}
        >
          ☕ 5m Break
        </button>
        <button
          type="button"
          className="btn btn-ghost"
          style={{ fontSize: '0.8rem', padding: '6px 12px', border: '1px solid var(--border-subtle)' }}
          onClick={() => handleQuickAdd(15, '15 Min Stretch & Rest', 'Rest', '#3B82F6')}
        >
          🚶 15m Walk
        </button>
        <button
          type="button"
          className="btn btn-ghost"
          style={{ fontSize: '0.8rem', padding: '6px 12px', border: '1px solid var(--border-subtle)' }}
          onClick={() => handleQuickAdd(45, 'Drink Water Reminder', 'Health', '#06B6D4')}
        >
          💧 45m Water
        </button>
        <button
          type="button"
          className="btn btn-ghost"
          style={{ fontSize: '0.8rem', padding: '6px 12px', border: '1px solid var(--border-subtle)' }}
          onClick={() => handleQuickAdd(20, '20-20-20 Eye Rest', 'EyeCare', '#8B5CF6')}
        >
          👀 20m Eyes
        </button>
      </div>

      {/* Timers Grid */}
      {timers.length === 0 ? (
        <div
          style={{
            padding: '48px 20px',
            textAlign: 'center',
            background: 'var(--bg-surface)',
            border: '1px dashed var(--border-subtle)',
            borderRadius: '16px',
            color: 'var(--text-tertiary)'
          }}
        >
          <IconClock size={36} color="var(--text-tertiary)" style={{ marginBottom: '12px' }} />
          <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: '0 0 6px 0', color: 'var(--text-main)' }}>
            No Active Timers
          </h3>
          <p style={{ fontSize: '0.84rem', margin: '0 0 16px 0' }}>
            Click &quot;+ Add Timer&quot; or choose a quick preset above to start a break or reminder.
          </p>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setShowAddModal(true)}
          >
            Create Your First Timer
          </button>
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
            gap: '16px'
          }}
        >
          {timers.map(timer => {
            const fraction = timer.totalSeconds > 0
              ? Math.max(0, Math.min(1, timer.remainingSeconds / timer.totalSeconds))
              : 0;
            const percent = Math.round(fraction * 100);

            return (
              <div
                key={timer.id}
                style={{
                  background: 'var(--bg-surface)',
                  border: timer.isCompleted
                    ? '1px solid #10B981'
                    : timer.isRunning
                    ? '1px solid var(--lime-primary)'
                    : '1px solid var(--border-subtle)',
                  borderRadius: '16px',
                  padding: '20px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  boxShadow: timer.isRunning ? '0 4px 20px rgba(0, 0, 0, 0.25)' : 'none',
                  transition: 'all 0.2s ease',
                  position: 'relative'
                }}
              >
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                  <div style={{ flex: 1, paddingRight: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                      <span
                        style={{
                          fontSize: '0.68rem',
                          padding: '1px 7px',
                          borderRadius: '6px',
                          background: timer.color ? `${timer.color}20` : 'rgba(255,255,255,0.08)',
                          color: timer.color || 'var(--text-secondary)',
                          fontWeight: 700
                        }}
                      >
                        {timer.tag || 'Timer'}
                      </span>
                      {timer.isCompleted && (
                        <span style={{ fontSize: '0.7rem', color: '#10B981', fontWeight: 800 }}>
                          ✓ Done
                        </span>
                      )}
                    </div>
                    <h3
                      style={{
                        fontSize: '0.96rem',
                        fontWeight: 700,
                        color: 'var(--text-main)',
                        margin: 0,
                        lineHeight: 1.3
                      }}
                    >
                      {timer.title}
                    </h3>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleDeleteTimer(timer.id)}
                    title="Delete Timer"
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--text-tertiary)',
                      cursor: 'pointer',
                      padding: '4px',
                      borderRadius: '4px'
                    }}
                  >
                    <IconTrash size={14} />
                  </button>
                </div>

                {/* Big Time Display */}
                <div style={{ textAlign: 'center', margin: '14px 0' }}>
                  <div
                    style={{
                      fontSize: '2.5rem',
                      fontWeight: 800,
                      fontFamily: 'monospace',
                      letterSpacing: '1px',
                      color: timer.isCompleted
                        ? '#10B981'
                        : timer.isRunning
                        ? 'var(--lime-primary)'
                        : 'var(--text-main)'
                    }}
                  >
                    {formatTime(timer.remainingSeconds)}
                  </div>
                  <div style={{ fontSize: '0.74rem', color: 'var(--text-tertiary)', marginTop: '2px' }}>
                    Total {formatTime(timer.totalSeconds)}
                  </div>
                </div>

                {/* Progress Bar */}
                <div
                  style={{
                    height: '6px',
                    borderRadius: '999px',
                    background: 'var(--border-subtle)',
                    overflow: 'hidden',
                    marginBottom: '18px'
                  }}
                >
                  <div
                    style={{
                      height: '100%',
                      width: `${percent}%`,
                      background: timer.isCompleted
                        ? '#10B981'
                        : timer.isRunning
                        ? 'var(--lime-primary)'
                        : 'var(--text-secondary)',
                      transition: 'width 0.3s ease'
                    }}
                  />
                </div>

                {/* Controls */}
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={() => handleToggleTimer(timer.id)}
                    className={timer.isRunning ? 'btn btn-secondary' : 'btn btn-primary'}
                    style={{
                      flex: 1,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      padding: '9px',
                      fontWeight: 700,
                      fontSize: '0.84rem'
                    }}
                  >
                    {timer.isRunning ? (
                      <>
                        <IconPause size={14} /> Pause
                      </>
                    ) : (
                      <>
                        <IconPlay size={14} /> {timer.remainingSeconds <= 0 ? 'Restart' : 'Start'}
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => handleResetTimer(timer.id)}
                    className="btn btn-ghost"
                    title="Reset Timer"
                    style={{
                      border: '1px solid var(--border-subtle)',
                      padding: '9px 12px'
                    }}
                  >
                    <IconUndo size={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Completion Alert Modal */}
      {alertTimer && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.75)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '20px'
          }}
        >
          <div
            style={{
              background: 'var(--bg-surface)',
              border: '2px solid var(--lime-primary)',
              borderRadius: '20px',
              padding: '28px',
              maxWidth: '420px',
              width: '100%',
              textAlign: 'center',
              boxShadow: '0 10px 40px rgba(0, 0, 0, 0.5)'
            }}
          >
            <div
              style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                background: 'rgba(16, 185, 129, 0.15)',
                color: '#10B981',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px auto'
              }}
            >
              <IconCheck size={32} />
            </div>

            <h2 style={{ fontSize: '1.3rem', fontWeight: 800, margin: '0 0 8px 0', color: 'var(--text-main)' }}>
              Timer Finished!
            </h2>
            <p style={{ fontSize: '0.95rem', color: 'var(--text-secondary)', margin: '0 0 20px 0' }}>
              &quot;{alertTimer.title}&quot; is complete. Time to resume focus or stretch.
            </p>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                type="button"
                className="btn btn-primary"
                style={{ flex: 1, padding: '10px', fontWeight: 700 }}
                onClick={() => {
                  // Restart timer
                  handleResetTimer(alertTimer.id);
                  handleToggleTimer(alertTimer.id);
                  setAlertTimer(null);
                }}
              >
                Restart Timer
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                style={{ flex: 1, padding: '10px', border: '1px solid var(--border-subtle)' }}
                onClick={() => setAlertTimer(null)}
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Custom Timer Modal */}
      {showAddModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.75)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '20px'
          }}
        >
          <div
            style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '20px',
              padding: '24px',
              maxWidth: '440px',
              width: '100%',
              boxShadow: '0 10px 40px rgba(0, 0, 0, 0.5)'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0, color: 'var(--text-main)' }}>
                New Custom Timer
              </h2>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
              >
                <IconClose size={18} />
              </button>
            </div>

            <form onSubmit={handleAddCustomTimer}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '6px', color: 'var(--text-secondary)' }}>
                  Timer Name / Purpose
                </label>
                <input
                  type="text"
                  placeholder="e.g. Water Drink Reminder, Stretching, Quick Rest"
                  value={newTitle}
                  onChange={e => setNewTitle(e.target.value)}
                  className="input"
                  style={{ width: '100%', padding: '10px 12px' }}
                  required
                />
              </div>

              {/* Duration Selectors */}
              <div style={{ display: 'flex', gap: '10px', marginBottom: '16px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 700, marginBottom: '4px', color: 'var(--text-tertiary)' }}>
                    Hours
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="23"
                    value={newHours}
                    onChange={e => setNewHours(Math.max(0, parseInt(e.target.value) || 0))}
                    className="input"
                    style={{ width: '100%', textAlign: 'center' }}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 700, marginBottom: '4px', color: 'var(--text-tertiary)' }}>
                    Minutes
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="59"
                    value={newMinutes}
                    onChange={e => setNewMinutes(Math.max(0, parseInt(e.target.value) || 0))}
                    className="input"
                    style={{ width: '100%', textAlign: 'center' }}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 700, marginBottom: '4px', color: 'var(--text-tertiary)' }}>
                    Seconds
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="59"
                    value={newSeconds}
                    onChange={e => setNewSeconds(Math.max(0, parseInt(e.target.value) || 0))}
                    className="input"
                    style={{ width: '100%', textAlign: 'center' }}
                  />
                </div>
              </div>

              {/* Tag Selector */}
              <div style={{ marginBottom: '22px' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '6px', color: 'var(--text-secondary)' }}>
                  Category Tag
                </label>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {['Break', 'Rest', 'Health', 'Hydration', 'Work'].map(t => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setNewTag(t)}
                      style={{
                        padding: '5px 12px',
                        borderRadius: '999px',
                        border: newTag === t ? '1px solid var(--lime-primary)' : '1px solid var(--border-subtle)',
                        background: newTag === t ? 'rgba(218, 253, 75, 0.15)' : 'transparent',
                        color: newTag === t ? 'var(--text-main)' : 'var(--text-secondary)',
                        fontSize: '0.78rem',
                        fontWeight: 700,
                        cursor: 'pointer'
                      }}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ flex: 1, padding: '10px', fontWeight: 700 }}
                >
                  Create Timer
                </button>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => setShowAddModal(false)}
                  style={{ border: '1px solid var(--border-subtle)', padding: '10px' }}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

