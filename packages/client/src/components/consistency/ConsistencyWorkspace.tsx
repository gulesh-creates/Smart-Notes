import React, { useState, useEffect } from 'react';
import { ConsistencyVault } from '@smartnotes/shared';
import { dbGetConsistencyVault, dbSaveConsistencyVault } from '../../storage/consistencyDb';
import { TodayDashboard } from './TodayDashboard';
import { PriorityManager } from './PriorityManager';
import { FocusTimerView } from './FocusTimerView';
import { BreakTimerSuite } from './BreakTimerSuite';
import { ConsistencyCalendarView } from './ConsistencyCalendarView';
import { InsightsView } from './InsightsView';
import { focusTimerEngine } from './FocusTimerEngine';
import { IconTarget, IconFlame, IconBarChart, IconClock, IconCalendar } from '../icons/Icons';

export type ConsistencyTab = 'today' | 'priorities' | 'focus' | 'break' | 'calendar' | 'insights';

export interface ConsistencyWorkspaceProps {
  onSyncVault?: (vault: ConsistencyVault) => void;
  initialTab?: ConsistencyTab;
  initialActivityId?: string | null;
}

export const ConsistencyWorkspace: React.FC<ConsistencyWorkspaceProps> = ({
  onSyncVault,
  initialTab = 'today',
  initialActivityId = null
}) => {
  const [activeTab, setActiveTab] = useState<ConsistencyTab>(initialTab);
  const [vault, setVault] = useState<ConsistencyVault | null>(null);
  const [selectedActivityId, setSelectedActivityId] = useState<string | null>(initialActivityId);
  const [selectedDateKey, setSelectedDateKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Load vault from IndexedDB and subscribe to focus timer session saved events
  useEffect(() => {
    let mounted = true;
    dbGetConsistencyVault().then(v => {
      if (mounted) {
        setVault(v);
        setLoading(false);
      }
    });

    const unsubscribeTimer = focusTimerEngine.subscribeSessionSaved(updatedVault => {
      if (mounted) {
        handleVaultUpdated(updatedVault);
      }
    });

    return () => {
      mounted = false;
      unsubscribeTimer();
    };
  }, []);

  const handleVaultUpdated = (updatedVault: ConsistencyVault) => {
    setVault(updatedVault);
    if (onSyncVault) {
      onSyncVault(updatedVault);
    }
  };

  const handleStartFocus = (activityId: string) => {
    setSelectedActivityId(activityId);
    setActiveTab('focus');
  };

  const handleJumpToDate = (dateKey: string) => {
    setSelectedDateKey(dateKey);
    setActiveTab('today');
  };

  if (loading || !vault) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          color: 'var(--text-tertiary)',
          fontSize: '0.9rem'
        }}
      >
        Loading Consistency Tracker...
      </div>
    );
  }

  return (
    <div
      className="consistency-module-workspace"
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        width: '100%',
        overflowY: 'auto',
        background: 'var(--bg-canvas)'
      }}
    >
      {/* Top Module Sub-Navigation Bar */}
      <div
        style={{
          background: 'var(--bg-surface)',
          borderBottom: '1px solid var(--border-subtle)',
          padding: '0 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
          position: 'sticky',
          top: 0,
          zIndex: 100
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div
            style={{
              width: '28px',
              height: '28px',
              borderRadius: '8px',
              background: 'var(--lime-primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--text-on-lime)'
            }}
          >
            <IconTarget size={16} />
          </div>
          <span style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--text-main)', marginRight: '16px' }}>
            Consistency
          </span>

          {/* Navigation Tabs */}
          <nav style={{ display: 'flex', gap: '4px' }}>
            {[
              { id: 'today', label: 'Today', icon: IconClock },
              { id: 'priorities', label: 'Priorities', icon: IconTarget },
              { id: 'focus', label: 'Focus Timer', icon: IconFlame },
              { id: 'break', label: 'Break Timer', icon: IconClock },
              { id: 'calendar', label: 'Calendar', icon: IconCalendar },
              { id: 'insights', label: 'Insights', icon: IconBarChart }
            ].map(tab => {
              const isActive = activeTab === tab.id;
              const TabIcon = tab.icon;

              return (
                <button
                  key={tab.id}
                  type="button"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '12px 14px',
                    border: 'none',
                    background: 'transparent',
                    color: isActive ? 'var(--text-main)' : 'var(--text-secondary)',
                    fontWeight: isActive ? 800 : 600,
                    fontSize: '0.86rem',
                    borderBottom: isActive ? '2px solid var(--lime-primary)' : '2px solid transparent',
                    cursor: 'pointer',
                    transition: 'all var(--transition-fast)'
                  }}
                  onClick={() => setActiveTab(tab.id as ConsistencyTab)}
                >
                  <TabIcon size={14} color={isActive ? 'var(--lime-primary)' : 'currentColor'} />
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Main Workspace Body */}
      <div style={{ flex: 1, paddingBottom: '48px' }}>
        {activeTab === 'today' && (
          <TodayDashboard
            vault={vault}
            onVaultUpdated={handleVaultUpdated}
            onStartFocus={handleStartFocus}
            initialDateKey={selectedDateKey || undefined}
          />
        )}
        {activeTab === 'priorities' && (
          <PriorityManager
            vault={vault}
            onVaultUpdated={handleVaultUpdated}
            onStartFocus={handleStartFocus}
          />
        )}
        {activeTab === 'focus' && (
          <FocusTimerView
            vault={vault}
            selectedActivityId={selectedActivityId}
            onSessionFinished={() => {
              // Refresh vault after session finishes
              dbGetConsistencyVault().then(handleVaultUpdated);
            }}
          />
        )}
        {activeTab === 'break' && (
          <BreakTimerSuite />
        )}
        {activeTab === 'calendar' && (
          <ConsistencyCalendarView
            vault={vault}
            onVaultUpdated={handleVaultUpdated}
            onJumpToDate={handleJumpToDate}
          />
        )}
        {activeTab === 'insights' && (
          <InsightsView
            vault={vault}
            onVaultUpdated={handleVaultUpdated}
          />
        )}
      </div>
    </div>
  );
};

