import React, { useState } from 'react';
import './TrainingSchedule.css';

const STATUS_OPTIONS = [
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
];

const MODE_OPTIONS = [
  { value: 'physical', label: 'Physical' },
  { value: 'online', label: 'Online' },
  { value: 'hybrid', label: 'Hybrid' },
];

function toDateInputValue(d) {
  if (!d) return '';
  const date = new Date(d);
  if (isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
}

function todayInput() {
  const n = new Date();
  const m = String(n.getMonth() + 1).padStart(2, '0');
  const d = String(n.getDate()).padStart(2, '0');
  return `${n.getFullYear()}-${m}-${d}`;
}

export default function TrainingScheduleForm({ schedule, departments, types, onSave, onClose }) {
  const isEdit = !!schedule;
  const [form, setForm] = useState({
    title: schedule?.title || '',
    department: schedule?.department?._id || schedule?.department || '',
    type: schedule?.type || types[0] || 'Meeting',
    date: toDateInputValue(schedule?.date) || todayInput(),
    startTime: schedule?.startTime || '',
    endTime: schedule?.endTime || '',
    venue: schedule?.venue || '',
    host: schedule?.host || '',
    participants: schedule?.participants || '',
    mode: schedule?.mode || 'physical',
    meetingLink: schedule?.meetingLink || '',
    agenda: schedule?.agenda || '',
    status: schedule?.status || 'scheduled',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }));

  const typeOptions = types.includes(form.type) ? types : [form.type, ...types].filter(Boolean);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.title.trim()) { setError('Title is required'); return; }
    if (!form.date) { setError('Date is required'); return; }
    if (form.startTime && form.endTime && form.endTime <= form.startTime) {
      setError('End time must be after start time');
      return;
    }
    setSaving(true);
    try {
      await onSave(form);
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to save training schedule');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="ts-overlay" onClick={e => e.target === e.currentTarget && !saving && onClose()}>
      <div className="ts-modal animate-fade">
        <div className="ts-modal-header">
          <div className="ts-title-group">
            <div className="ts-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                <circle cx="12" cy="12" r="9" />
                <path d="M12 7v5l3 2" />
              </svg>
            </div>
            <div>
              <h3>{isEdit ? 'Edit Training Schedule' : 'New Training Schedule'}</h3>
              <p>Department meetings and trainings</p>
            </div>
          </div>
          <button type="button" className="ts-close" onClick={onClose} disabled={saving}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="ts-modal-body">
            {error && <div className="ts-error">{error}</div>}

            <div className="ts-field">
              <label>Title *</label>
              <input type="text" value={form.title} onChange={e => set('title', e.target.value)} placeholder="e.g. Visa team weekly meeting" maxLength={200} required />
            </div>

            <div className="ts-grid-2">
              <div className="ts-field">
                <label>Department</label>
                <select value={form.department} onChange={e => set('department', e.target.value)}>
                  <option value="">All departments</option>
                  {departments.map(d => <option key={d._id} value={d._id}>{d.name}</option>)}
                </select>
              </div>
              <div className="ts-field">
                <label>Type</label>
                <select value={form.type} onChange={e => set('type', e.target.value)}>
                  {typeOptions.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            </div>

            <div className="ts-grid-3">
              <div className="ts-field">
                <label>Date *</label>
                <input type="date" value={form.date} onChange={e => set('date', e.target.value)} required />
              </div>
              <div className="ts-field">
                <label>Start time</label>
                <input type="time" value={form.startTime} onChange={e => set('startTime', e.target.value)} />
              </div>
              <div className="ts-field">
                <label>End time</label>
                <input type="time" value={form.endTime} onChange={e => set('endTime', e.target.value)} />
              </div>
            </div>

            <div className="ts-field">
              <label>Mode</label>
              <div className="ts-segmented ts-segmented-3">
                {MODE_OPTIONS.map(m => (
                  <button key={m.value} type="button" className={form.mode === m.value ? 'active' : ''} onClick={() => set('mode', m.value)}>
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="ts-grid-2">
              <div className="ts-field">
                <label>Venue</label>
                <input type="text" value={form.venue} onChange={e => set('venue', e.target.value)} placeholder="e.g. Hall A" maxLength={150} />
              </div>
              <div className="ts-field">
                <label>Host / Trainer</label>
                <input type="text" value={form.host} onChange={e => set('host', e.target.value)} placeholder="e.g. Sita Sharma" maxLength={150} />
              </div>
            </div>

            {form.mode !== 'physical' && (
              <div className="ts-field">
                <label>Meeting link</label>
                <input type="text" value={form.meetingLink} onChange={e => set('meetingLink', e.target.value)} placeholder="https://" maxLength={500} />
              </div>
            )}

            <div className="ts-grid-2">
              <div className="ts-field">
                <label>Participants</label>
                <input type="text" value={form.participants} onChange={e => set('participants', e.target.value)} placeholder="e.g. All visa staff" maxLength={300} />
              </div>
              <div className="ts-field">
                <label>Status</label>
                <select value={form.status} onChange={e => set('status', e.target.value)}>
                  {STATUS_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>
            </div>

            <div className="ts-field">
              <label>Agenda / Notes</label>
              <textarea rows={3} value={form.agenda} onChange={e => set('agenda', e.target.value)} placeholder="Topics to cover…" maxLength={1500} />
            </div>
          </div>

          <div className="ts-modal-footer">
            <button type="button" className="ts-btn-cancel" onClick={onClose} disabled={saving}>Cancel</button>
            <button type="submit" className="ts-btn-save" disabled={saving}>
              {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Add Schedule'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
