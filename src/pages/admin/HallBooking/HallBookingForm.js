import React, { useState } from 'react';
import './HallBooking.css';

const STATUS_OPTIONS = [
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
];

function toDateInputValue(d) {
  if (!d) return '';
  const date = new Date(d);
  if (isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
}

export default function HallBookingForm({ booking, countries, users = [], isSuperAdmin, onSave, onClose }) {
  const isEdit = !!booking;
  const [form, setForm] = useState({
    eventType: booking?.eventType || 'country',
    eventTitle: booking?.eventTitle || '',
    country: booking?.country?._id || booking?.country || '',
    date: toDateInputValue(booking?.date) || toDateInputValue(new Date()),
    hall: booking?.hall || '',
    time: booking?.time || '',
    institution: booking?.institution || '',
    representativeName: booking?.representativeName || '',
    designation: booking?.designation || '',
    status: booking?.status || 'scheduled',
    remarks: booking?.remarks || '',
    visibilityMode: booking?.visibility?.mode || 'everyone',
    visibilityUsers: (booking?.visibility?.allowedUsers || []).map(u => u?._id || u),
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }));

  const toggleVisibilityUser = (id) => {
    setForm(f => {
      const has = f.visibilityUsers.includes(id);
      return {
        ...f,
        visibilityUsers: has ? f.visibilityUsers.filter(u => u !== id) : [...f.visibilityUsers, id],
      };
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (form.eventType === 'country' && !form.country) { setError('Country is required'); return; }
    if (form.eventType === 'general' && !form.eventTitle.trim()) { setError('Event title is required'); return; }
    if (!form.date) { setError('Date is required'); return; }
    if (!form.hall.trim()) { setError('Hall / room is required'); return; }
    setSaving(true);
    try {
      await onSave({
        ...form,
        visibility: { mode: form.visibilityMode, allowedUsers: form.visibilityMode === 'specific' ? form.visibilityUsers : [] },
      });
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to save hall booking');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="hb-overlay" onClick={e => e.target === e.currentTarget && !saving && onClose()}>
      <div className="hb-modal animate-fade">
        <div className="hb-modal-header">
          <div className="hb-title-group">
            <div className="hb-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                <rect x="3" y="4" width="18" height="18" rx="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
            </div>
            <div>
              <h3>{isEdit ? 'Edit Hall Booking' : 'New Hall Booking'}</h3>
              <p>Country, date, hall &amp; visitor details</p>
            </div>
          </div>
          <button type="button" className="hb-close" onClick={onClose} disabled={saving}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="hb-modal-body">
            {error && <div className="hb-error">{error}</div>}

            <div className="hb-field">
              <label>Event Type</label>
              <div className="hb-segmented">
                <button
                  type="button"
                  className={form.eventType === 'country' ? 'active' : ''}
                  onClick={() => set('eventType', 'country')}
                >
                  Country Event
                </button>
                <button
                  type="button"
                  className={form.eventType === 'general' ? 'active' : ''}
                  onClick={() => set('eventType', 'general')}
                >
                  General Event
                </button>
              </div>
            </div>

            <div className="hb-grid-3">
              {form.eventType === 'country' ? (
                <div className="hb-field">
                  <label>Country *</label>
                  <select value={form.country} onChange={e => set('country', e.target.value)} required>
                    <option value="">Select country…</option>
                    {countries.map(c => (
                      <option key={c._id} value={c._id}>{c.flag ? `${c.flag} ` : ''}{c.name}</option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="hb-field">
                  <label>Event Title *</label>
                  <input
                    type="text"
                    value={form.eventTitle}
                    onChange={e => set('eventTitle', e.target.value)}
                    placeholder="e.g. Board Meeting"
                    maxLength={200}
                    required
                  />
                </div>
              )}
              <div className="hb-field">
                <label>Date *</label>
                <input type="date" value={form.date} onChange={e => set('date', e.target.value)} required />
              </div>
              <div className="hb-field">
                <label>Hall / Room *</label>
                <input type="text" value={form.hall} onChange={e => set('hall', e.target.value)} placeholder="e.g. Hall A" maxLength={100} required />
              </div>
            </div>

            <div className="hb-grid-2">
              <div className="hb-field">
                <label>Time</label>
                <input type="text" value={form.time} onChange={e => set('time', e.target.value)} placeholder="e.g. 12:45 to 1:20 PM" maxLength={100} />
              </div>
              <div className="hb-field">
                <label>Status</label>
                <select value={form.status} onChange={e => set('status', e.target.value)}>
                  {STATUS_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>
            </div>

            {form.eventType === 'country' && (
              <div className="hb-field">
                <label>University / College / Portal / Company</label>
                <input type="text" value={form.institution} onChange={e => set('institution', e.target.value)} placeholder="e.g. Christian Brothers University" maxLength={200} />
              </div>
            )}

            {form.eventType === 'country' && (
              <div className="hb-grid-2">
                <div className="hb-field">
                  <label>Representative Name</label>
                  <input type="text" value={form.representativeName} onChange={e => set('representativeName', e.target.value)} placeholder="e.g. Jaydeep Desai" maxLength={150} />
                </div>
                <div className="hb-field">
                  <label>Designation</label>
                  <input type="text" value={form.designation} onChange={e => set('designation', e.target.value)} placeholder="e.g. Uni Representative" maxLength={150} />
                </div>
              </div>
            )}

            <div className="hb-field">
              <label>Remarks</label>
              <textarea rows={3} value={form.remarks} onChange={e => set('remarks', e.target.value)} placeholder="Any notes about this booking…" maxLength={1000} />
            </div>

            {isSuperAdmin && (
              <div className="hb-field">
                <label>Who can see this booking?</label>
                <div className="hb-segmented hb-segmented-3">
                  <button type="button" className={form.visibilityMode === 'everyone' ? 'active' : ''} onClick={() => set('visibilityMode', 'everyone')}>Everyone</button>
                  <button type="button" className={form.visibilityMode === 'specific' ? 'active' : ''} onClick={() => set('visibilityMode', 'specific')}>Specific people</button>
                  <button type="button" className={form.visibilityMode === 'private' ? 'active' : ''} onClick={() => set('visibilityMode', 'private')}>No one (just me)</button>
                </div>
                {form.visibilityMode === 'specific' && (
                  <div className="hb-user-picker">
                    {users.length === 0 && <p className="hb-td-empty">No other users found.</p>}
                    {users.map(u => (
                      <label key={u._id} className="hb-user-checkbox">
                        <input
                          type="checkbox"
                          checked={form.visibilityUsers.includes(u._id)}
                          onChange={() => toggleVisibilityUser(u._id)}
                        />
                        {u.name || u.username}
                      </label>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="hb-modal-footer">
            <button type="button" className="hb-btn-cancel" onClick={onClose} disabled={saving}>Cancel</button>
            <button type="submit" className="hb-btn-save" disabled={saving}>
              {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Add Booking'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
