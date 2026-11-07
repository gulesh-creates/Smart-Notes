import React, { useState } from 'react';
import {
  ConsistencyVault,
  ConsistencyCalendarEvent
} from '@smartnotes/shared';
import {
  getLocalDateKey,
  calculateDailyMetrics,
  dbSaveCalendarEvent,
  dbDeleteCalendarEvent
} from '../../storage/consistencyDb';
import {
  IconChevronRight,
  IconBack,
  IconPlus,
  IconClose,
  IconFlame,
  IconClock,
  IconCheck,
  IconTrash,
  IconEdit
} from '../icons/Icons';

export interface ConsistencyCalendarViewProps {
  vault: ConsistencyVault;
  onVaultUpdated: (vault: ConsistencyVault) => void;
  onJumpToDate?: (dateKey: string) => void;
}

const EVENT_TAGS = ['Milestone', 'Exam', 'Goal', 'Reminder', 'Task', 'Reflection'];

const TAG_COLORS: Record<string, string> = {
  Milestone: '#10B981',
  Exam: '#EF4444',
  Goal: '#F59E0B',
  Reminder: '#3B82F6',
  Task: '#8B5CF6',
  Reflection: '#EC4899'
};

export const ConsistencyCalendarView: React.FC<ConsistencyCalendarViewProps> = ({
  vault,
  onVaultUpdated,
  onJumpToDate
}) => {
  const todayKey = getLocalDateKey();
  const [currentDate, setCurrentDate] = useState(() => {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), 1);
  });

  const [selectedDateKey, setSelectedDateKey] = useState<string | null>(null);
  const [editingEvent, setEditingEvent] = useState<ConsistencyCalendarEvent | null>(null);
  const [eventTitle, setEventTitle] = useState('');
  const [eventNotes, setEventNotes] = useState('');
  const [eventTag, setEventTag] = useState('Task');
  const [showAddForm, setShowAddForm] = useState(false);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth(); // 0-indexed

  // Month navigation
  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const handleTodayJump = () => {
    const today = new Date();
    setCurrentDate(new Date(today.getFullYear(), today.getMonth(), 1));
    setSelectedDateKey(todayKey);
  };

  // Calendar calculations
  const firstDayOfWeek = new Date(year, month, 1).getDay(); // 0 = Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const prevMonthDays = new Date(year, month, 0).getDate();

  const monthName = currentDate.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

  // Map calendar events by dateKey
  const eventsByDate = new Map<string, ConsistencyCalendarEvent[]>();
  (vault.calendarEvents || []).forEach(ev => {
    if (!eventsByDate.has(ev.dateKey)) {
      eventsByDate.set(ev.dateKey, []);
    }
    eventsByDate.get(ev.dateKey)!.push(ev);
  });

  // Calculate monthly summary
  let totalMonthlyFocusMin = 0;
  let totalQualifyingDays = 0;
  for (let d = 1; d <= daysInMonth; d++) {
    const dk = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const m = calculateDailyMetrics(vault, dk);
    totalMonthlyFocusMin += m.actualMinutes;
    if (!m.isRestDay && m.isQualifyingDay) {
      totalQualifyingDays += 1;
    }
  }

  const handleOpenDateModal = (dateKey: string) => {
    setSelectedDateKey(dateKey);
    setShowAddForm(false);
    setEditingEvent(null);
    setEventTitle('');
    setEventNotes('');
    setEventTag('Task');
  };

  const handleSaveEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDateKey || !eventTitle.trim()) return;

    const eventPayload = {
      ...(editingEvent ? { id: editingEvent.id } : {}),
      dateKey: selectedDateKey,
      title: eventTitle.trim(),
      notes: eventNotes.trim() || undefined,
      tag: eventTag,
      color: TAG_COLORS[eventTag] || '#10B981'
    };

    const updated = await dbSaveCalendarEvent(eventPayload);
    onVaultUpdated(updated);
    setShowAddForm(false);
    setEditingEvent(null);
    setEventTitle('');
    setEventNotes('');
  };

  const handleDeleteEvent = async (eventId: string) => {
    const updated = await dbDeleteCalendarEvent(eventId);
    onVaultUpdated(updated);
    if (editingEvent?.id === eventId) {
      setEditingEvent(null);
      setShowAddForm(false);
    }
  };

  const handleStartEdit = (ev: ConsistencyCalendarEvent) => {
    setEditingEvent(ev);
    setEventTitle(ev.title);
    setEventNotes(ev.notes || '');
    setEventTag(ev.tag || 'Task');
    setShowAddForm(true);
  };

  // Build grid cells
  const gridCells: Array<{ dayNum: number; dateKey: string; isCurrentMonth: boolean }> = [];

  // Previous month trailing days
  for (let i = firstDayOfWeek - 1; i >= 0; i--) {
    const d = prevMonthDays - i;
    const prevMonth = month === 0 ? 11 : month - 1;
    const prevYear = month === 0 ? year - 1 : year;
    const dk = `${prevYear}-${String(prevMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    gridCells.push({ dayNum: d, dateKey: dk, isCurrentMonth: false });
  }

  // Current month days
  for (let d = 1; d <= daysInMonth; d++) {
    const dk = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    gridCells.push({ dayNum: d, dateKey: dk, isCurrentMonth: true });
  }

  // Next month leading days (to fill 35 or 42 cells)
  const remainingCells = 35 - gridCells.length > 0 ? 35 - gridCells.length : (42 - gridCells.length > 0 ? 42 - gridCells.length : 0);
  for (let d = 1; d <= remainingCells; d++) {
    const nextMonth = month === 11 ? 0 : month + 1;
    const nextYear = month === 11 ? year + 1 : year;
    const dk = `${nextYear}-${String(nextMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    gridCells.push({ dayNum: d, dateKey: dk, isCurrentMonth: false });
  }

  // Selected date metrics if modal is open
  const selectedDateMetrics = selectedDateKey ? calculateDailyMetrics(vault, selectedDateKey) : null;
  const selectedDateEvents = selectedDateKey ? (eventsByDate.get(selectedDateKey) || []) : [];

  return (
    <div style={{ maxWidth: '1160px', margin: '0 auto', padding: '24px 20px' }}>
      {/* Month Navigation & Metrics Bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '16px',
          marginBottom: '20px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <h1 style={{ fontSize: '1.45rem', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
            {monthName}
          </h1>
          <div style={{ display: 'flex', gap: '4px' }}>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={handlePrevMonth}
              title="Previous Month"
              style={{ padding: '6px 10px', border: '1px solid var(--border-subtle)' }}
            >
              <IconBack size={14} />
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={handleNextMonth}
              title="Next Month"
              style={{ padding: '6px 10px', border: '1px solid var(--border-subtle)' }}
            >
              <IconChevronRight size={14} />
            </button>
          </div>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={handleTodayJump}
            style={{ fontSize: '0.8rem', padding: '6px 14px', border: '1px solid var(--border-subtle)' }}
          >
            Today
          </button>
        </div>

        {/* Monthly Summary Badges */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 14px',
              borderRadius: '999px',
              background: 'rgba(218, 253, 75, 0.1)',
              border: '1px solid rgba(218, 253, 75, 0.25)',
              fontSize: '0.82rem',
              fontWeight: 700,
              color: 'var(--text-main)'
            }}
          >
            <IconFlame size={15} color="var(--lime-primary)" />
            {totalQualifyingDays} Qualifying Days this month
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 14px',
              borderRadius: '999px',
              background: 'rgba(56, 189, 248, 0.1)',
              border: '1px solid rgba(56, 189, 248, 0.25)',
              fontSize: '0.82rem',
              fontWeight: 700,
              color: 'var(--text-main)'
            }}
          >
            <IconClock size={15} color="#38BDF8" />
            {Math.round(totalMonthlyFocusMin / 60 * 10) / 10}h Focus Time
          </div>
        </div>
      </div>

      {/* Weekday Header */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, 1fr)',
          gap: '8px',
          textAlign: 'center',
          marginBottom: '8px'
        }}
      >
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, idx) => (
          <div
            key={day}
            style={{
              padding: '8px 0',
              fontSize: '0.76rem',
              fontWeight: 800,
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              color: idx === 0 || idx === 6 ? 'var(--text-tertiary)' : 'var(--text-secondary)'
            }}
          >
            {day}
          </div>
        ))}
      </div>

      {/* 7-Column Calendar Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, 1fr)',
          gap: '8px'
        }}
      >
        {gridCells.map(cell => {
          const isToday = cell.dateKey === todayKey;
          const metrics = calculateDailyMetrics(vault, cell.dateKey);
          const cellEvents = eventsByDate.get(cell.dateKey) || [];
          const hasActivity = metrics.actualMinutes > 0 || metrics.completedCount > 0;

          return (
            <div
              key={cell.dateKey}
              onClick={() => handleOpenDateModal(cell.dateKey)}
              role="button"
              tabIndex={0}
              style={{
                minHeight: '115px',
                background: cell.isCurrentMonth ? 'var(--bg-surface)' : 'rgba(255, 255, 255, 0.02)',
                border: isToday
                  ? '2px solid var(--lime-primary)'
                  : cell.isCurrentMonth
                  ? '1px solid var(--border-subtle)'
                  : '1px solid rgba(255, 255, 255, 0.04)',
                borderRadius: '12px',
                padding: '8px 10px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                cursor: 'pointer',
                opacity: cell.isCurrentMonth ? 1 : 0.45,
                transition: 'all 0.15s ease',
                position: 'relative'
              }}
              onMouseEnter={e => {
                if (cell.isCurrentMonth) {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.borderColor = 'var(--text-secondary)';
                }
              }}
              onMouseLeave={e => {
                if (cell.isCurrentMonth) {
                  e.currentTarget.style.transform = 'none';
                  e.currentTarget.style.borderColor = isToday ? 'var(--lime-primary)' : 'var(--border-subtle)';
                }
              }}
            >
              {/* Day Number & Status */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span
                  style={{
                    fontSize: '0.86rem',
                    fontWeight: isToday ? 800 : 700,
                    color: isToday ? 'var(--lime-primary)' : 'var(--text-main)',
                    background: isToday ? 'rgba(218, 253, 75, 0.15)' : 'transparent',
                    padding: isToday ? '1px 6px' : '0',
                    borderRadius: '6px'
                  }}
                >
                  {cell.dayNum}
                </span>

                {hasActivity && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                    {metrics.isQualifyingDay && (
                      <span title="Qualifying Day Streak" style={{ fontSize: '0.74rem' }}>
                        🔥
                      </span>
                    )}
                    <span
                      style={{
                        fontSize: '0.66rem',
                        fontWeight: 700,
                        padding: '1px 5px',
                        borderRadius: '4px',
                        background: metrics.isQualifyingDay
                          ? 'rgba(16, 185, 129, 0.2)'
                          : 'rgba(255, 255, 255, 0.08)',
                        color: metrics.isQualifyingDay ? '#10B981' : 'var(--text-secondary)'
                      }}
                    >
                      {metrics.consistencyScore}%
                    </span>
                  </div>
                )}
              </div>

              {/* Event / Task Chips (Small text over the box) */}
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '3px',
                  margin: '4px 0',
                  overflow: 'hidden'
                }}
              >
                {cellEvents.slice(0, 2).map(ev => {
                  const tagColor = TAG_COLORS[ev.tag || 'Task'] || '#38BDF8';
                  return (
                    <div
                      key={ev.id}
                      style={{
                        fontSize: '0.68rem',
                        fontWeight: 600,
                        padding: '2px 5px',
                        borderRadius: '4px',
                        background: `${tagColor}22`,
                        color: tagColor,
                        borderLeft: `2px solid ${tagColor}`,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis'
                      }}
                      title={`${ev.tag || 'Task'}: ${ev.title}`}
                    >
                      {ev.title}
                    </div>
                  );
                })}
                {cellEvents.length > 2 && (
                  <span style={{ fontSize: '0.64rem', color: 'var(--text-tertiary)', fontWeight: 700 }}>
                    +{cellEvents.length - 2} more
                  </span>
                )}
              </div>

              {/* Bottom Metrics Pill */}
              {hasActivity ? (
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: '0.66rem',
                    color: 'var(--text-tertiary)',
                    fontWeight: 600
                  }}
                >
                  <span>⏱ {Math.round(metrics.actualMinutes)}m</span>
                  <span>✓ {metrics.completedCount}/{metrics.scheduledCount}</span>
                </div>
              ) : (
                <div style={{ height: '14px' }} />
              )}
            </div>
          );
        })}
      </div>

      {/* Date Detail & Event Management Modal */}
      {selectedDateKey && (
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
              padding: '28px',
              maxWidth: '540px',
              width: '100%',
              maxHeight: '90vh',
              overflowY: 'auto',
              boxShadow: '0 10px 40px rgba(0, 0, 0, 0.5)'
            }}
          >
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
              <div>
                <span style={{ fontSize: '0.74rem', color: 'var(--lime-primary)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Date Details
                </span>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: '2px 0 0 0', color: 'var(--text-main)' }}>
                  {new Date(selectedDateKey + 'T00:00:00').toLocaleDateString(undefined, {
                    weekday: 'long',
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric'
                  })}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setSelectedDateKey(null)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
              >
                <IconClose size={20} />
              </button>
            </div>

            {/* Daily Consistency Stats for Selected Day */}
            {selectedDateMetrics && (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: '10px',
                  padding: '14px',
                  background: 'var(--bg-canvas)',
                  borderRadius: '12px',
                  marginBottom: '22px'
                }}
              >
                <div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', fontWeight: 600 }}>
                    Focus Time
                  </div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-main)', marginTop: '2px' }}>
                    {Math.round(selectedDateMetrics.actualMinutes * 10) / 10}m
                  </div>
                  <div style={{ fontSize: '0.68rem', color: 'var(--text-tertiary)' }}>
                    target {selectedDateMetrics.plannedMinutes}m
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', fontWeight: 600 }}>
                    Tasks Completed
                  </div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-main)', marginTop: '2px' }}>
                    {selectedDateMetrics.completedCount} / {selectedDateMetrics.scheduledCount}
                  </div>
                  <div style={{ fontSize: '0.68rem', color: 'var(--text-tertiary)' }}>
                    priorities
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', fontWeight: 600 }}>
                    Daily Score
                  </div>
                  <div
                    style={{
                      fontSize: '1.1rem',
                      fontWeight: 800,
                      color: selectedDateMetrics.isQualifyingDay ? '#10B981' : 'var(--text-main)',
                      marginTop: '2px'
                    }}
                  >
                    {selectedDateMetrics.consistencyScore}%
                  </div>
                  <div style={{ fontSize: '0.68rem', color: selectedDateMetrics.isQualifyingDay ? '#10B981' : 'var(--text-tertiary)' }}>
                    {selectedDateMetrics.isQualifyingDay ? '🔥 Qualified' : 'In Progress'}
                  </div>
                </div>
              </div>
            )}

            {/* Event List Section */}
            <div style={{ marginBottom: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <h3 style={{ fontSize: '0.92rem', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
                  Events, Deadlines & Specific Tasks ({selectedDateEvents.length})
                </h3>
                {!showAddForm && (
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => {
                      setShowAddForm(true);
                      setEditingEvent(null);
                      setEventTitle('');
                      setEventNotes('');
                    }}
                    style={{ fontSize: '0.78rem', padding: '5px 12px', fontWeight: 700 }}
                  >
                    <IconPlus size={13} /> + Add Event
                  </button>
                )}
              </div>

              {selectedDateEvents.length === 0 && !showAddForm ? (
                <div
                  style={{
                    padding: '24px',
                    textAlign: 'center',
                    border: '1px dashed var(--border-subtle)',
                    borderRadius: '12px',
                    color: 'var(--text-tertiary)',
                    fontSize: '0.84rem'
                  }}
                >
                  No specific events or notes saved for this date.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {selectedDateEvents.map(ev => {
                    const tagColor = TAG_COLORS[ev.tag || 'Task'] || '#38BDF8';
                    return (
                      <div
                        key={ev.id}
                        style={{
                          padding: '12px 14px',
                          background: 'var(--bg-canvas)',
                          borderRadius: '10px',
                          border: `1px solid var(--border-subtle)`,
                          borderLeft: `4px solid ${tagColor}`,
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'flex-start'
                        }}
                      >
                        <div style={{ flex: 1, paddingRight: '12px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                            <span
                              style={{
                                fontSize: '0.68rem',
                                fontWeight: 700,
                                padding: '1px 6px',
                                borderRadius: '4px',
                                background: `${tagColor}25`,
                                color: tagColor
                              }}
                            >
                              {ev.tag || 'Task'}
                            </span>
                          </div>
                          <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-main)' }}>
                            {ev.title}
                          </div>
                          {ev.notes && (
                            <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '4px', whiteSpace: 'pre-wrap' }}>
                              {ev.notes}
                            </div>
                          )}
                        </div>

                        <div style={{ display: 'flex', gap: '4px' }}>
                          <button
                            type="button"
                            onClick={() => handleStartEdit(ev)}
                            title="Edit"
                            style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '4px' }}
                          >
                            <IconEdit size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteEvent(ev.id)}
                            title="Delete"
                            style={{ background: 'transparent', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', padding: '4px' }}
                          >
                            <IconTrash size={14} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Add / Edit Form */}
            {showAddForm && (
              <form
                onSubmit={handleSaveEvent}
                style={{
                  padding: '16px',
                  background: 'var(--bg-canvas)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '12px',
                  marginBottom: '20px'
                }}
              >
                <div style={{ fontSize: '0.86rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: '12px' }}>
                  {editingEvent ? 'Edit Event / Note' : 'Add Event / Note for this Date'}
                </div>

                <div style={{ marginBottom: '12px' }}>
                  <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                    Title
                  </label>
                  <input
                    type="text"
                    value={eventTitle}
                    onChange={e => setEventTitle(e.target.value)}
                    placeholder="e.g. C++ Midterm Exam, Submit Assignment, Revision"
                    className="input"
                    style={{ width: '100%', padding: '8px 12px', fontSize: '0.86rem' }}
                    required
                  />
                </div>

                <div style={{ marginBottom: '12px' }}>
                  <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                    Category Tag
                  </label>
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    {EVENT_TAGS.map(t => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setEventTag(t)}
                        style={{
                          padding: '4px 10px',
                          borderRadius: '999px',
                          border: eventTag === t ? '1px solid var(--lime-primary)' : '1px solid var(--border-subtle)',
                          background: eventTag === t ? 'rgba(218, 253, 75, 0.15)' : 'transparent',
                          color: eventTag === t ? 'var(--text-main)' : 'var(--text-secondary)',
                          fontSize: '0.74rem',
                          fontWeight: 700,
                          cursor: 'pointer'
                        }}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>

                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                    Notes & Details (optional)
                  </label>
                  <textarea
                    value={eventNotes}
                    onChange={e => setEventNotes(e.target.value)}
                    placeholder="Specific milestones, chapters to cover, or reminders..."
                    className="textarea"
                    rows={3}
                    style={{ width: '100%', padding: '8px 12px', fontSize: '0.84rem' }}
                  />
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                  <button type="submit" className="btn btn-primary" style={{ padding: '8px 16px', fontWeight: 700, fontSize: '0.82rem' }}>
                    {editingEvent ? 'Update Event' : 'Save Event'}
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => {
                      setShowAddForm(false);
                      setEditingEvent(null);
                    }}
                    style={{ border: '1px solid var(--border-subtle)', padding: '8px 14px', fontSize: '0.82rem' }}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}

            {/* Modal Bottom Actions */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px' }}>
              {onJumpToDate && (
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => {
                    onJumpToDate(selectedDateKey);
                    setSelectedDateKey(null);
                  }}
                  style={{ fontSize: '0.82rem', padding: '8px 14px', border: '1px solid var(--border-subtle)' }}
                >
                  ⚡ Open in Today Dashboard
                </button>
              )}
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setSelectedDateKey(null)}
                style={{ marginLeft: 'auto', padding: '8px 18px', fontSize: '0.82rem', fontWeight: 700 }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

