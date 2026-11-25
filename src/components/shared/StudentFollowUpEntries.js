import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import { useStudentFollowUp } from '../../context/StudentFollowUpContext';
import { hasPermission } from '../../utils/rbac';
import {
  METHOD_OPTIONS,
  OUTCOME_OPTIONS,
  STATUS_OPTIONS,
  methodLabel,
  statusLabel,
  toDateTimeLocal,
  fromDateTimeLocal,
  formatDateTime,
  isOverdue,
  isDueTodayPending,
} from '../../utils/studentFollowUp';
import './StudentFollowUpEntries.css';

function nowSlot() {
  const d = new Date();
  d.setMinutes(Math.ceil(d.getMinutes() / 15) * 15, 0, 0);
  return toDateTimeLocal(d);
}

function defaultNextSlot() {
  const d = new Date();
  d.setDate(d.getDate() + 3);
  d.setHours(10, 0, 0, 0);
  return toDateTimeLocal(d);
}

function rowClass(row) {
  if (isOverdue(row)) return 'sfe-row-overdue';
  if (isDueTodayPending(row)) return 'sfe-row-today';
  return '';
}

function pillClass(row) {
  if (isOverdue(row)) return 'overdue';
  if (isDueTodayPending(row)) return 'today';
  return row.status;
}

function pillLabel(row) {
  if (isOverdue(row)) return 'Overdue';
  if (isDueTodayPending(row)) return 'Today';
  return statusLabel(row.status);
}

const EMPTY_EDIT = { scheduledAt: '', method: 'call', status: 'pending', notes: '', plannedNotes: '' };

