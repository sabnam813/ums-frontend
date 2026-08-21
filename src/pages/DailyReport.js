import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { format, parseISO, isValid } from 'date-fns';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { useAuth } from '../context/AuthContext';
import { isAdmin, isSuperAdmin } from '../utils/permissions';
import { FISCAL_YEARS, getFiscalYearRange } from '../utils/fiscalYear';
import { useFiscalYear } from '../context/FiscalYearContext';
import { toastExcel, toastPDF } from '../utils/exportHelpers';
import './DailyReport.css';

const EXPORT_TIMESTAMP = () => format(new Date(), 'yyyy-MM-dd');

// Regular staff can only add/edit a report dated within this many days before
// today (inclusive). Must match EDIT_GRACE_DAYS in backend routes/dailyReport.js.
const EDIT_GRACE_DAYS = 2;

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function minAllowedISO() {
  const d = new Date();
  d.setDate(d.getDate() - EDIT_GRACE_DAYS);
  return d.toISOString().slice(0, 10);
}

function prettyDate(iso) {
  try {
    const parsed = parseISO(iso);
    if (!isValid(parsed)) return iso;
    return format(parsed, 'EEEE, d MMMM yyyy');
  } catch { return iso; }
}

function UserReportForm({ onSaved }) {
  const { user } = useAuth();
  const [selectedDate, setSelectedDate] = useState(todayISO());
  const [points, setPoints] = useState([]);
  const [newPoint, setNewPoint] = useState('');
  const [editingIdx, setEditingIdx] = useState(null);
  const [editText, setEditText] = useState('');
  const [existingEntry, setExistingEntry] = useState(null);
  const [loadingEntry, setLoadingEntry] = useState(false);
  const [saving, setSaving] = useState(false);
  const [addMode, setAddMode] = useState('point');
  const [pasteText, setPasteText] = useState('');
  const newInputRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    setLoadingEntry(true);
    setExistingEntry(null);
    setPoints([]);
    setNewPoint('');
    setPasteText('');
    setEditingIdx(null);
    axios.get('/daily-report', { params: { dateFrom: selectedDate, dateTo: selectedDate } })
      .then(res => {
        if (cancelled) return;
        const mine = (res.data.entries || []).find(e => String(e.user?._id || e.user) === String(user?._id));
        if (mine) { setExistingEntry(mine); setPoints(mine.points || []); }
        else { setExistingEntry(null); setPoints([]); }
      })
      .catch(() => { if (!cancelled) { setExistingEntry(null); setPoints([]); } })
      .finally(() => { if (!cancelled) setLoadingEntry(false); });
    return () => { cancelled = true; };
  }, [selectedDate, user?._id]);

  const addPoint = () => {
    const trimmed = newPoint.trim();
    if (!trimmed) return;
    setPoints(prev => [...prev, trimmed]);
    setNewPoint('');
    newInputRef.current?.focus();
  };

  const handleNewKeyDown = (e) => {
    if (e.key === 'Enter') { e.preventDefault(); addPoint(); }
  };

  const addPointsFromPaste = () => {
    const lines = pasteText.split('\n').map(l => l.trim()).filter(Boolean);
    if (lines.length === 0) return;
    setPoints(prev => [...prev, ...lines]);
    setPasteText('');
  };

  const deletePoint = (idx) => {
    setPoints(prev => prev.filter((_, i) => i !== idx));
    if (editingIdx === idx) setEditingIdx(null);
  };

  const startEdit = (idx) => {
    setEditingIdx(idx);
    setEditText(points[idx]);
  };

  const commitEdit = (idx) => {
    const trimmed = editText.trim();
    if (!trimmed) { deletePoint(idx); setEditingIdx(null); return; }
    setPoints(prev => prev.map((p, i) => i === idx ? trimmed : p));
    setEditingIdx(null);
  };

  const handleEditKeyDown = (e, idx) => {
    if (e.key === 'Enter') { e.preventDefault(); commitEdit(idx); }
    if (e.key === 'Escape') { setEditingIdx(null); setEditText(''); }
  };

  const doSave = useCallback(async () => {
    if (points.length === 0) { toast.error('Add at least one point before saving'); return; }
    setSaving(true);
    try {
      let res;
      if (existingEntry) {
        res = await axios.put(`/daily-report/${existingEntry._id}`, { points });
      } else {
        res = await axios.post('/daily-report', { date: selectedDate, points });
      }
      setExistingEntry(res.data.entry);
      setPoints(res.data.entry.points || []);
      toast.success(existingEntry ? 'Report updated' : 'Report saved');
      if (onSaved) onSaved();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save report');
    } finally {
      setSaving(false);
    }
  }, [existingEntry, selectedDate, points, onSaved]);

  const isToday = selectedDate === todayISO();

  return (
    <div className="dr-write-card">
      {}
      <div className="dr-write-topbar">
        <div className="dr-date-row">
          <span className="dr-date-label-pretty">{prettyDate(selectedDate)}</span>
          {isToday ? <span className="dr-today-badge">Today</span> : <span className="dr-late-badge">Late entry</span>}
        </div>
        <div className="dr-write-meta-right">
          {existingEntry && (
            <span className="dr-saved-at">
              Last saved {existingEntry.updatedAt ? format(parseISO(existingEntry.updatedAt), 'h:mm a') : ''}
            </span>
          )}
        </div>
      </div>

      <div className="dr-date-picker-row">
        <label className="dr-date-change-label">Change date:</label>
        <input type="date" className="dr-date-input" value={selectedDate} min={minAllowedISO()} max={todayISO()} onChange={e => setSelectedDate(e.target.value)} />
      </div>
      {selectedDate !== todayISO() && (
        <p className="dr-window-hint">You can add or edit reports for today and the last {EDIT_GRACE_DAYS} days only. For older dates, ask a Super Admin.</p>
      )}

      {loadingEntry ? (
        <div className="dr-write-loading"><div className="dr-spinner-sm" /> Loading…</div>
      ) : (
        <>
          {}
          {points.length > 0 && (
            <ol className="dr-points-list">
              {points.map((pt, idx) => (
                <li key={idx} className="dr-point-item">
                  {editingIdx === idx ? (
                    <div className="dr-point-edit-row">
                      <input
                        className="dr-point-edit-input"
                        value={editText}
                        onChange={e => setEditText(e.target.value)}
                        onKeyDown={e => handleEditKeyDown(e, idx)}
                        autoFocus
                      />
                      <button className="dr-point-action save" onClick={() => commitEdit(idx)} title="Save">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                      </button>
                      <button className="dr-point-action cancel" onClick={() => setEditingIdx(null)} title="Cancel">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                      </button>
                    </div>
                  ) : (
                    <div className="dr-point-view-row">
                      <span className="dr-point-text">{pt}</span>
                      <div className="dr-point-btns">
                        <button className="dr-point-action edit" onClick={() => startEdit(idx)} title="Edit point">
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                        </button>
                        <button className="dr-point-action delete" onClick={() => deletePoint(idx)} title="Remove point">
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                        </button>
                      </div>
                    </div>
                  )}
                </li>
              ))}
            </ol>
          )}

          {}
          <div className="dr-add-mode-toggle">
            <button
              type="button"
              className={`dr-add-mode-btn ${addMode === 'point' ? 'active' : ''}`}
              onClick={() => setAddMode('point')}
            >
              Add point by point
            </button>
            <button
              type="button"
              className={`dr-add-mode-btn ${addMode === 'paste' ? 'active' : ''}`}
              onClick={() => setAddMode('paste')}
            >
              Paste multiple lines
            </button>
          </div>

          {addMode === 'point' ? (
            <div className="dr-add-point-row">
              <input
                ref={newInputRef}
                className="dr-add-point-input"
                placeholder={points.length === 0 ? `What did you work on ${isToday ? 'today' : 'that day'}? (Press Enter to add)` : 'Add another point… (Enter to add)'}
                value={newPoint}
                onChange={e => setNewPoint(e.target.value)}
                onKeyDown={handleNewKeyDown}
              />
              <button className="dr-add-point-btn" onClick={addPoint} disabled={!newPoint.trim()} title="Add point">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                Add
              </button>
            </div>
          ) : (
            <div className="dr-paste-box-wrap">
              <textarea
                className="dr-paste-box"
                placeholder="Paste or write several lines here — each line becomes its own point."
                value={pasteText}
                onChange={e => setPasteText(e.target.value)}
                rows={5}
              />
              <div className="dr-paste-box-footer">
                <span className="dr-paste-box-hint">Each line will be added as a separate, numbered point.</span>
                <button
                  type="button"
                  className="dr-add-point-btn"
                  onClick={addPointsFromPaste}
                  disabled={!pasteText.trim()}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                  Add lines as points
                </button>
              </div>
            </div>
          )}

          <div className="dr-write-footer">
            <span className="dr-line-count">
              {points.length > 0 ? `${points.length} point${points.length !== 1 ? 's' : ''}` : 'No points yet'}
            </span>
            <button className="dr-save-btn" onClick={doSave} disabled={saving || points.length === 0}>
              {saving ? 'Saving…' : existingEntry ? 'Update Report' : 'Save Report'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function ReportCard({ entry, viewerIsSuperAdmin, isOwnReport, onDelete, onEdit }) {
  const [showFeedbackForm, setShowFeedbackForm] = useState(false);
  const [feedbackDraft, setFeedbackDraft] = useState(entry.feedback || '');
  const [savingFeedback, setSavingFeedback] = useState(false);

  const [editMode, setEditMode] = useState(false);
  const [editPoints, setEditPoints] = useState([]);
  const [editNewPoint, setEditNewPoint] = useState('');
  const [editingPointIdx, setEditingPointIdx] = useState(null);
  const [editPointText, setEditPointText] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);
  const [editAddMode, setEditAddMode] = useState('point');
  const [editPasteText, setEditPasteText] = useState('');
  const editNewRef = useRef(null);

  const openEdit = () => {
    setEditPoints([...(entry.points || [])]);
    setEditNewPoint('');
    setEditPasteText('');
    setEditAddMode('point');
    setEditingPointIdx(null);
    setEditMode(true);
  };

  const cancelEdit = () => { setEditMode(false); setEditPoints([]); setEditNewPoint(''); setEditPasteText(''); };

  const addEditPoint = () => {
    const t = editNewPoint.trim();
    if (!t) return;
    setEditPoints(prev => [...prev, t]);
    setEditNewPoint('');
    editNewRef.current?.focus();
  };

  const addEditPointsFromPaste = () => {
    const lines = editPasteText.split('\n').map(l => l.trim()).filter(Boolean);
    if (lines.length === 0) return;
    setEditPoints(prev => [...prev, ...lines]);
    setEditPasteText('');
  };

  const deleteEditPoint = (idx) => {
    setEditPoints(prev => prev.filter((_, i) => i !== idx));
    if (editingPointIdx === idx) setEditingPointIdx(null);
  };

  const startEditPoint = (idx) => { setEditingPointIdx(idx); setEditPointText(editPoints[idx]); };

  const commitEditPoint = (idx) => {
    const t = editPointText.trim();
    if (!t) { deleteEditPoint(idx); setEditingPointIdx(null); return; }
    setEditPoints(prev => prev.map((p, i) => i === idx ? t : p));
    setEditingPointIdx(null);
  };

  const saveEdit = async () => {
    const final = editPoints.filter(Boolean);
    if (final.length === 0) { toast.error('Add at least one point'); return; }
    setSavingEdit(true);
    try {
      const res = await axios.put(`/daily-report/${entry._id}`, { points: final });
      toast.success('Report updated');
      if (onEdit) onEdit(res.data.entry);
      setEditMode(false);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update report');
    } finally {
      setSavingEdit(false);
    }
  };

  const handleSaveFeedback = async () => {
    setSavingFeedback(true);
    try {
      const res = await axios.put(`/daily-report/${entry._id}/feedback`, { feedback: feedbackDraft.trim() });
      toast.success('Feedback saved');
      if (onEdit) onEdit(res.data.entry);
      setShowFeedbackForm(false);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save feedback');
    } finally {
      setSavingFeedback(false);
    }
  };

  return (
    <div className="dr-report-card">
      <div className="dr-report-card-head">
        <span className="dr-report-card-date">{prettyDate(entry.date)}</span>
        <div className="dr-report-card-meta">
          {entry.user?.name && (
            <span className="dr-report-card-user">
              {entry.user.name}
              <span className="dr-username-muted"> @{entry.user.username}</span>
            </span>
          )}
          {entry.department && (
            <span className="dr-dept-badge">{entry.department}</span>
          )}
        </div>
      </div>

      {}
      {editMode ? (
        <div className="dr-inline-edit">
          {editPoints.length > 0 && (
            <ol className="dr-points-list">
              {editPoints.map((pt, idx) => (
                <li key={idx} className="dr-point-item">
                  {editingPointIdx === idx ? (
                    <div className="dr-point-edit-row">
                      <input
                        className="dr-point-edit-input"
                        value={editPointText}
                        onChange={e => setEditPointText(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); commitEditPoint(idx); } if (e.key === 'Escape') setEditingPointIdx(null); }}
                        autoFocus
                      />
                      <button className="dr-point-action save" onClick={() => commitEditPoint(idx)} title="Save">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                      </button>
                      <button className="dr-point-action cancel" onClick={() => setEditingPointIdx(null)} title="Cancel">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                      </button>
                    </div>
                  ) : (
                    <div className="dr-point-view-row">
                      <span className="dr-point-text">{pt}</span>
                      <div className="dr-point-btns">
                        <button className="dr-point-action edit" onClick={() => startEditPoint(idx)} title="Edit">
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                        </button>
                        <button className="dr-point-action delete" onClick={() => deleteEditPoint(idx)} title="Delete">
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                        </button>
                      </div>
                    </div>
                  )}
                </li>
              ))}
            </ol>
          )}
          <div className="dr-add-mode-toggle">
            <button
              type="button"
              className={`dr-add-mode-btn ${editAddMode === 'point' ? 'active' : ''}`}
              onClick={() => setEditAddMode('point')}
            >
              Add point by point
            </button>
            <button
              type="button"
              className={`dr-add-mode-btn ${editAddMode === 'paste' ? 'active' : ''}`}
              onClick={() => setEditAddMode('paste')}
            >
              Paste multiple lines
            </button>
          </div>

          {editAddMode === 'point' ? (
            <div className="dr-add-point-row">
              <input
                ref={editNewRef}
                className="dr-add-point-input"
                placeholder="Add another point… (Enter)"
                value={editNewPoint}
                onChange={e => setEditNewPoint(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addEditPoint(); } }}
              />
              <button className="dr-add-point-btn" onClick={addEditPoint} disabled={!editNewPoint.trim()}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                Add
              </button>
            </div>
          ) : (
            <div className="dr-paste-box-wrap">
              <textarea
                className="dr-paste-box"
                placeholder="Paste or write several lines here — each line becomes its own point."
                value={editPasteText}
                onChange={e => setEditPasteText(e.target.value)}
                rows={4}
              />
              <div className="dr-paste-box-footer">
                <span className="dr-paste-box-hint">Each line will be added as a separate, numbered point.</span>
                <button
                  type="button"
                  className="dr-add-point-btn"
                  onClick={addEditPointsFromPaste}
                  disabled={!editPasteText.trim()}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                  Add lines as points
                </button>
              </div>
            </div>
          )}
          <div className="dr-inline-edit-actions">
            <span className="dr-line-count">{editPoints.length} point{editPoints.length !== 1 ? 's' : ''}</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="dr-btn-ghost" onClick={cancelEdit}>Cancel</button>
              <button className="dr-btn-primary" onClick={saveEdit} disabled={savingEdit}>
                {savingEdit ? 'Saving…' : 'Save changes'}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <ol className="dr-report-points">
          {(entry.points || []).map((pt, i) => (
            <li key={i} className="dr-report-point">{pt}</li>
          ))}
          {(!entry.points || entry.points.length === 0) && (
            <li className="dr-report-point dr-point-empty">No points recorded</li>
          )}
        </ol>
      )}

      {}
      {viewerIsSuperAdmin && (
        <div className="dr-feedback-block">
          {showFeedbackForm ? (
            <>
              <label className="dr-feedback-label">
                Feedback for {entry.user?.name || entry.user?.username}
              </label>
              <textarea
                className="dr-feedback-textarea"
                placeholder="Write your feedback…"
                value={feedbackDraft}
                onChange={e => setFeedbackDraft(e.target.value)}
                maxLength={4000}
                rows={3}
              />
              <div className="dr-feedback-actions">
                {entry.feedbackAt && (
                  <span className="dr-char-count">
                    Last updated {format(parseISO(entry.feedbackAt), 'PPP')}
                  </span>
                )}
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="dr-btn-ghost" onClick={() => { setShowFeedbackForm(false); setFeedbackDraft(entry.feedback || ''); }}>
                    Cancel
                  </button>
                  <button className="dr-btn-primary" onClick={handleSaveFeedback} disabled={savingFeedback}>
                    {savingFeedback ? 'Saving…' : 'Save'}
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="dr-feedback-view">
              {entry.feedback ? (
                <p className="dr-feedback-text">{entry.feedback}</p>
              ) : (
                <span className="dr-feedback-empty">No feedback yet</span>
              )}
              <button className="dr-link-btn" onClick={() => { setFeedbackDraft(entry.feedback || ''); setShowFeedbackForm(true); }}>
                {entry.feedback ? 'Edit feedback' : '+ Add feedback'}
              </button>
            </div>
          )}
        </div>
      )}

      {}
      {!viewerIsSuperAdmin && isOwnReport && entry.feedback && (
        <div className="dr-feedback-block dr-feedback-readonly">
          <label className="dr-feedback-label">Feedback from Super Admin</label>
          <p className="dr-feedback-text">{entry.feedback}</p>
          {entry.feedbackAt && (
            <span className="dr-char-count">{format(parseISO(entry.feedbackAt), 'PPP')}</span>
          )}
        </div>
      )}

      {(isOwnReport || viewerIsSuperAdmin) && (
        <div className="dr-report-card-actions">
          {isOwnReport && !editMode && (
            <button className="dr-link-btn" onClick={openEdit}>
              Edit points
            </button>
          )}
          {onDelete && (
            <button className="dr-link-btn dr-danger-link" onClick={() => onDelete(entry._id)}>
              Delete
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default function DailyReport() {
  const { user } = useAuth();
  const privileged = isAdmin(user);
  const viewerIsSuperAdmin = isSuperAdmin(user);
  const isRegularUser = user?.role === 'user';
  const { fiscalYear: globalFY, setFiscalYear: setGlobalFY } = useFiscalYear();

  const [fiscalYear, setFiscalYear] = useState(globalFY);
  const [dateFrom, setDateFrom] = useState(todayISO);
  const [dateTo, setDateTo] = useState(todayISO);
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState('');
  const [selectedDept, setSelectedDept] = useState('');
  const [entries, setEntries] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [error, setError] = useState('');
  const [refreshTick, setRefreshTick] = useState(0);

  useEffect(() => {
    if (!privileged) return;
    axios.get('/daily-report/users')
      .then(res => setUsers(res.data.users || []))
      .catch(() => setUsers([]));
  }, [privileged]);

  const fetchHistory = useCallback(async () => {
    setLoadingHistory(true);
    setError('');
    try {
      const params = { dateFrom, dateTo };
      if (privileged && selectedUser) params.user = selectedUser;
      if (privileged && selectedDept) params.department = selectedDept;
      const res = await axios.get('/daily-report', { params });
      setEntries(res.data.entries || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load reports');
      setEntries([]);
    } finally {
      setLoadingHistory(false);
    }
  }, [dateFrom, dateTo, selectedUser, selectedDept, privileged]);

  useEffect(() => { fetchHistory(); }, [fetchHistory, refreshTick]);

  const handleDelete = async (entryId) => {
    if (!window.confirm('Delete this daily report? This cannot be undone.')) return;
    try {
      await axios.delete(`/daily-report/${entryId}`);
      setEntries(prev => prev.filter(e => e._id !== entryId));
      toast.success('Report deleted');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete report');
    }
  };

  const handleEntryUpdate = (updated) => {
    setEntries(prev => prev.map(e => e._id === updated._id ? updated : e));
  };

  const filterLines = useMemo(() => {
    const lines = [`Date Range: ${dateFrom} to ${dateTo}`];
    if (privileged && selectedUser) {
      const u = users.find(x => x._id === selectedUser);
      if (u) lines.push(`User: ${u.name ? `${u.name} (${u.username})` : u.username}`);
    }
    if (privileged && selectedDept) lines.push(`Department: ${selectedDept}`);
    return lines;
  }, [dateFrom, dateTo, privileged, selectedUser, selectedDept, users]);

  const exportRows = () => entries.map(e => ({
    date: prettyDate(e.date),
    user: e.user?.name ? `${e.user.name} (${e.user.username})` : (e.user?.username || '—'),
    department: e.department || '—',
    pointsArr: e.points || [],
    pointsPdf: (e.points || []).length
      ? (e.points || []).map((p, i) => `${i + 1}. ${p}`).join('\n')
      : 'No tasks recorded',
    pointsExcel: (e.points || []).length
      ? (e.points || []).map((p, i) => `${i + 1}. ${p}`).join('\n')
      : 'No tasks recorded',
    pointsHtml: (e.points || []).length
      ? `<ol style="margin:0;padding-left:16px">${(e.points || []).map(p => `<li>${p}</li>`).join('')}</ol>`
      : '<span style="color:#999">No tasks recorded</span>',
    feedback: e.feedback || '',
  }));

  const exportDailyReportExcel = () => {
    if (!entries.length) { toast.error('No reports to export'); return; }
    const rows = exportRows();
    const headerRowIndex = 4 + filterLines.length;
    const header = ['Date', 'User', 'Department', 'Tasks', 'Feedback'];
    const aoa = [
      ['UCA Management System: Daily Report'],
      ...filterLines.map(l => [l]),
      [`Generated: ${format(new Date(), 'PPP p')}`],
      [],
      header,
      ...rows.map(r => [r.date, r.user, r.department, r.pointsExcel, r.feedback]),
    ];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const dataStartRow = headerRowIndex + 1;
    rows.forEach((_, i) => {
      const cellAddr = `D${dataStartRow + i + 1}`;
      if (ws[cellAddr]) {
        ws[cellAddr].s = { alignment: { wrapText: true, vertical: 'top' } };
      }
    });
    ws['!cols'] = [
      { wch: 26 },
      { wch: 28 },
      { wch: 20 },
      { wch: 60 },
      { wch: 40 },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Daily Report');
    XLSX.writeFile(wb, `UMS_Daily_Report_${EXPORT_TIMESTAMP()}.xlsx`);
    toastExcel();
  };

  const exportDailyReportPDF = () => {
    if (!entries.length) { toast.error('No reports to export'); return; }
    const rows = exportRows();
    const doc = new jsPDF({ orientation: 'landscape' });
    doc.setFontSize(14);
    doc.text('UCA Management System: Daily Report', 14, 16);
    doc.setFontSize(9);
    let y = 23;
    filterLines.forEach(line => { doc.text(line, 14, y); y += 5; });
    doc.text(`Generated: ${format(new Date(), 'PPP p')}`, 14, y);
    y += 4;
    doc.autoTable({
      startY: y + 3,
      head: [['Date', 'User', 'Department', 'Tasks', 'Feedback']],
      body: rows.map(r => [r.date, r.user, r.department, r.pointsPdf, r.feedback]),
      styles: { fontSize: 8, cellPadding: 3, overflow: 'linebreak', valign: 'top' },
      headStyles: { fillColor: [46, 79, 143], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [245, 248, 255] },
      columnStyles: {
        0: { cellWidth: 32 },
        1: { cellWidth: 38 },
        2: { cellWidth: 28 },
        3: { cellWidth: 100 },
        4: { cellWidth: 60 },
      },
      margin: { left: 8, right: 8 },
    });
    doc.save(`UMS_Daily_Report_${EXPORT_TIMESTAMP()}.pdf`);
    toastPDF();
  };

  const printDailyReport = () => {
    if (!entries.length) { toast.error('No reports to export'); return; }
    const rows = exportRows();
    const rowsHtml = rows.map(r =>
      `<tr><td>${r.date}</td><td>${r.user}</td><td>${r.department}</td><td>${r.pointsHtml}</td><td>${r.feedback || ''}</td></tr>`
    ).join('');
    const printHtml = `<!DOCTYPE html>
<html><head><title>Daily Report</title>
<style>
@page { size: A4 landscape; margin: 10mm; }
* { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
body { font-family: Arial, sans-serif; font-size: 10px; margin: 0; color: #000; }
h2 { margin: 0 0 6px; font-size: 15px; }
p { margin: 0 0 4px; color: #444; font-size: 10px; }
table { border-collapse: collapse; width: 100%; margin-top: 10px; table-layout: fixed; }
col.col-date { width: 14%; }
col.col-user { width: 16%; }
col.col-dept { width: 12%; }
col.col-tasks { width: 38%; }
col.col-feedback { width: 20%; }
th, td { border: 1px solid #ccc; padding: 5px 6px; text-align: left; vertical-align: top; word-wrap: break-word; }
th { background: #e8eef8; font-weight: 700; color: #1e3a6e; }
tr:nth-child(even) { background: #f5f8ff; }
ol { margin: 0; padding-left: 18px; }
ol li { margin-bottom: 2px; }
</style></head><body>
<h2>UCA Management System: Daily Report</h2>
${filterLines.map(l => `<p>${l}</p>`).join('')}
<p>Generated: ${new Date().toLocaleString()}</p>
<table>
  <colgroup>
    <col class="col-date"><col class="col-user"><col class="col-dept">
    <col class="col-tasks"><col class="col-feedback">
  </colgroup>
  <thead><tr><th>Date</th><th>User</th><th>Department</th><th>Tasks</th><th>Feedback</th></tr></thead>
  <tbody>${rowsHtml}</tbody>
</table>
</body></html>`;
    const win = window.open('', '_blank');
    win.document.write(printHtml);
    win.document.close();
    win.onload = () => { win.focus(); win.print(); };
    win.onafterprint = () => win.close();
  };

  return (
    <div className="dr-root animate-fade">
      {}
      <div className="dr-header">
        <div>
          <h2>Daily Report</h2>
          <p>
            {isRegularUser
              ? `Write what you worked on today. You can also add or edit reports for the last ${EDIT_GRACE_DAYS} days.`
              : privileged && !viewerIsSuperAdmin
                ? 'View your team\'s daily reports.'
                : 'Review team reports and leave feedback.'}
          </p>
        </div>
        {isRegularUser && user?.department && (
          <span className="dr-dept-badge">{user.department}</span>
        )}
      </div>

      {}
      {isRegularUser && (
        <UserReportForm onSaved={() => setRefreshTick(t => t + 1)} />
      )}

      {}
      <div className="dr-history-header">
        <h3>{privileged ? 'All Reports' : 'Your Reports'}</h3>
        <div className="dr-export-group">
          <button className="dr-export-btn" onClick={exportDailyReportExcel}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>
            Excel
          </button>
          <button className="dr-export-btn" onClick={exportDailyReportPDF}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /></svg>
            PDF
          </button>
          <button className="dr-export-btn" onClick={printDailyReport}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 6 2 18 2 18 9" /><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" /><rect x="6" y="14" width="12" height="8" /></svg>
            Print
          </button>
        </div>
      </div>

      {}
      <div className="dr-filters">
        <div className="dr-field">
          <label>Fiscal Year (B.S.)</label>
          <select
            value={fiscalYear}
            onChange={e => {
              const fy = e.target.value;
              const { from, to } = getFiscalYearRange(fy);
              setGlobalFY(fy);
              setFiscalYear(fy);
              if (fy !== 'all') { setDateFrom(from); setDateTo(to); }
            }}
          >
            <option value="all">All</option>
            {FISCAL_YEARS.map(fy => <option key={fy.label} value={fy.label}>{fy.label}</option>)}
          </select>
        </div>
        <div className="dr-field">
          <label>From</label>
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} max={dateTo} />
        </div>
        <div className="dr-field">
          <label>To</label>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} min={dateFrom} max={todayISO()} />
        </div>
        {privileged && (
          <div className="dr-field">
            <label>User</label>
            <select value={selectedUser} onChange={e => setSelectedUser(e.target.value)}>
              <option value="">All users</option>
              {users.map(u => (
                <option key={u._id} value={u._id}>
                  {u.name ? `${u.name} (${u.username})` : u.username}
                </option>
              ))}
            </select>
          </div>
        )}
        {privileged && (
          <div className="dr-field">
            <label>Department</label>
            <input type="text" placeholder="e.g. IT, HR…" value={selectedDept} onChange={e => setSelectedDept(e.target.value)} />
          </div>
        )}
        <button className="dr-search-btn" onClick={fetchHistory}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
          </svg>
          Search
        </button>
      </div>

      {}
      {loadingHistory ? (
        <div className="dr-loading"><div className="dr-spinner" /><p>Loading…</p></div>
      ) : error ? (
        <div className="dr-empty-state"><p>{error}</p></div>
      ) : !entries.length ? (
        <div className="dr-empty-state">
          <p>No reports for this period{privileged && selectedUser ? ' for the selected user' : ''}.</p>
          {isRegularUser && <p className="dr-empty-hint">Use the form above to add today's report.</p>}
        </div>
      ) : (
        <div className="dr-report-list">
          {entries.map(e => (
            <ReportCard
              key={e._id}
              entry={e}
              viewerIsSuperAdmin={viewerIsSuperAdmin}
              isOwnReport={String(e.user?._id || e.user) === String(user?._id)}
              onDelete={
                (isRegularUser && String(e.user?._id || e.user) === String(user?._id)) || viewerIsSuperAdmin
                  ? handleDelete
                  : null
              }
              onEdit={handleEntryUpdate}
            />
          ))}
        </div>
      )}
    </div>
  );
}
