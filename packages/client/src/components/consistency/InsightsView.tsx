import React, { useState } from 'react';
import { ConsistencyVault, ConsistencyReflection } from '@smartnotes/shared';
import {
  calculateDailyMetrics,
  calculateStreak,
  getLocalDateKey,
  parseLocalDateKey,
  dbSaveWeeklyReflection
} from '../../storage/consistencyDb';
import {
  IconBarChart,
  IconFlame,
  IconClock,
  IconCheckCircle,
  IconAward,
  IconCalendar
} from '../icons/Icons';

export interface InsightsViewProps {
  vault: ConsistencyVault;
  onVaultUpdated: (updatedVault: ConsistencyVault) => void;
}

export const InsightsView: React.FC<InsightsViewProps> = ({ vault, onVaultUpdated }) => {
  const [activeTab, setActiveTab] = useState<'daily' | 'weekly' | 'monthly'>('weekly');
  const todayKey = getLocalDateKey();
  const streak = calculateStreak(vault, todayKey);

  // Compute current week key (e.g. 2026-W45)
  const now = new Date();
  const startOfYear = new Date(now.getFullYear(), 0, 1);
  const weekNumber = Math.ceil((((now.getTime() - startOfYear.getTime()) / 86400000) + startOfYear.getDay() + 1) / 7);
  const weekKey = `${now.getFullYear()}-W${String(weekNumber).padStart(2, '0')}`;

  // Weekly Reflection state
  const existingReflection = vault.reflections.find(r => r.weekKey === weekKey);
  const [wentWell, setWentWell] = useState(existingReflection?.wentWell || '');
  const [interrupted, setInterrupted] = useState(existingReflection?.interrupted || '');
  const [improveNext, setImproveNext] = useState(existingReflection?.improveNext || '');
  const [reflectionSaved, setReflectionSaved] = useState(false);

  const handleSaveReflection = async () => {
    const updated = await dbSaveWeeklyReflection({
      id: `reflection_${weekKey}`,
      weekKey,
      wentWell,
      interrupted,
      improveNext,
      updatedAt: Date.now()
    });
    onVaultUpdated(updated);
    setReflectionSaved(true);
    setTimeout(() => setReflectionSaved(false), 3000);
  };

  // --- Weekly Data Calculations (Past 7 Days) ---
  const past7Days: { dateKey: string; dayName: string; metrics: ReturnType<typeof calculateDailyMetrics> }[] = [];
  const refDate = parseLocalDateKey(todayKey);

  for (let i = 6; i >= 0; i--) {
    const d = new Date(refDate);
    d.setDate(d.getDate() - i);
    const dk = getLocalDateKey(d);
    const dayName = d.toLocaleDateString(undefined, { weekday: 'short' });
    past7Days.push({
      dateKey: dk,
      dayName,
      metrics: calculateDailyMetrics(vault, dk)
    });
  }

  const rawWeeklyMinutes = past7Days.reduce((sum, d) => sum + d.metrics.actualMinutes, 0);
  const weeklyTotalMinutes = Math.round(rawWeeklyMinutes * 10) / 10;
  const weeklyQualifyingDays = past7Days.filter(d => !d.metrics.isRestDay && d.metrics.isQualifyingDay).length;
  const maxDayMinutes = Math.max(60, ...past7Days.map(d => d.metrics.actualMinutes));

  const todayMetrics = calculateDailyMetrics(vault, todayKey);
  const todayTotalMinutes = Math.round(todayMetrics.actualMinutes * 10) / 10;

  // --- Monthly Heatmap Calculations (Past 35 Days / 5 Weeks) ---
  const heatmapDays: { dateKey: string; dayNum: number; minutes: number; score: number }[] = [];
  for (let i = 34; i >= 0; i--) {
    const d = new Date(refDate);
    d.setDate(d.getDate() - i);
    const dk = getLocalDateKey(d);
    const m = calculateDailyMetrics(vault, dk);
    heatmapDays.push({
      dateKey: dk,
      dayNum: d.getDate(),
      minutes: m.actualMinutes,
      score: m.consistencyScore
    });
  }

  const rawMonthlyMinutes = heatmapDays.reduce((sum, d) => sum + d.minutes, 0);
  const monthlyTotalMinutes = Math.round(rawMonthlyMinutes * 10) / 10;
  const monthlyAvgDailyMinutes = Math.round(monthlyTotalMinutes / 35);

  // Category breakdown for past 7 days
  const categoryMinutesMap = new Map<string, { name: string; color: string; minutes: number }>();
  for (const cat of vault.categories) {
    categoryMinutesMap.set(cat.id, { name: cat.name, color: cat.color || '#38BDF8', minutes: 0 });
  }

  for (const rec of vault.dailyRecords) {
    // Only records from past 7 days
    if (past7Days.some(d => d.dateKey === rec.dateKey)) {
      const act = vault.activities.find(a => a.id === rec.activityId);
      if (act && categoryMinutesMap.has(act.categoryId)) {
        const current = categoryMinutesMap.get(act.categoryId)!;
        current.minutes = Math.round((current.minutes + rec.actualMinutes) * 10) / 10;
      }
    }
  }

  return (
    <div
      className="insights-workspace"
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
      {/* Header with Navigation Tabs */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '16px',
          borderBottom: '1px solid var(--border-subtle)',
          paddingBottom: '20px'
        }}
      >
        <div>
          <h1 style={{ fontSize: '1.65rem', fontWeight: 800, color: 'var(--text-main)', margin: '0 0 4px 0' }}>
            Consistency Insights
          </h1>
          <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', margin: 0 }}>
            Real metrics based on verified focused sessions. Track momentum and weekly reflections.
          </p>
        </div>

        {/* Tab Selector */}
        <div
          style={{
            display: 'flex',
            background: 'var(--bg-surface-elevated)',
            padding: '4px',
            borderRadius: 'var(--radius-pill)',
            border: '1px solid var(--border-medium)'
          }}
        >
          {(['daily', 'weekly', 'monthly'] as const).map(tab => (
            <button
              key={tab}
              type="button"
              className="btn btn-sm"
              style={{
                padding: '6px 16px',
                borderRadius: 'var(--radius-pill)',
                border: 'none',
                background: activeTab === tab ? 'var(--lime-primary)' : 'transparent',
                color: activeTab === tab ? 'var(--text-on-lime)' : 'var(--text-secondary)',
                fontWeight: activeTab === tab ? 800 : 600,
                fontSize: '0.82rem',
                textTransform: 'capitalize'
              }}
              onClick={() => setActiveTab(tab)}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Top Streak & Summary Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '14px'
        }}
      >
        <div
          style={{
            background: 'var(--bg-surface-elevated)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-card)',
            padding: '16px 20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px'
          }}
        >
          <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-tertiary)' }}>
            Active Streak
          </span>
          <span style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--text-main)', fontFamily: 'var(--font-mono)' }}>
            🔥 {streak.currentStreak} Days
          </span>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
            Longest recorded: {streak.longestStreak} days
          </span>
        </div>

        <div
          style={{
            background: 'var(--bg-surface-elevated)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-card)',
            padding: '16px 20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px'
          }}
        >
          <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-tertiary)' }}>
            {activeTab === 'monthly' ? 'Past 35 Days Work' : activeTab === 'daily' ? 'Today Focus Work' : 'Past 7 Days Work'}
          </span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', flexWrap: 'nowrap' }}>
            <span style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--lime-primary)', fontFamily: 'var(--font-mono)', lineHeight: 1.1 }}>
              {activeTab === 'monthly' ? monthlyTotalMinutes : activeTab === 'daily' ? todayTotalMinutes : weeklyTotalMinutes}
            </span>
            <span style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
              min
            </span>
          </div>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
            {activeTab === 'monthly'
              ? `${Math.round(monthlyTotalMinutes / 60 * 10) / 10} productive hours`
              : activeTab === 'daily'
              ? `${Math.round(todayTotalMinutes / 60 * 10) / 10} hours focused today`
              : `${Math.round(weeklyTotalMinutes / 60 * 10) / 10} hours total focused`}
          </span>
        </div>

        <div
          style={{
            background: 'var(--bg-surface-elevated)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-card)',
            padding: '16px 20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px'
          }}
        >
          <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-tertiary)' }}>
            Consistency Ratio
          </span>
          <span style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--text-main)', fontFamily: 'var(--font-mono)', lineHeight: 1.1 }}>
            {weeklyQualifyingDays} / 7
          </span>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
            Qualifying days this week
          </span>
        </div>
      </div>

      {/* Main Reporting Content */}
      {activeTab === 'weekly' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Weekly 7-Day Bar Chart */}
          <div
            style={{
              background: 'var(--bg-surface-elevated)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-card)',
              padding: '24px',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
                7-Day Focus Distribution
              </h3>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>
                Target: {past7Days[0]?.metrics.plannedMinutes || 75}m/day
              </span>
            </div>

            {/* Bar Chart Bars */}
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-end',
                justifyContent: 'space-between',
                height: '180px',
                paddingTop: '20px',
                gap: '12px'
              }}
            >
              {past7Days.map((day) => {
                const heightFraction = maxDayMinutes > 0 ? day.metrics.actualMinutes / maxDayMinutes : 0;
                const isQualifying = day.metrics.isQualifyingDay && !day.metrics.isRestDay;

                return (
                  <div
                    key={day.dateKey}
                    style={{
                      flex: 1,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      height: '100%',
                      justifyContent: 'flex-end',
                      gap: '8px'
                    }}
                  >
                    <span
                      style={{
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        fontFamily: 'var(--font-mono)',
                        color: isQualifying ? 'var(--lime-primary)' : 'var(--text-tertiary)'
                      }}
                    >
                      {Math.round(day.metrics.actualMinutes * 10) / 10}m
                    </span>

                    <div
                      style={{
                        width: '100%',
                        maxWidth: '44px',
                        height: `${Math.max(8, heightFraction * 120)}px`,
                        background: isQualifying ? 'var(--lime-primary)' : 'var(--bg-surface-subtle)',
                        borderRadius: 'var(--radius-xs)',
                        border: isQualifying ? 'none' : '1px solid var(--border-medium)',
                        transition: 'height 0.3s ease'
                      }}
                      title={`${day.dateKey}: ${day.metrics.actualMinutes}m focused (Score: ${day.metrics.consistencyScore}%)`}
                    />

                    <span
                      style={{
                        fontSize: '0.75rem',
                        fontWeight: day.dateKey === todayKey ? 800 : 600,
                        color: day.dateKey === todayKey ? 'var(--lime-primary)' : 'var(--text-secondary)'
                      }}
                    >
                      {day.dayName}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Category-Wise Investment Breakdown */}
          <div
            style={{
              background: 'var(--bg-surface-elevated)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-card)',
              padding: '20px',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px'
            }}
          >
            <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
              Category Investment (Past 7 Days)
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {Array.from(categoryMinutesMap.values()).map(cat => {
                const ratio = weeklyTotalMinutes > 0 ? cat.minutes / weeklyTotalMinutes : 0;
                return (
                  <div key={cat.name} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem' }}>
                      <span style={{ fontWeight: 700, color: 'var(--text-main)' }}>{cat.name}</span>
                      <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
                        {cat.minutes}m ({Math.round(ratio * 100)}%)
                      </span>
                    </div>
                    <div style={{ width: '100%', height: '6px', background: 'var(--bg-surface-subtle)', borderRadius: '999px', overflow: 'hidden' }}>
                      <div
                        style={{
                          width: `${ratio * 100}%`,
                          height: '100%',
                          background: cat.color,
                          borderRadius: '999px'
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'monthly' && (
        /* Monthly Activity Heatmap */
        <div
          style={{
            background: 'var(--bg-surface-elevated)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-card)',
            padding: '24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
              35-Day Consistency Heatmap
            </h3>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>
              Avg: {monthlyAvgDailyMinutes}m/day
            </span>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(7, 1fr)',
              gap: '8px',
              padding: '12px 0'
            }}
          >
            {heatmapDays.map((d) => {
              // Intensity level 0..4
              let bg = 'var(--bg-surface-subtle)';
              let border = '1px solid var(--border-subtle)';
              if (d.minutes >= 60) {
                bg = 'var(--lime-primary)';
                border = 'none';
              } else if (d.minutes >= 30) {
                bg = 'rgba(185, 243, 42, 0.7)';
                border = 'none';
              } else if (d.minutes >= 15) {
                bg = 'rgba(185, 243, 42, 0.4)';
                border = 'none';
              } else if (d.minutes > 0) {
                bg = 'rgba(185, 243, 42, 0.2)';
              }

              return (
                <div
                  key={d.dateKey}
                  style={{
                    aspectRatio: '1',
                    borderRadius: 'var(--radius-xs)',
                    background: bg,
                    border,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    color: d.minutes >= 30 ? 'var(--text-on-lime)' : 'var(--text-secondary)'
                  }}
                  title={`${d.dateKey}: ${d.minutes} min focused (${d.score}% score)`}
                >
                  <span>{d.dayNum}</span>
                </div>
              );
            })}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'flex-end', fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
            <span>Less</span>
            <div style={{ width: '12px', height: '12px', borderRadius: '2px', background: 'var(--bg-surface-subtle)' }} />
            <div style={{ width: '12px', height: '12px', borderRadius: '2px', background: 'rgba(185, 243, 42, 0.2)' }} />
            <div style={{ width: '12px', height: '12px', borderRadius: '2px', background: 'rgba(185, 243, 42, 0.5)' }} />
            <div style={{ width: '12px', height: '12px', borderRadius: '2px', background: 'var(--lime-primary)' }} />
            <span>More</span>
          </div>
        </div>
      )}

      {activeTab === 'daily' && (
        <div
          style={{
            background: 'var(--bg-surface-elevated)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-card)',
            padding: '24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px'
          }}
        >
          <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
            Today's Logged Sessions
          </h3>
          {vault.focusSessions.filter(s => s.dateKey === todayKey).length === 0 ? (
            <p style={{ fontSize: '0.85rem', color: 'var(--text-tertiary)', margin: 0 }}>
              No focus sessions recorded yet today. Start your first 5-minute session in the Focus tab!
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {vault.focusSessions.filter(s => s.dateKey === todayKey).map(sess => {
                const act = vault.activities.find(a => a.id === sess.activityId);
                const mins = Math.round(sess.focusedSeconds / 60);
                const timeStr = new Date(sess.startTimestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

                return (
                  <div
                    key={sess.id}
                    style={{
                      background: 'var(--bg-card)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 'var(--radius-md)',
                      padding: '10px 14px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}
                  >
                    <div>
                      <span style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-main)' }}>
                        {act?.title || 'Focused Work'}
                      </span>
                      <div style={{ fontSize: '0.74rem', color: 'var(--text-tertiary)' }}>
                        Started at {timeStr} • {sess.stagesCompleted} stages completed
                      </div>
                    </div>
                    <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 800, color: 'var(--lime-primary)' }}>
                      +{mins} min
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Weekly Reflection Card (Part 13) */}
      <div
        style={{
          background: 'var(--bg-surface-elevated)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-card)',
          padding: '24px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-main)', margin: '0 0 2px 0' }}>
              Weekly Reflection ({weekKey})
            </h3>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', margin: 0 }}>
              End-of-week deliberate review. Transform effort into sustainable routines.
            </p>
          </div>
          {reflectionSaved && (
            <span style={{ fontSize: '0.78rem', color: 'var(--lime-primary)', fontWeight: 700 }}>
              ✓ Saved!
            </span>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '4px' }}>
              1. What went well this week?
            </label>
            <textarea
              className="input"
              rows={2}
              placeholder="e.g. Completed all C++ programming sessions, maintained 5-day streak"
              value={wentWell}
              onChange={(e) => setWentWell(e.target.value)}
              style={{ width: '100%', resize: 'vertical' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '4px' }}>
              2. What interrupted my consistency?
            </label>
            <textarea
              className="input"
              rows={2}
              placeholder="e.g. Procrastinated starting agency work on Wednesday afternoon"
              value={interrupted}
              onChange={(e) => setInterrupted(e.target.value)}
              style={{ width: '100%', resize: 'vertical' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '4px' }}>
              3. What will I improve next week?
            </label>
            <textarea
              className="input"
              rows={2}
              placeholder="e.g. Use the 5-minute starter timer immediately when sitting down at my desk"
              value={improveNext}
              onChange={(e) => setImproveNext(e.target.value)}
              style={{ width: '100%', resize: 'vertical' }}
            />
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '4px' }}>
          <button
            type="button"
            className="btn btn-primary"
            style={{
              background: 'var(--lime-primary)',
              color: 'var(--text-on-lime)',
              fontWeight: 800,
              padding: '8px 20px',
              borderRadius: 'var(--radius-pill)'
            }}
            onClick={handleSaveReflection}
          >
            Save Reflection
          </button>
        </div>
      </div>
    </div>
  );
};