export default function StudentFollowUpEntries({
  applicationId,
  standaloneInfo,
  initialEntries,
  initialMeta,
  compact = false,
  onChanged,
}) {
  const { user } = useAuth();
  const { refreshStats } = useStudentFollowUp();

  const hasInitial = Array.isArray(initialEntries);
  const [loading, setLoading] = useState(!hasInitial);
  const [entries, setEntries] = useState(initialEntries || []);
  const [meta, setMeta] = useState(initialMeta || null);

  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState({ ...EMPTY_EDIT, scheduledAt: nowSlot() });
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState(EMPTY_EDIT);
  const [completingId, setCompletingId] = useState(null);
  const [completeForm, setCompleteForm] = useState(null);
  const [saving, setSaving] = useState(false);

  const canCreate = hasPermission(user, 'studentFollowUp', 'create');
  const canEdit = hasPermission(user, 'studentFollowUp', 'edit');
  const canDelete = hasPermission(user, 'studentFollowUp', 'delete');

  const load = useCallback(async () => {
    if (!applicationId) return;
    setLoading(true);
    try {
      const res = await axios.get(`/student-follow-ups/application/${applicationId}`);
      setEntries(res.data.followUps || []);
      setMeta(res.data.application || null);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load follow-up history');
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, [applicationId]);

  useEffect(() => {
    if (hasInitial) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applicationId]);

  useEffect(() => {
    if (hasInitial) {
      setEntries(initialEntries || []);
      setMeta(initialMeta || null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialEntries, initialMeta]);

  const afterChange = useCallback(async () => {
    if (hasInitial) {
      if (onChanged) onChanged();
    } else {
      await load();
    }
    refreshStats();
  }, [hasInitial, onChanged, load, refreshStats]);

  const handleAdd = async () => {
    if (!addForm.scheduledAt) { toast.error('Pick a follow-up date and time'); return; }
    setSaving(true);
    try {
      const base = applicationId
        ? { application: applicationId }
        : {
          studentName: standaloneInfo?.studentName,
          country: standaloneInfo?.country,
          referredBy: standaloneInfo?.referredBy,
          providerName: standaloneInfo?.providerName,
          chainRoot: standaloneInfo?.chainRoot,
        };
      await axios.post('/student-follow-ups', {
        ...base,
        scheduledAt: fromDateTimeLocal(addForm.scheduledAt),
        method: addForm.method,
        status: addForm.status,
        notes: addForm.notes,
        plannedNotes: addForm.plannedNotes,
      });
      toast.success('Follow-up added');
      setAddForm({ ...EMPTY_EDIT, scheduledAt: nowSlot() });
      setShowAdd(false);
      await afterChange();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to add follow-up');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = async (id) => {
    if (!window.confirm('Cancel this follow-up? This does not schedule a next one.')) return;
    setSaving(true);
    try {
      await axios.post(`/student-follow-ups/${id}/cancel`, {});
      toast.success('Follow-up cancelled');
      await afterChange();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to cancel follow-up');
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (row) => {
    setCompletingId(null);
    setEditingId(row._id);
    setEditForm({
      scheduledAt: toDateTimeLocal(row.scheduledAt),
      method: row.method || 'call',
      status: row.status || 'pending',
      notes: row.notes || '',
      plannedNotes: row.plannedNotes || '',
    });
  };

  const handleSaveEdit = async (id) => {
    if (!editForm.scheduledAt) { toast.error('Pick a date and time'); return; }
    if (!window.confirm('Save changes to this follow-up?')) return;
    setSaving(true);
    try {
      await axios.put(`/student-follow-ups/${id}`, {
        scheduledAt: fromDateTimeLocal(editForm.scheduledAt),
        method: editForm.method,
        status: editForm.status,
        notes: editForm.notes,
        plannedNotes: editForm.plannedNotes,
      });
      toast.success('Follow-up updated');
      setEditingId(null);
      await afterChange();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update follow-up');
    } finally {
      setSaving(false);
    }
  };

  const startComplete = (row) => {
    setEditingId(null);
    setCompletingId(row._id);
    setCompleteForm({
      method: row.method || 'call',
      outcome: 'completed',
      notes: row.notes || '',
      scheduleNext: false,
      nextScheduledAt: defaultNextSlot(),
      nextMethod: row.method || 'call',
      nextNotes: '',
    });
  };

  const handleComplete = async (id) => {
    if (completeForm.scheduleNext && !completeForm.nextScheduledAt) {
      toast.error('Pick a date and time for the next follow-up');
      return;
    }
    setSaving(true);
    try {
      await axios.post(`/student-follow-ups/${id}/complete`, {
        method: completeForm.method,
        outcome: completeForm.outcome,
        notes: completeForm.notes,
        scheduleNext: completeForm.scheduleNext,
        nextScheduledAt: completeForm.scheduleNext ? fromDateTimeLocal(completeForm.nextScheduledAt) : null,
        nextMethod: completeForm.nextMethod,
        nextNotes: completeForm.nextNotes,
      });
      toast.success(completeForm.scheduleNext ? 'Completed — next follow-up scheduled' : 'Follow-up completed');
      setCompletingId(null);
      await afterChange();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to complete follow-up');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (row) => {
    if (!window.confirm('Move this follow-up to trash?')) return;
    try {
      await axios.delete(`/student-follow-ups/${row._id}`);
      toast.success('Moved to trash');
      await afterChange();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete');
    }
  };

  if (loading) {
    return <p className="sfe-muted">Loading follow-up history…</p>;
  }

  return (
    <div className={`sfe-root ${compact ? 'sfe-compact' : ''}`}>
      {!compact && meta && (
        <div className="sfe-meta">
          <span><b>Referred By:</b> {meta.referredBy || '—'}</span>
          <span><b>Provider:</b> {meta.providerName || '—'}</span>
        </div>
      )}

      <div className="sfe-toolbar">
        <span className="sfe-count">{entries.length} follow-up{entries.length === 1 ? '' : 's'}</span>
        {canCreate && (
          <button className="sfe-btn sfe-btn-primary" onClick={() => setShowAdd(v => !v)}>
            {showAdd ? 'Cancel' : '+ Add follow-up'}
          </button>
        )}
      </div>

      {showAdd && (
        <div className="sfe-form-card">
          <div className="sfe-form-grid">
            <label>
              <span>Date &amp; time *</span>
              <input
                type="datetime-local"
                value={addForm.scheduledAt}
                onChange={e => setAddForm(f => ({ ...f, scheduledAt: e.target.value }))}
              />
            </label>
            <label>
              <span>Method</span>
              <select value={addForm.method} onChange={e => setAddForm(f => ({ ...f, method: e.target.value }))}>
                {METHOD_OPTIONS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </label>
            <label>
              <span>Status</span>
              <select value={addForm.status} onChange={e => setAddForm(f => ({ ...f, status: e.target.value }))}>
                <option value="pending">Pending (scheduled)</option>
                <option value="completed">Already completed</option>
                <option value="no_response">No response</option>
              </select>
            </label>
            <label className="sfe-span-2">
              <span>{addForm.status === 'pending' ? 'What to do / talk about' : 'What happened'}</span>
              <textarea
                rows={2}
                value={addForm.status === 'pending' ? addForm.plannedNotes : addForm.notes}
                onChange={e => setAddForm(f => (
                  f.status === 'pending' ? { ...f, plannedNotes: e.target.value } : { ...f, notes: e.target.value }
                ))}
                placeholder={addForm.status === 'pending' ? 'e.g. Ask for bank statements' : 'e.g. Called, documents received'}
              />
            </label>
          </div>
          <div className="sfe-actions">
            <button className="sfe-btn sfe-btn-ghost" onClick={() => setShowAdd(false)} disabled={saving}>Cancel</button>
            <button className="sfe-btn sfe-btn-primary" onClick={handleAdd} disabled={saving}>
              {saving ? 'Saving…' : 'Add follow-up'}
            </button>
          </div>
        </div>
      )}

      {entries.length === 0 ? (
        <p className="sfe-muted">No follow-ups recorded yet.</p>
      ) : (
        <div className="sfe-table-scroll">
          <table className="sfe-table">
            <thead>
              <tr>
                <th>Date &amp; Time</th>
                <th>Method</th>
                <th>Notes</th>
                <th>Status</th>
                <th>By</th>
                <th className="sfe-actions-col" />
              </tr>
            </thead>
            <tbody>
              {entries.map(row => (
                <React.Fragment key={row._id}>
                  <tr className={rowClass(row)}>
                    <td className="sfe-nowrap">{formatDateTime(row.scheduledAt)}</td>
                    <td>{methodLabel(row.method)}</td>
                    <td className="sfe-notes-cell">{row.notes || row.plannedNotes || '—'}</td>
                    <td><span className={`sfe-pill sfe-pill-${pillClass(row)}`}>{pillLabel(row)}</span></td>
                    <td>{row.completedBy?.name || row.completedBy?.username || row.createdBy?.name || row.createdBy?.username || '—'}</td>
                    <td className="sfe-row-actions">
                      {row.status === 'pending' && canEdit && (
                        <button className="sfe-link" onClick={() => startComplete(row)}>Complete</button>
                      )}
                      {row.status === 'pending' && canEdit && (
                        <button className="sfe-link sfe-link-danger" onClick={() => handleCancel(row._id)} disabled={saving}>Cancel</button>
                      )}
                      {canEdit && (
                        <button className="sfe-link" onClick={() => startEdit(row)}>Edit</button>
                      )}
                      {canDelete && (
                        <button className="sfe-link sfe-link-danger" onClick={() => handleDelete(row)}>Delete</button>
                      )}
                    </td>
                  </tr>

                  {editingId === row._id && (
                    <tr className="sfe-inline-form-row">
                      <td colSpan={6}>
                        <div className="sfe-form-grid">
                          <label>
                            <span>Date &amp; time</span>
                            <input
                              type="datetime-local"
                              value={editForm.scheduledAt}
                              onChange={e => setEditForm(f => ({ ...f, scheduledAt: e.target.value }))}
                            />
                          </label>
                          <label>
                            <span>Method</span>
                            <select value={editForm.method} onChange={e => setEditForm(f => ({ ...f, method: e.target.value }))}>
                              {METHOD_OPTIONS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                            </select>
                          </label>
                          <label>
                            <span>Status</span>
                            <select value={editForm.status} onChange={e => setEditForm(f => ({ ...f, status: e.target.value }))}>
                              {STATUS_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                            </select>
                          </label>
                          <label className="sfe-span-2">
                            <span>Notes</span>
                            <textarea
                              rows={2}
                              value={editForm.notes}
                              onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))}
                            />
                          </label>
                          <label className="sfe-span-2">
                            <span>Planned / next-step notes</span>
                            <textarea
                              rows={2}
                              value={editForm.plannedNotes}
                              onChange={e => setEditForm(f => ({ ...f, plannedNotes: e.target.value }))}
                            />
                          </label>
                        </div>
                        <div className="sfe-actions">
                          <button className="sfe-btn sfe-btn-ghost" onClick={() => setEditingId(null)} disabled={saving}>Cancel</button>
                          <button className="sfe-btn sfe-btn-primary" onClick={() => handleSaveEdit(row._id)} disabled={saving}>
                            {saving ? 'Saving…' : 'Save changes'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  )}

                  {completingId === row._id && completeForm && (
                    <tr className="sfe-inline-form-row">
                      <td colSpan={6}>
                        <fieldset className="sfe-fieldset">
                          <legend>Complete this follow-up</legend>
                          <div className="sfe-form-grid">
                            <label>
                              <span>Method used</span>
                              <select value={completeForm.method} onChange={e => setCompleteForm(f => ({ ...f, method: e.target.value }))}>
                                {METHOD_OPTIONS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                              </select>
                            </label>
                            <label>
                              <span>Outcome</span>
                              <select value={completeForm.outcome} onChange={e => setCompleteForm(f => ({ ...f, outcome: e.target.value }))}>
                                {OUTCOME_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                              </select>
                            </label>
                            <label className="sfe-span-2">
                              <span>What happened</span>
                              <textarea
                                rows={2}
                                value={completeForm.notes}
                                onChange={e => setCompleteForm(f => ({ ...f, notes: e.target.value }))}
                              />
                            </label>
                          </div>
                        </fieldset>
                        <fieldset className="sfe-fieldset">
                          <legend>
                            <label className="sfe-check">
                              <input
                                type="checkbox"
                                checked={completeForm.scheduleNext}
                                onChange={e => setCompleteForm(f => ({ ...f, scheduleNext: e.target.checked }))}
                              />
                              Also schedule a next follow-up
                            </label>
                          </legend>
                          {completeForm.scheduleNext && (
                            <div className="sfe-form-grid">
                              <label>
                                <span>Next date &amp; time *</span>
                                <input
                                  type="datetime-local"
                                  value={completeForm.nextScheduledAt}
                                  onChange={e => setCompleteForm(f => ({ ...f, nextScheduledAt: e.target.value }))}
                                />
                              </label>
                              <label>
                                <span>Method</span>
                                <select value={completeForm.nextMethod} onChange={e => setCompleteForm(f => ({ ...f, nextMethod: e.target.value }))}>
                                  {METHOD_OPTIONS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                                </select>
                              </label>
                              <label className="sfe-span-2">
                                <span>What to do next</span>
                                <textarea
                                  rows={2}
                                  value={completeForm.nextNotes}
                                  onChange={e => setCompleteForm(f => ({ ...f, nextNotes: e.target.value }))}
                                />
                              </label>
                            </div>
                          )}
                        </fieldset>
                        <div className="sfe-actions">
                          <button className="sfe-btn sfe-btn-ghost" onClick={() => setCompletingId(null)} disabled={saving}>Cancel</button>
                          <button className="sfe-btn sfe-btn-primary" onClick={() => handleComplete(row._id)} disabled={saving}>
                            {saving ? 'Saving…' : completeForm.scheduleNext ? 'Complete & Schedule Next' : 'Complete follow-up'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
