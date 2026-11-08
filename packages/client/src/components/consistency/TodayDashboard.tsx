import React, { useState } from 'react';
import { ConsistencyVault, ConsistencyDailyRecord, ConsistencyCalendarEvent } from '@smartnotes/shared';
import {
  getScheduledActivitiesForDate,
  calculateDailyMetrics,
  calculateStreak,
  getLocalDateKey,
  parseLocalDateKey,
  dbToggleActivityCompletion,
  dbSaveConsistencyVault,
  dbSetMinimumDayMode,
  dbRecordManualTime,
  dbSaveCalendarEvent,
  dbDeleteCalendarEvent,
  ScheduledActivityView
} from '../../storage/consistencyDb';
import { focusTimerEngine } from './FocusTimerEngine';
import {
  IconTarget,
  IconFlame,
  IconCheckCircle,
  IconPlay,
  IconClock,
  IconAward,
  IconCopy,
  IconPlus,
  IconTrash,
  IconClose
} from '../icons/Icons';

export interface TodayDashboardProps {
  vault: ConsistencyVault;
  onVaultUpdated: (updatedVault: ConsistencyVault) => void;
  onStartFocus: (activityId: string) => void;
  initialDateKey?: string;
}

export const TodayDashboard: React.FC<TodayDashboardProps> = ({
  vault,
  onVaultUpdated,
  onStartFocus,
  initialDateKey
}) => {
  const [selectedDateKey, setSelectedDateKey] = useState<string>(initialDateKey || getLocalDateKey());

  React.useEffect(() => {
    if (initialDateKey) {
      setSelectedDateKey(initialDateKey);
    }
  }, [initialDateKey]);
  const [copiedChecklist, setCopiedChecklist] = useState<boolean>(false);
  const [manualTimeAct, setManualTimeAct] = useState<{ id: string; title: string } | null>(null);
  const [manualMinutes, setManualMinutes] = useState<number>(15);
  const [manualNotes, setManualNotes] = useState<string>('');

  // Quick Tasks state (Daily & Multi-day ad-hoc To-Dos)
  const [quickTaskInput, setQuickTaskInput] = useState('');
  const [quickTaskDays, setQuickTaskDays] = useState<number>(1);
  const [isAddingQuickTask, setIsAddingQuickTask] = useState(false);

  const quickTasks = (vault.calendarEvents || []).filter(
    ev => ev.dateKey === selectedDateKey && ev.tag === 'QuickTask'
  );

  const handleAddQuickTask = async () => {
    if (!quickTaskInput.trim()) return;
    const daysCount = quickTaskDays;
    let currentVaultState = vault;

    for (let i = 0; i < daysCount; i++) {
      const d = parseLocalDateKey(selectedDateKey);
      d.setDate(d.getDate() + i);
      const targetDateKey = getLocalDateKey(d);

      currentVaultState = await dbSaveCalendarEvent({
        dateKey: targetDateKey,
        title: quickTaskInput.trim(),
        tag: 'QuickTask',
        color: '#8B5CF6'
      }, currentVaultState);
    }

    onVaultUpdated(currentVaultState);
    setQuickTaskInput('');
    setIsAddingQuickTask(false);
    setQuickTaskDays(1);
  };

  const handleToggleQuickTask = async (ev: ConsistencyCalendarEvent) => {
    const isNowDone = !ev.notes?.startsWith('__done__');
    const rawNotes = ev.notes ? ev.notes.replace(/^__done__:/, '').replace(/^__done__/, '') : '';
    const updatedNotes = isNowDone ? `__done__:${rawNotes}` : (rawNotes || undefined);

    // Optimistic update
    const updatedEvents = (vault.calendarEvents || []).map(e =>
      e.id === ev.id ? { ...e, notes: updatedNotes, updatedAt: Date.now() } : e
    );
    const optimisticVault: ConsistencyVault = {
      ...vault,
      calendarEvents: updatedEvents,
      updatedAt: Date.now()
    };
    onVaultUpdated(optimisticVault);

    const updated = await dbSaveCalendarEvent({
      id: ev.id,
      dateKey: ev.dateKey,
      title: ev.title,
      tag: 'QuickTask',
      color: ev.color,
      notes: updatedNotes
    }, vault);
    onVaultUpdated(updated);
  };

  const handleDeleteQuickTask = async (eventId: string) => {
    // Optimistic delete
    const updatedEvents = (vault.calendarEvents || []).filter(e => e.id !== eventId);
    const optimisticVault: ConsistencyVault = {
      ...vault,
      calendarEvents: updatedEvents,
      updatedAt: Date.now()
    };
    onVaultUpdated(optimisticVault);

    const updated = await dbDeleteCalendarEvent(eventId, vault);
    onVaultUpdated(updated);
  };

  const todayKey = getLocalDateKey();
  const isToday = selectedDateKey === todayKey;

  const scheduled = getScheduledActivitiesForDate(vault, selectedDateKey);
  const metrics = calculateDailyMetrics(vault, selectedDateKey);
  const streak = calculateStreak(vault, todayKey);

  // Copy checklist formatted for notes / markdown (Part 5)
  const handleCopyChecklist = () => {
    if (scheduled.length === 0) return;
    const lines = [
      `### Daily Priorities (${dateFormatted})`,
      ...scheduled.map(item => {
        const check = item.isCompleted ? 'x' : ' ';
        return `- [${check}] ${item.activity.title} — ${item.actualMinutes}/${item.effectiveMinMinutes} min`;
      })
    ];
    navigator.clipboard.writeText(lines.join('\n')).then(() => {
      setCopiedChecklist(true);
      setTimeout(() => setCopiedChecklist(false), 2500);
    });
  };

  const handleSaveManualTime = async () => {
    if (!manualTimeAct || manualMinutes <= 0) return;
    const updated = await dbRecordManualTime(
      manualTimeAct.id,
      selectedDateKey,
      manualMinutes,
      manualNotes.trim() || undefined
    );
    onVaultUpdated(updated);
    setManualTimeAct(null);
    setManualNotes('');
    setManualMinutes(15);
  };

  // Group scheduled activities by category
  const groupedByCategory = new Map<string, { categoryName: string; categoryColor: string; items: ScheduledActivityView[] }>();

  for (const item of scheduled) {
    const catId = item.category.id;
    if (!groupedByCategory.has(catId)) {
      groupedByCategory.set(catId, {
        categoryName: item.category.name,
        categoryColor: item.category.color || '#38BDF8',
        items: []
      });
    }
    groupedByCategory.get(catId)!.items.push(item);
  }

  // Auto-sort tasks within each category:
  // Pending tasks (!isCompleted) stay at the top, completed tasks (isCompleted) shift to the bottom
  for (const group of groupedByCategory.values()) {
    group.items.sort((a, b) => {
      if (a.isCompleted !== b.isCompleted) {
        return a.isCompleted ? 1 : -1;
      }
      return a.activity.orderIndex - b.activity.orderIndex;
    });
  }

  const handleToggleCheck = (activityId: string, currentStatus: boolean) => {
    const nextStatus = !currentStatus;
    const now = Date.now();
    const recId = `${activityId}_${selectedDateKey}`;

    // 1. Instantly construct optimistic vault (0ms latency!)
    const existingRec = vault.dailyRecords.find(r => r.id === recId);
    let updatedRecords: ConsistencyDailyRecord[];
    if (existingRec) {
      updatedRecords = vault.dailyRecords.map(r =>
        r.id === recId
          ? {
              ...r,
              isCompleted: nextStatus,
              completedAt: nextStatus ? now : undefined,
              updatedAt: now
            }
          : r
      );
    } else {
      updatedRecords = [
        ...vault.dailyRecords,
        {
          id: recId,
          activityId,
          dateKey: selectedDateKey,
          isCompleted: nextStatus,
          completedAt: nextStatus ? now : undefined,
          actualMinutes: 0,
          updatedAt: now
        }
      ];
    }

    const optimisticVault: ConsistencyVault = {
      ...vault,
      dailyRecords: updatedRecords,
      updatedAt: now
    };

    // 2. Synchronous UI update - box ticks immediately!
    onVaultUpdated(optimisticVault);

    // 3. Persist to storage in background
    dbSaveConsistencyVault(optimisticVault).catch(err => {
      console.warn('Failed to save optimistic vault:', err);
    });
  };

  const handleToggleMinimumDay = async () => {
    const isCurrentlyMinDay = metrics.isMinimumDay;
    const updated = await dbSetMinimumDayMode(selectedDateKey, !isCurrentlyMinDay);
    onVaultUpdated(updated);
  };

  // Format date readable
  const [y, m, d] = selectedDateKey.split('-').map(Number);
  const dateObj = new Date(y, (m || 1) - 1, d || 1);
  const dateFormatted = dateObj.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });

  return (
    <div
      className="today-dashboard-container"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '24px',
        padding: '24px',
        maxWidth: '960px',
        margin: '0 auto',
        width: '100%'
      }}
    >
      {/* Top Banner: Date, Minimum Day Mode, and Today Indicator */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: '16px',
          borderBottom: '1px solid var(--border-subtle)',
          paddingBottom: '20px'
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <h1 style={{ fontSize: '1.65rem', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
              {isToday ? "Today's Consistency" : dateFormatted}
            </h1>
            {isToday && (
              <span
                style={{
                  fontSize: '0.72rem',
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  padding: '3px 8px',
                  borderRadius: 'var(--radius-pill)',
                  background: 'var(--lime-primary)',
                  color: 'var(--text-on-lime)'
                }}
              >
                Today
              </span>
            )}
          </div>
          <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', margin: 0 }}>
            {metrics.isRestDay
              ? 'Intentional rest day — recharge and prepare for tomorrow.'
              : `${metrics.completedCount} of ${metrics.scheduledCount} priorities finished • ${metrics.actualMinutes}m focused of ${metrics.plannedMinutes}m target`}
          </p>
        </div>

        {/* Date Selector & Minimum Day Toggle */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <input
            type="date"
            className="input"
            value={selectedDateKey}
            onChange={(e) => setSelectedDateKey(e.target.value)}
            style={{
              padding: '6px 12px',
              borderRadius: 'var(--radius-sm)',
              background: 'var(--bg-surface-elevated)',
              border: '1px solid var(--border-medium)',
              color: 'var(--text-main)',
              fontSize: '0.85rem'
            }}
          />

          <button
            type="button"
            className="btn"
            style={{
              padding: '7px 14px',
              borderRadius: 'var(--radius-pill)',
              border: metrics.isMinimumDay ? '1.5px solid var(--warning)' : '1px solid var(--border-medium)',
              background: metrics.isMinimumDay ? 'rgba(245, 158, 11, 0.15)' : 'var(--bg-surface-elevated)',
              color: metrics.isMinimumDay ? 'var(--warning)' : 'var(--text-secondary)',
              fontSize: '0.82rem',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              cursor: 'pointer'
            }}
            onClick={handleToggleMinimumDay}
            title={metrics.isMinimumDay ? 'Minimum Day active (5m micro targets)' : 'Busy day? Lower daily targets to 5m micro commitments'}
          >
            ⚡ {metrics.isMinimumDay ? 'Minimum Day Active' : 'Minimum Day Mode'}
          </button>
        </div>
      </div>

      {/* KPI Highlight Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '14px'
        }}
      >
        {/* 1. Daily Productive Time */}
        <div
          style={{
            background: 'var(--bg-surface-elevated)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-card)',
            padding: '16px 20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-tertiary)' }}>
              Focus Time
            </span>
            <IconClock size={16} color="var(--lime-primary)" />
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
            <span style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-main)', fontFamily: 'var(--font-mono)' }}>
              {metrics.actualMinutes}m
            </span>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-tertiary)' }}>
              / {metrics.plannedMinutes}m target
            </span>
          </div>
          {/* Progress bar */}
          <div style={{ width: '100%', height: '6px', background: 'var(--bg-surface-subtle)', borderRadius: '999px', overflow: 'hidden' }}>
            <div
              style={{
                width: `${Math.min(100, metrics.timeTargetAchievement * 100)}%`,
                height: '100%',
                background: metrics.timeTargetAchievement >= 1.0 ? 'var(--lime-primary)' : '#38BDF8',
                borderRadius: '999px',
                transition: 'width 0.3s ease'
              }}
            />
          </div>
        </div>

        {/* 2. Task Completion */}
        <div
          style={{
            background: 'var(--bg-surface-elevated)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-card)',
            padding: '16px 20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-tertiary)' }}>
              Task Completion
            </span>
            <IconCheckCircle size={16} color="var(--lime-primary)" />
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
            <span style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-main)', fontFamily: 'var(--font-mono)' }}>
              {metrics.completedCount}
            </span>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-tertiary)' }}>
              / {metrics.scheduledCount} completed
            </span>
          </div>
          <div style={{ width: '100%', height: '6px', background: 'var(--bg-surface-subtle)', borderRadius: '999px', overflow: 'hidden' }}>
            <div
              style={{
                width: `${Math.min(100, metrics.taskCompletionRate * 100)}%`,
                height: '100%',
                background: metrics.taskCompletionRate >= 1.0 ? 'var(--lime-primary)' : '#A855F7',
                borderRadius: '999px',
                transition: 'width 0.3s ease'
              }}
            />
          </div>
        </div>

        {/* 3. Consistency Score */}
        <div
          style={{
            background: 'var(--bg-surface-elevated)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-card)',
            padding: '16px 20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-tertiary)' }}>
              Daily Score
            </span>
            <IconAward size={16} color={metrics.isQualifyingDay ? 'var(--lime-primary)' : 'var(--text-tertiary)'} />
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
            <span style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-main)', fontFamily: 'var(--font-mono)' }}>
              {metrics.consistencyScore}%
            </span>
            <span
              style={{
                fontSize: '0.78rem',
                fontWeight: 700,
                color: metrics.isQualifyingDay ? 'var(--lime-primary)' : 'var(--text-tertiary)'
              }}
            >
              {metrics.isQualifyingDay ? 'Qualifying (≥70%)' : 'In Progress'}
            </span>
          </div>
          <div style={{ width: '100%', height: '6px', background: 'var(--bg-surface-subtle)', borderRadius: '999px', overflow: 'hidden' }}>
            <div
              style={{
                width: `${metrics.consistencyScore}%`,
                height: '100%',
                background: metrics.isQualifyingDay ? 'var(--lime-primary)' : 'var(--warning)',
                borderRadius: '999px',
                transition: 'width 0.3s ease'
              }}
            />
          </div>
        </div>

        {/* 4. Consistency Streak */}
        <div
          style={{
            background: 'var(--bg-surface-elevated)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-card)',
            padding: '16px 20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-tertiary)' }}>
              Current Streak
            </span>
            <IconFlame size={16} color="var(--warning)" />
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
            <span style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-main)', fontFamily: 'var(--font-mono)' }}>
              🔥 {streak.currentStreak}
            </span>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-tertiary)' }}>
              days (Best: {streak.longestStreak}d)
            </span>
          </div>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
            {streak.qualifyingDatesThisWeek} qualifying days this week
          </span>
        </div>
      </div>

      {/* Primary Section: Today's Priorities Grouped by Category */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
              Scheduled Priorities
            </h2>
            <span style={{ fontSize: '0.82rem', color: 'var(--text-tertiary)' }}>
              {scheduled.length} activities scheduled
            </span>
          </div>

          {scheduled.length > 0 && (
            <button
              type="button"
              className="btn btn-sm"
              style={{
                background: 'var(--bg-surface-elevated)',
                border: '1px solid var(--border-medium)',
                color: copiedChecklist ? 'var(--lime-primary)' : 'var(--text-secondary)',
                fontWeight: 700,
                fontSize: '0.8rem',
                borderRadius: 'var(--radius-pill)',
                padding: '6px 14px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
              onClick={handleCopyChecklist}
              title="Copy interactive markdown checklist to paste into any note"
            >
              <IconCopy size={14} />
              {copiedChecklist ? '✓ Copied to Clipboard!' : 'Copy Checklist for Note'}
            </button>
          )}
        </div>

        {scheduled.length === 0 ? (
          <div
            style={{
              padding: '48px 24px',
              textAlign: 'center',
              background: 'var(--bg-surface-elevated)',
              borderRadius: 'var(--radius-card)',
              border: '1px dashed var(--border-medium)'
            }}
          >
            <div style={{ fontSize: '2rem', marginBottom: '8px' }}>🍃</div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-main)', margin: '0 0 6px 0' }}>
              No Priorities Scheduled for this Date
            </h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0 }}>
              This is a scheduled rest day or no activities matched the recurrence schedule.
            </p>
          </div>
        ) : (
          Array.from(groupedByCategory.entries()).map(([catId, group]) => (
            <div
              key={catId}
              style={{
                background: 'var(--bg-surface-elevated)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-card)',
                padding: '16px 20px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px'
              }}
            >
              {/* Category Header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span
                  style={{
                    width: '10px',
                    height: '10px',
                    borderRadius: '50%',
                    background: group.categoryColor
                  }}
                />
                <h3 style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
                  {group.categoryName}
                </h3>
                <span
                  style={{
                    marginLeft: 'auto',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    color: 'var(--text-tertiary)'
                  }}
                >
                  {group.items.filter(i => i.isCompleted).length} / {group.items.length} done
                </span>
              </div>

              {/* Activity Rows */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {group.items.map(item => {
                  const act = item.activity;
                  const isDone = item.isCompleted;
                  const targetReached = item.actualMinutes >= item.effectiveMinMinutes;
                  const progressRatio = item.effectiveMinMinutes > 0
                    ? Math.min(1.0, item.actualMinutes / item.effectiveMinMinutes)
                    : 1.0;

                  return (
                    <div
                      key={act.id}
                      style={{
                        background: isDone ? 'var(--bg-surface-subtle)' : 'var(--bg-card)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: 'var(--radius-md)',
                        padding: '12px 16px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        flexWrap: 'wrap',
                        gap: '12px',
                        transition: 'background var(--transition-fast)'
                      }}
                    >
                      {/* Left: Checkbox + Title + Target */}
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '12px',
                          flex: 1,
                          minWidth: '220px',
                          cursor: 'pointer',
                          userSelect: 'none'
                        }}
                        onClick={() => handleToggleCheck(act.id, isDone)}
                      >
                        {/* Independent Checkbox (Part 5 & 9: Time target does NOT force task completion) */}
                        <button
                          type="button"
                          className="btn btn-icon btn-sm"
                          style={{
                            width: '24px',
                            height: '24px',
                            borderRadius: '6px',
                            border: isDone ? 'none' : '2px solid var(--border-medium)',
                            background: isDone ? 'var(--lime-primary)' : 'transparent',
                            color: 'var(--text-on-lime)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: 0,
                            cursor: 'pointer',
                            flexShrink: 0
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleCheck(act.id, isDone);
                          }}
                          title={isDone ? 'Mark Incomplete' : 'Mark Task Complete'}
                        >
                          {isDone && <span style={{ fontWeight: 800, fontSize: '0.85rem' }}>✓</span>}
                        </button>

                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span
                              style={{
                                fontSize: '0.95rem',
                                fontWeight: 700,
                                color: isDone ? 'var(--text-tertiary)' : 'var(--text-main)',
                                textDecoration: isDone ? 'line-through' : 'none'
                              }}
                            >
                              {act.title}
                            </span>
                            {item.isMinimumDayOverride && (
                              <span
                                style={{
                                  fontSize: '0.68rem',
                                  fontWeight: 800,
                                  background: 'rgba(245, 158, 11, 0.15)',
                                  color: 'var(--warning)',
                                  padding: '1px 6px',
                                  borderRadius: 'var(--radius-pill)'
                                }}
                              >
                                5m target
                              </span>
                            )}
                          </div>
                          {act.description && (
                            <span style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)' }}>
                              {act.description}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Middle: Duration Target & Progress Bar */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: '160px' }}>
                        <div style={{ width: '80px', height: '6px', background: 'var(--bg-surface-subtle)', borderRadius: '999px', overflow: 'hidden' }}>
                          <div
                            style={{
                              width: `${progressRatio * 100}%`,
                              height: '100%',
                              background: targetReached ? 'var(--lime-primary)' : group.categoryColor,
                              borderRadius: '999px'
                            }}
                          />
                        </div>
                        <span
                          style={{
                            fontSize: '0.82rem',
                            fontFamily: 'var(--font-mono)',
                            fontWeight: 700,
                            color: targetReached ? 'var(--lime-primary)' : 'var(--text-secondary)'
                          }}
                        >
                          {item.actualMinutes} / {item.effectiveMinMinutes}m
                        </span>
                      </div>

                      {/* Right: Actions */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <button
                          type="button"
                          className="btn btn-sm btn-icon"
                          style={{
                            background: 'var(--bg-surface-subtle)',
                            color: 'var(--text-secondary)',
                            borderRadius: 'var(--radius-pill)',
                            border: '1px solid var(--border-subtle)',
                            padding: '4px 10px',
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            height: 'auto'
                          }}
                          onClick={() => setManualTimeAct({ id: act.id, title: act.title })}
                          title="Log offline or manual study time"
                        >
                          <IconPlus size={12} />
                          Time
                        </button>

                        <button
                          type="button"
                          className="btn btn-sm"
                          style={{
                            background: targetReached ? 'var(--bg-surface-subtle)' : 'var(--lime-primary)',
                            color: targetReached ? 'var(--text-main)' : 'var(--text-on-lime)',
                            fontWeight: 800,
                            padding: '6px 14px',
                            borderRadius: 'var(--radius-pill)',
                            border: targetReached ? '1px solid var(--border-medium)' : 'none',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            fontSize: '0.82rem'
                          }}
                          onClick={() => onStartFocus(act.id)}
                          title="Start Progressive Focus Session (5m starter)"
                        >
                          <IconPlay size={12} />
                          {item.actualMinutes > 0 ? 'Focus More' : 'Start Focus'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Quick Tasks Section — Daily & Temporary To-Dos (Part 2) */}
      <div
        style={{
          background: 'var(--bg-surface-elevated)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-card)',
          padding: '20px 24px',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px'
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '12px'
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h2 style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
                Daily Quick Tasks & To-Dos
              </h2>
              {quickTasks.length > 0 && (
                <span
                  style={{
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: '999px',
                    background: 'rgba(139, 92, 246, 0.15)',
                    color: '#A78BFA',
                    border: '1px solid rgba(139, 92, 246, 0.3)'
                  }}
                >
                  {quickTasks.filter(t => t.notes?.startsWith('__done__')).length}/{quickTasks.length} done
                </span>
              )}
            </div>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)', margin: '2px 0 0 0' }}>
              Temporary one-off tasks and errands for {isToday ? 'today' : dateFormatted} (mandir, shopping, quick fixes)
            </p>
          </div>

          <button
            type="button"
            className="btn btn-sm btn-primary"
            onClick={() => setIsAddingQuickTask(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontWeight: 700,
              fontSize: '0.82rem',
              padding: '6px 14px'
            }}
          >
            <IconPlus size={14} /> Add Quick Task
          </button>
        </div>

        {/* Add Quick Task Input Form */}
        {isAddingQuickTask && (
          <div
            style={{
              background: 'var(--bg-canvas)',
              border: '1px solid var(--border-medium)',
              borderRadius: '10px',
              padding: '14px',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px'
            }}
          >
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                type="text"
                className="input"
                placeholder="e.g. Mandir jana hai, project review, fix camera bug..."
                value={quickTaskInput}
                onChange={e => setQuickTaskInput(e.target.value)}
                autoFocus
                onKeyDown={e => {
                  if (e.key === 'Enter') handleAddQuickTask();
                  if (e.key === 'Escape') {
                    setIsAddingQuickTask(false);
                    setQuickTaskInput('');
                  }
                }}
                style={{ flex: 1, padding: '8px 12px', fontSize: '0.88rem' }}
              />
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleAddQuickTask}
                style={{
                  padding: '8px 16px',
                  fontWeight: 800,
                  fontSize: '0.84rem'
                }}
              >
                Add
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => {
                  setIsAddingQuickTask(false);
                  setQuickTaskInput('');
                }}
                style={{ padding: '8px 10px', border: '1px solid var(--border-subtle)' }}
                title="Cancel"
              >
                <IconClose size={14} />
              </button>
            </div>

            {/* Repeat/Duration Selector (1 day, 2 days, 3 days) */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.78rem' }}>
              <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>Active for:</span>
              {[
                { label: 'Today only (1 day)', val: 1 },
                { label: 'Next 2 days', val: 2 },
                { label: 'Next 3 days', val: 3 }
              ].map(opt => (
                <button
                  key={opt.val}
                  type="button"
                  style={{
                    padding: '3px 10px',
                    borderRadius: 'var(--radius-pill)',
                    fontSize: '0.75rem',
                    fontWeight: quickTaskDays === opt.val ? 800 : 500,
                    border: '1px solid',
                    borderColor: quickTaskDays === opt.val ? '#8B5CF6' : 'var(--border-subtle)',
                    background: quickTaskDays === opt.val ? 'rgba(139, 92, 246, 0.18)' : 'transparent',
                    color: quickTaskDays === opt.val ? '#C4B5FD' : 'var(--text-secondary)',
                    cursor: 'pointer'
                  }}
                  onClick={() => setQuickTaskDays(opt.val)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Tasks List */}
        {quickTasks.length === 0 && !isAddingQuickTask ? (
          <div
            style={{
              padding: '20px',
              textAlign: 'center',
              border: '1px dashed var(--border-subtle)',
              borderRadius: '10px',
              color: 'var(--text-tertiary)',
              fontSize: '0.84rem'
            }}
          >
            No temporary tasks logged for this day. Click "+ Add Quick Task" to track one-off todos.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {quickTasks.map(ev => {
              const isDone = ev.notes?.startsWith('__done__');
              return (
                <div
                  key={ev.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '10px 14px',
                    background: 'var(--bg-canvas)',
                    borderRadius: '8px',
                    border: '1px solid var(--border-subtle)',
                    transition: 'all var(--transition-fast)'
                  }}
                >
                  <button
                    type="button"
                    onClick={() => handleToggleQuickTask(ev)}
                    style={{
                      width: '22px',
                      height: '22px',
                      borderRadius: '6px',
                      border: isDone ? 'none' : '2px solid var(--border-medium)',
                      background: isDone ? 'var(--lime-primary)' : 'transparent',
                      color: 'var(--text-on-lime)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: 0,
                      cursor: 'pointer',
                      flexShrink: 0
                    }}
                    title={isDone ? 'Mark as incomplete' : 'Mark as done'}
                  >
                    {isDone && <span style={{ fontWeight: 800, fontSize: '0.8rem' }}>✓</span>}
                  </button>

                  <span
                    style={{
                      flex: 1,
                      fontSize: '0.9rem',
                      fontWeight: 600,
                      color: isDone ? 'var(--text-tertiary)' : 'var(--text-main)',
                      textDecoration: isDone ? 'line-through' : 'none'
                    }}
                  >
                    {ev.title}
                  </span>

                  <button
                    type="button"
                    onClick={() => handleDeleteQuickTask(ev.id)}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--text-tertiary)',
                      cursor: 'pointer',
                      padding: '4px',
                      borderRadius: '4px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                    title="Delete task"
                  >
                    <IconTrash size={14} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Manual Time Entry Modal (Part 9) */}
      {manualTimeAct && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.65)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000,
            padding: '16px'
          }}
          onClick={() => setManualTimeAct(null)}
        >
          <div
            style={{
              background: 'var(--bg-surface-elevated)',
              border: '1px solid var(--border-medium)',
              borderRadius: 'var(--radius-card)',
              padding: '24px',
              maxWidth: '420px',
              width: '100%',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
              boxShadow: 'var(--shadow-lg)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-tertiary)' }}>
                Manual Time Record
              </span>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-main)', margin: '2px 0 0 0' }}>
                {manualTimeAct.title}
              </h3>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                Minutes Invested
              </label>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '8px' }}>
                {[5, 10, 15, 20, 25, 30, 45, 60].map((mins) => (
                  <button
                    key={mins}
                    type="button"
                    className="btn btn-sm"
                    style={{
                      padding: '4px 10px',
                      borderRadius: 'var(--radius-pill)',
                      background: manualMinutes === mins ? 'var(--lime-primary)' : 'var(--bg-surface-subtle)',
                      color: manualMinutes === mins ? 'var(--text-on-lime)' : 'var(--text-secondary)',
                      fontWeight: 700,
                      border: 'none',
                      fontSize: '0.78rem'
                    }}
                    onClick={() => setManualMinutes(mins)}
                  >
                    {mins}m
                  </button>
                ))}
              </div>
              <input
                type="number"
                min="1"
                max="720"
                className="input"
                value={manualMinutes}
                onChange={(e) => setManualMinutes(Math.max(1, Number(e.target.value) || 1))}
                style={{ width: '100%' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                Session Notes (optional)
              </label>
              <input
                type="text"
                className="input"
                placeholder="e.g. Read textbook chapter 4, completed offline problem set"
                value={manualNotes}
                onChange={(e) => setManualNotes(e.target.value)}
                style={{ width: '100%' }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '6px' }}>
              <button
                type="button"
                className="btn"
                onClick={() => setManualTimeAct(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                style={{
                  background: 'var(--lime-primary)',
                  color: 'var(--text-on-lime)',
                  fontWeight: 800
                }}
                onClick={handleSaveManualTime}
              >
                Save {manualMinutes}m Time
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

