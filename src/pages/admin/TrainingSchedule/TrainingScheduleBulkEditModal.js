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

export default function TrainingScheduleBulkEditModal({ count, departments, types, onSave, onClose }) {
  const [enabled, setEnabled] = useState({ department: false, type: false, venue: false, host: false, mode: false, status: false, agenda: false });
  const [department, setDepartment] = useState('');
  const [type, setType] = useState(types[0] || 'Meeting');
  const [venue, setVenue] = useState('');
  const [host, setHost] = useState('');
  const [mode, setMode] = useState('physical');
  const [status, setStatus] = useState('scheduled');
  const [agenda, setAgenda] = useState('');
  const [saving, setSaving] = useState(false);

  const toggle = (key) => setEnabled(e => ({ ...e, [key]: !e[key] }));

  const handleSave = async () => {
    const updates = {};
    if (enabled.department) updates.department = department;
    if (enabled.type) updates.type = type;
    if (enabled.venue) updates.venue = venue;
    if (enabled.host) updates.host = host;
    if (enabled.mode) updates.mode = mode;
    if (enabled.status) updates.status = status;
    if (enabled.agenda) updates.agenda = agenda;
    if (Object.keys(updates).length === 0) return;
    setSaving(true);
    try {
      await onSave(updates);
    } finally {
      setSaving(false);
    }
  };

  const enabledCount = Object.values(enabled).filter(Boolean).length;

  return (
    <div className="ts-overlay" onClick={e => e.target === e.currentTarget && !saving && onClose()}>
      <div className="ts-modal ts-modal-sm animate-fade">
        <div className="ts-modal-header">
          <div className="ts-title-group">
            <div className="ts-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
            </div>
            <div>
              <h3>Bulk Edit Schedules</h3>
              <p>Updating <strong>{count}</strong> schedule{count > 1 ? 's' : ''}. Title, date and time are left untouched.</p>
            </div>
          </div>
          <button type="button" className="ts-close" onClick={onClose} disabled={saving}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="ts-modal-body">
          <label className="ts-be-row">
            <input type="checkbox" checked={enabled.department} onChange={() => toggle('department')} />
            <span className="ts-be-label">Department</span>
            {enabled.department && (
              <select className="ts-be-input" value={department} onChange={e => setDepartment(e.target.value)}>
                <option value="">All departments</option>
                {departments.map(d => <option key={d._id} value={d._id}>{d.name}</option>)}
              </select>
            )}
          </label>

          <label className="ts-be-row">
            <input type="checkbox" checked={enabled.type} onChange={() => toggle('type')} />
            <span className="ts-be-label">Type</span>
            {enabled.type && (
              <select className="ts-be-input" value={type} onChange={e => setType(e.target.value)}>
                {types.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            )}
          </label>

          <label className="ts-be-row">
            <input type="checkbox" checked={enabled.venue} onChange={() => toggle('venue')} />
            <span className="ts-be-label">Venue</span>
            {enabled.venue && (
              <input type="text" className="ts-be-input" value={venue} onChange={e => setVenue(e.target.value)} placeholder="e.g. Hall B" maxLength={150} />
            )}
          </label>

          <label className="ts-be-row">
            <input type="checkbox" checked={enabled.host} onChange={() => toggle('host')} />
            <span className="ts-be-label">Host / Trainer</span>
            {enabled.host && (
              <input type="text" className="ts-be-input" value={host} onChange={e => setHost(e.target.value)} maxLength={150} />
            )}
          </label>

          <label className="ts-be-row">
            <input type="checkbox" checked={enabled.mode} onChange={() => toggle('mode')} />
            <span className="ts-be-label">Mode</span>
            {enabled.mode && (
              <select className="ts-be-input" value={mode} onChange={e => setMode(e.target.value)}>
                {MODE_OPTIONS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            )}
          </label>

          <label className="ts-be-row">
            <input type="checkbox" checked={enabled.status} onChange={() => toggle('status')} />
            <span className="ts-be-label">Status</span>
            {enabled.status && (
              <select className="ts-be-input" value={status} onChange={e => setStatus(e.target.value)}>
                {STATUS_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            )}
          </label>

          <label className="ts-be-row" style={{ alignItems: 'flex-start' }}>
            <input type="checkbox" checked={enabled.agenda} onChange={() => toggle('agenda')} />
            <span className="ts-be-label">Agenda / Notes</span>
          </label>
          {enabled.agenda && (
            <textarea
              rows={4}
              value={agenda}
              onChange={e => setAgenda(e.target.value)}
              placeholder="Replace agenda for all selected schedules…"
              maxLength={1500}
              style={{ marginLeft: 26, border: '1px solid var(--gray-300)', borderRadius: 'var(--radius-sm)', padding: '8px 10px', fontSize: '0.85rem', fontFamily: 'var(--font-body)' }}
            />
          )}
        </div>

        <div className="ts-modal-footer">
          <span className="ts-be-enabled-count">
            {enabledCount > 0 ? `${enabledCount} field${enabledCount > 1 ? 's' : ''} to update` : 'No fields selected'}
          </span>
          <div style={{ display: 'flex', gap: 10 }}>
            <button type="button" className="ts-btn-cancel" onClick={onClose} disabled={saving}>Cancel</button>
            <button type="button" className="ts-btn-save" onClick={handleSave} disabled={saving || enabledCount === 0}>
              {saving ? 'Applying…' : `Apply to ${count}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
