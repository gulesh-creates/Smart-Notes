import React, { useState } from 'react';
import {
  ConsistencyVault,
  ConsistencyCategory,
  ConsistencyActivity,
  ConsistencyRecurrence
} from '@smartnotes/shared';
import {
  dbAddCategory,
  dbUpdateCategory,
  dbDeleteCategory,
  dbAddActivity,
  dbUpdateActivity,
  dbDeleteActivity
} from '../../storage/consistencyDb';
import {
  IconPlus,
  IconEdit,
  IconTrash,
  IconClock,
  IconChevronDown,
  IconChevronRight,
  IconCheckCircle
} from '../icons/Icons';

export interface PriorityManagerProps {
  vault: ConsistencyVault;
  onVaultUpdated: (updatedVault: ConsistencyVault) => void;
  onStartFocus?: (activityId: string) => void;
}

const COLOR_PALETTE = [
  '#38BDF8', // Cyan
  '#A855F7', // Purple
  '#22C55E', // Green
  '#F59E0B', // Amber
  '#EC4899', // Pink
  '#6366F1'  // Indigo
];

export const PriorityManager: React.FC<PriorityManagerProps> = ({
  vault,
  onVaultUpdated,
  onStartFocus
}) => {
  // Modal states
  const [editingCategory, setEditingCategory] = useState<Partial<ConsistencyCategory> | null>(null);
  const [editingActivity, setEditingActivity] = useState<Partial<ConsistencyActivity> | null>(null);

  // Active non-archived categories & activities
  const categories = vault.categories.filter(c => !c.isArchived);
  const activities = vault.activities.filter(a => !a.isArchived);

  // Calculate daily workload summary
  const dailyWorkloadMinutes = activities.reduce((acc, act) => {
    if (act.isPaused) return acc;
    // If daily recurrence or average weekday
    return acc + act.minMinutes;
  }, 0);

  // --- Category Handlers ---
  const handleOpenAddCategory = () => {
    setEditingCategory({
      name: '',
      description: '',
      color: COLOR_PALETTE[0],
      orderIndex: categories.length,
      isPaused: false
    });
  };

  const handleSaveCategory = async () => {
    if (!editingCategory || !editingCategory.name?.trim()) return;
    let updated: ConsistencyVault;

    if (editingCategory.id) {
      updated = await dbUpdateCategory(editingCategory.id, {
        name: editingCategory.name.trim(),
        description: editingCategory.description?.trim(),
        color: editingCategory.color,
        isPaused: editingCategory.isPaused
      });
    } else {
      updated = await dbAddCategory({
        name: editingCategory.name.trim(),
        description: editingCategory.description?.trim(),
        color: editingCategory.color || COLOR_PALETTE[0],
        orderIndex: categories.length,
        isPaused: false,
        isArchived: false
      });
    }

    onVaultUpdated(updated);
    setEditingCategory(null);
  };

  const handleDeleteCategory = async (id: string) => {
    if (confirm('Archive this category and its activities? Historical focus records will be preserved.')) {
      const updated = await dbDeleteCategory(id);
      onVaultUpdated(updated);
    }
  };

  // --- Activity Handlers ---
  const handleOpenAddActivity = (categoryId: string) => {
    const parentCat = categories.find(c => c.id === categoryId) || categories[0];
    setEditingActivity({
      categoryId: parentCat?.id || '',
      title: '',
      description: '',
      minMinutes: 10,
      idealMinutes: 20,
      recurrence: { type: 'daily' },
      orderIndex: activities.filter(a => a.categoryId === categoryId).length,
      isPaused: false
    });
  };

  const handleSaveActivity = async () => {
    if (!editingActivity || !editingActivity.title?.trim() || !editingActivity.categoryId) return;
    let updated: ConsistencyVault;

    if (editingActivity.id) {
      updated = await dbUpdateActivity(editingActivity.id, {
        title: editingActivity.title.trim(),
        description: editingActivity.description?.trim(),
        categoryId: editingActivity.categoryId,
        minMinutes: Number(editingActivity.minMinutes) || 5,
        idealMinutes: editingActivity.idealMinutes ? Number(editingActivity.idealMinutes) : undefined,
        recurrence: editingActivity.recurrence || { type: 'daily' },
        startDate: editingActivity.startDate,
        endDate: editingActivity.endDate,
        isPaused: editingActivity.isPaused
      });
    } else {
      updated = await dbAddActivity({
        title: editingActivity.title.trim(),
        description: editingActivity.description?.trim(),
        categoryId: editingActivity.categoryId,
        minMinutes: Number(editingActivity.minMinutes) || 5,
        idealMinutes: editingActivity.idealMinutes ? Number(editingActivity.idealMinutes) : undefined,
        recurrence: editingActivity.recurrence || { type: 'daily' },
        startDate: editingActivity.startDate,
        endDate: editingActivity.endDate,
        orderIndex: activities.filter(a => a.categoryId === editingActivity.categoryId).length,
        isPaused: false,
        isArchived: false
      });
    }

    onVaultUpdated(updated);
    setEditingActivity(null);
  };

  const handleDeleteActivity = async (id: string) => {
    if (confirm('Archive this priority activity? Historical focus records will be preserved.')) {
      const updated = await dbDeleteActivity(id);
      onVaultUpdated(updated);
    }
  };

  return (
    <div
      className="priority-manager-workspace"
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
      {/* Header and Summary */}
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
            Priority Manager
          </h1>
          <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', margin: 0 }}>
            Organize life priorities into minimum daily commitments. Start small to build unshakeable consistency.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {/* Workload badge */}
          <div
            style={{
              padding: '6px 14px',
              borderRadius: 'var(--radius-pill)',
              background: 'var(--bg-surface-elevated)',
              border: '1px solid var(--border-medium)',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '0.82rem',
              fontWeight: 700,
              color: 'var(--text-main)'
            }}
          >
            <IconClock size={14} color="var(--lime-primary)" />
            Total Daily: {dailyWorkloadMinutes} min/day
          </div>

          <button
            type="button"
            className="btn btn-primary"
            style={{
              background: 'var(--lime-primary)',
              color: 'var(--text-on-lime)',
              fontWeight: 800,
              padding: '8px 16px',
              borderRadius: 'var(--radius-pill)',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
            onClick={handleOpenAddCategory}
          >
            <IconPlus size={16} /> Add Category
          </button>
        </div>
      </div>

      {/* Category List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {categories.map((cat) => {
          const catActivities = activities.filter(a => a.categoryId === cat.id);
          const catDailyMin = catActivities.reduce((sum, a) => sum + (a.isPaused ? 0 : a.minMinutes), 0);

          return (
            <div
              key={cat.id}
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
              {/* Category Header */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '8px'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span
                    style={{
                      width: '12px',
                      height: '12px',
                      borderRadius: '50%',
                      background: cat.color || '#38BDF8',
                      boxShadow: `0 0 8px ${cat.color}88`
                    }}
                  />
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <h3 style={{ fontSize: '1.08rem', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
                        {cat.name}
                      </h3>
                      {cat.isPaused && (
                        <span
                          style={{
                            fontSize: '0.68rem',
                            fontWeight: 700,
                            padding: '1px 6px',
                            borderRadius: 'var(--radius-pill)',
                            background: 'var(--bg-surface-subtle)',
                            color: 'var(--text-tertiary)'
                          }}
                        >
                          Paused
                        </span>
                      )}
                    </div>
                    {cat.description && (
                      <span style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)' }}>
                        {cat.description}
                      </span>
                    )}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                    {catDailyMin} min/day
                  </span>

                  <button
                    type="button"
                    className="btn btn-icon btn-sm"
                    onClick={() => handleOpenAddActivity(cat.id)}
                    title="Add Activity to this Category"
                    style={{ background: 'var(--bg-surface-subtle)' }}
                  >
                    <IconPlus size={14} />
                  </button>

                  <button
                    type="button"
                    className="btn btn-icon btn-sm"
                    onClick={() => setEditingCategory(cat)}
                    title="Edit Category"
                  >
                    <IconEdit size={14} />
                  </button>

                  <button
                    type="button"
                    className="btn btn-icon btn-sm"
                    onClick={() => handleDeleteCategory(cat.id)}
                    title="Archive Category"
                    style={{ color: 'var(--danger)' }}
                  >
                    <IconTrash size={14} />
                  </button>
                </div>
              </div>

              {/* Nested Activities */}
              {catActivities.length === 0 ? (
                <div
                  style={{
                    padding: '16px',
                    textAlign: 'center',
                    background: 'var(--bg-card)',
                    borderRadius: 'var(--radius-md)',
                    border: '1px dashed var(--border-medium)',
                    fontSize: '0.82rem',
                    color: 'var(--text-tertiary)'
                  }}
                >
                  No activities in this category yet. Click "+" to add one.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {catActivities.map((act) => {
                    const recurrenceLabel = act.recurrence.type === 'daily'
                      ? 'Every day'
                      : act.recurrence.type === 'weekdays'
                      ? 'Mon – Fri'
                      : act.recurrence.type === 'weekends'
                      ? 'Sat – Sun'
                      : 'Custom days';

                    return (
                      <div
                        key={act.id}
                        style={{
                          background: 'var(--bg-card)',
                          border: '1px solid var(--border-subtle)',
                          borderRadius: 'var(--radius-md)',
                          padding: '10px 14px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '12px',
                          flexWrap: 'wrap'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: '200px' }}>
                          <span
                            style={{
                              width: '6px',
                              height: '6px',
                              borderRadius: '50%',
                              background: act.isPaused ? 'var(--text-tertiary)' : (cat.color || 'var(--lime-primary)')
                            }}
                          />
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-main)' }}>
                                {act.title}
                              </span>
                              {act.isPaused && (
                                <span style={{ fontSize: '0.65rem', color: 'var(--text-tertiary)' }}>(Paused)</span>
                              )}
                            </div>
                            {act.description && (
                              <span style={{ fontSize: '0.74rem', color: 'var(--text-tertiary)' }}>
                                {act.description}
                              </span>
                            )}
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <span
                            style={{
                              fontSize: '0.76rem',
                              padding: '2px 8px',
                              borderRadius: 'var(--radius-pill)',
                              background: 'var(--bg-surface-subtle)',
                              color: 'var(--text-secondary)',
                              fontWeight: 600
                            }}
                          >
                            {recurrenceLabel}
                          </span>

                          <span
                            style={{
                              fontSize: '0.82rem',
                              fontWeight: 800,
                              fontFamily: 'var(--font-mono)',
                              color: 'var(--lime-primary)'
                            }}
                          >
                            {act.minMinutes} min
                          </span>

                          <div style={{ display: 'flex', gap: '4px' }}>
                            <button
                              type="button"
                              className="btn btn-icon btn-sm"
                              onClick={() => setEditingActivity(act)}
                              title="Edit Activity"
                            >
                              <IconEdit size={13} />
                            </button>
                            <button
                              type="button"
                              className="btn btn-icon btn-sm"
                              onClick={() => handleDeleteActivity(act.id)}
                              title="Archive Activity"
                              style={{ color: 'var(--danger)' }}
                            >
                              <IconTrash size={13} />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Category Modal */}
      {editingCategory && (
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
          onClick={() => setEditingCategory(null)}
        >
          <div
            style={{
              background: 'var(--bg-surface-elevated)',
              border: '1px solid var(--border-medium)',
              borderRadius: 'var(--radius-card)',
              padding: '24px',
              maxWidth: '460px',
              width: '100%',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
              boxShadow: 'var(--shadow-lg)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
              {editingCategory.id ? 'Edit Category' : 'Add Category'}
            </h3>

            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                Category Name
              </label>
              <input
                type="text"
                className="input"
                placeholder="e.g. Academics, Agency, Health"
                value={editingCategory.name || ''}
                onChange={(e) => setEditingCategory({ ...editingCategory, name: e.target.value })}
                style={{ width: '100%' }}
                autoFocus
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                Description (optional)
              </label>
              <input
                type="text"
                className="input"
                placeholder="Brief purpose"
                value={editingCategory.description || ''}
                onChange={(e) => setEditingCategory({ ...editingCategory, description: e.target.value })}
                style={{ width: '100%' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '8px' }}>
                Color Tag
              </label>
              <div style={{ display: 'flex', gap: '8px' }}>
                {COLOR_PALETTE.map((color) => (
                  <button
                    key={color}
                    type="button"
                    style={{
                      width: '28px',
                      height: '28px',
                      borderRadius: '50%',
                      background: color,
                      border: editingCategory.color === color ? '3px solid #FFFFFF' : 'none',
                      boxShadow: editingCategory.color === color ? '0 0 8px rgba(0,0,0,0.4)' : 'none',
                      cursor: 'pointer'
                    }}
                    onClick={() => setEditingCategory({ ...editingCategory, color })}
                  />
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '8px' }}>
              <button
                type="button"
                className="btn"
                onClick={() => setEditingCategory(null)}
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
                onClick={handleSaveCategory}
              >
                Save Category
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Activity Modal */}
      {editingActivity && (
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
          onClick={() => setEditingActivity(null)}
        >
          <div
            style={{
              background: 'var(--bg-surface-elevated)',
              border: '1px solid var(--border-medium)',
              borderRadius: 'var(--radius-card)',
              padding: '24px',
              maxWidth: '520px',
              width: '100%',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
              boxShadow: 'var(--shadow-lg)',
              maxHeight: '90vh',
              overflowY: 'auto'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
              {editingActivity.id ? 'Edit Activity' : 'Add Activity'}
            </h3>

            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                Category
              </label>
              <select
                className="input"
                value={editingActivity.categoryId || ''}
                onChange={(e) => setEditingActivity({ ...editingActivity, categoryId: e.target.value })}
                style={{ width: '100%' }}
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                Activity Title
              </label>
              <input
                type="text"
                className="input"
                placeholder="e.g. C++ Programming, Mathematics, PCS"
                value={editingActivity.title || ''}
                onChange={(e) => setEditingActivity({ ...editingActivity, title: e.target.value })}
                style={{ width: '100%' }}
                autoFocus
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                Description (optional)
              </label>
              <input
                type="text"
                className="input"
                placeholder="Brief note on what to work on"
                value={editingActivity.description || ''}
                onChange={(e) => setEditingActivity({ ...editingActivity, description: e.target.value })}
                style={{ width: '100%' }}
              />
            </div>

            {/* Minimum Daily Minutes with Quick Chips */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
                  Minimum Daily Minutes
                </label>
                <span style={{ fontSize: '0.82rem', fontWeight: 800, fontFamily: 'var(--font-mono)', color: 'var(--lime-primary)' }}>
                  {editingActivity.minMinutes || 5} min
                </span>
              </div>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '8px' }}>
                {[5, 10, 15, 20, 25, 30, 45, 60].map((mins) => (
                  <button
                    key={mins}
                    type="button"
                    className="btn btn-sm"
                    style={{
                      padding: '4px 10px',
                      borderRadius: 'var(--radius-pill)',
                      background: editingActivity.minMinutes === mins ? 'var(--lime-primary)' : 'var(--bg-surface-subtle)',
                      color: editingActivity.minMinutes === mins ? 'var(--text-on-lime)' : 'var(--text-secondary)',
                      fontWeight: 700,
                      border: 'none',
                      fontSize: '0.78rem'
                    }}
                    onClick={() => setEditingActivity({ ...editingActivity, minMinutes: mins })}
                  >
                    {mins}m
                  </button>
                ))}
              </div>
            </div>

            {/* Recurrence Schedule */}
            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                Recurrence Schedule
              </label>
              <select
                className="input"
                value={editingActivity.recurrence?.type || 'daily'}
                onChange={(e) => {
                  const type = e.target.value as any;
                  setEditingActivity({
                    ...editingActivity,
                    recurrence: { type, daysOfWeek: type === 'custom' ? [1, 2, 3, 4, 5] : undefined }
                  });
                }}
                style={{ width: '100%' }}
              >
                <option value="daily">Daily (Every day)</option>
                <option value="weekdays">Weekdays Only (Monday – Friday)</option>
                <option value="weekends">Weekends Only (Saturday & Sunday)</option>
                <option value="custom">Custom Schedule</option>
              </select>

              {editingActivity.recurrence?.type === 'custom' && (
                <div style={{ display: 'flex', gap: '6px', marginTop: '10px' }}>
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((name, dayIndex) => {
                    const currentDays = editingActivity.recurrence?.daysOfWeek || [];
                    const isSelected = currentDays.includes(dayIndex);
                    return (
                      <button
                        key={name}
                        type="button"
                        style={{
                          flex: 1,
                          padding: '6px 0',
                          borderRadius: 'var(--radius-xs)',
                          background: isSelected ? 'var(--lime-primary)' : 'var(--bg-surface-subtle)',
                          color: isSelected ? 'var(--text-on-lime)' : 'var(--text-tertiary)',
                          fontWeight: 700,
                          fontSize: '0.75rem',
                          border: 'none',
                          cursor: 'pointer'
                        }}
                        onClick={() => {
                          const next = isSelected
                            ? currentDays.filter(d => d !== dayIndex)
                            : [...currentDays, dayIndex];
                          setEditingActivity({
                            ...editingActivity,
                            recurrence: { type: 'custom', daysOfWeek: next }
                          });
                        }}
                      >
                        {name}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '12px' }}>
              <button
                type="button"
                className="btn"
                onClick={() => setEditingActivity(null)}
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
                onClick={handleSaveActivity}
              >
                Save Activity
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

