import React, { useState } from 'react';
import './HallBooking.css';

const STATUS_OPTIONS = [
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
];

export default function HallBookingBulkEditModal({ count, onSave, onClose }) {
  const [enabled, setEnabled] = useState({ hall: false, time: false, status: false, remarks: false });
  const [hall, setHall] = useState('');
  const [time, setTime] = useState('');
  const [status, setStatus] = useState('scheduled');
  const [remarks, setRemarks] = useState('');
  const [saving, setSaving] = useState(false);

  const toggle = (key) => setEnabled(e => ({ ...e, [key]: !e[key] }));

  const handleSave = async () => {
    const updates = {};
    if (enabled.hall) updates.hall = hall;
    if (enabled.time) updates.time = time;
    if (enabled.status) updates.status = status;
    if (enabled.remarks) updates.remarks = remarks;
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
    <div className="hb-overlay" onClick={e => e.target === e.currentTarget && !saving && onClose()}>
      <div className="hb-modal hb-modal-sm animate-fade">
        <div className="hb-modal-header">
          <div className="hb-title-group">
            <div className="hb-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
            </div>
            <div>
              <h3>Bulk Edit Hall Bookings</h3>
              <p>Updating <strong>{count}</strong> booking{count > 1 ? 's' : ''}. Country &amp; date are left untouched here.</p>
            </div>
          </div>
          <button type="button" className="hb-close" onClick={onClose} disabled={saving}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="hb-modal-body">
          <label className="hb-be-row">
            <input type="checkbox" checked={enabled.hall} onChange={() => toggle('hall')} />
            <span className="hb-be-label">Hall / Room</span>
            {enabled.hall && (
              <input type="text" className="hb-be-input" value={hall} onChange={e => setHall(e.target.value)} placeholder="e.g. Hall B" maxLength={100} />
            )}
          </label>

          <label className="hb-be-row">
            <input type="checkbox" checked={enabled.time} onChange={() => toggle('time')} />
            <span className="hb-be-label">Time</span>
            {enabled.time && (
              <input type="text" className="hb-be-input" value={time} onChange={e => setTime(e.target.value)} placeholder="e.g. 2:00 to 3:00 PM" maxLength={100} />
            )}
          </label>

          <label className="hb-be-row">
            <input type="checkbox" checked={enabled.status} onChange={() => toggle('status')} />
            <span className="hb-be-label">Status</span>
            {enabled.status && (
              <select className="hb-be-input" value={status} onChange={e => setStatus(e.target.value)}>
                {STATUS_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            )}
          </label>

          <label className="hb-be-row" style={{ alignItems: 'flex-start' }}>
            <input type="checkbox" checked={enabled.remarks} onChange={() => toggle('remarks')} />
            <span className="hb-be-label">Remarks</span>
          </label>
          {enabled.remarks && (
            <textarea
              rows={4}
              value={remarks}
              onChange={e => setRemarks(e.target.value)}
              placeholder="Replace remarks for all selected bookings…"
              maxLength={1000}
              style={{ marginLeft: 26, border: '1px solid var(--gray-300)', borderRadius: 'var(--radius-sm)', padding: '8px 10px', fontSize: '0.85rem', fontFamily: 'var(--font-body)' }}
            />
          )}
        </div>

        <div className="hb-modal-footer">
          <span className="hb-be-enabled-count">
            {enabledCount > 0 ? `${enabledCount} field${enabledCount > 1 ? 's' : ''} to update` : 'No fields selected'}
          </span>
          <div style={{ display: 'flex', gap: 10 }}>
            <button type="button" className="hb-btn-cancel" onClick={onClose} disabled={saving}>Cancel</button>
            <button type="button" className="hb-btn-save" onClick={handleSave} disabled={saving || enabledCount === 0}>
              {saving ? 'Applying…' : `Apply to ${count}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
