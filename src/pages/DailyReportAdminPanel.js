import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import './DailyReportAdminPanel.css';

function todayNepal() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kathmandu' });
}

export default function DailyReportAdminPanel({ users, onChanged }) {
  const [open, setOpen] = useState(false);
  const [windowDays, setWindowDays] = useState(2);
  const [unlocks, setUnlocks] = useState([]);
  const [savingWindow, setSavingWindow] = useState(false);
  const [unlockUser, setUnlockUser] = useState('');
  const [unlockDate, setUnlockDate] = useState(todayNepal());
  const [behalfUser, setBehalfUser] = useState('');
  const [behalfDate, setBehalfDate] = useState(todayNepal());
  const [behalfText, setBehalfText] = useState('');
  const [saving, setSaving] = useState(false);

  const staff = (users || []).filter(u => u.status !== 'inactive');

  const load = useCallback(async () => {
    try {
      const res = await axios.get('/daily-report/settings');
      setWindowDays(res.data.editWindowDays);
      setUnlocks(res.data.unlocks || []);
    } catch {
      toast.error('Failed to load Daily Report settings');
    }
  }, []);

  useEffect(() => { if (open) load(); }, [open, load]);

  const saveWindow = async () => {
    setSavingWindow(true);
    try {
      await axios.put('/daily-report/settings', { editWindowDays: Number(windowDays) });
      toast.success('Edit window updated');
      if (onChanged) onChanged();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save');
    } finally {
      setSavingWindow(false);
    }
  };

  const addUnlock = async () => {
    if (!unlockUser || !unlockDate) { toast.error('Pick a staff member and a date'); return; }
    try {
      await axios.post('/daily-report/unlock', { user: unlockUser, date: unlockDate });
      toast.success('Date unlocked');
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to unlock');
    }
  };

  const removeUnlock = async (id) => {
    try {
      await axios.delete(`/daily-report/unlock/${id}`);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to remove');
    }
  };

  const saveBehalf = async () => {
    const points = behalfText.split('\n').map(l => l.trim()).filter(Boolean);
    if (!behalfUser) { toast.error('Choose a staff member'); return; }
    if (points.length === 0) { toast.error('Add at least one point'); return; }
    setSaving(true);
    try {
      await axios.post('/daily-report', { userId: behalfUser, date: behalfDate, points });
      toast.success('Report saved for staff member');
      setBehalfText('');
      if (onChanged) onChanged();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save report');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="drap-card">
      <button type="button" className="drap-toggle" onClick={() => setOpen(v => !v)}>
        <strong>Daily Report settings</strong>
        <span>{open ? 'Hide' : 'Edit window · unlock a missed date · write for staff'}</span>
      </button>
      {open && (
        <div className="drap-body">
          <section>
            <h4>Edit window</h4>
            <p>Staff can add or edit reports dated within this many days before today.</p>
            <div className="drap-row">
              <input type="number" min="0" max="90" value={windowDays} onChange={e => setWindowDays(e.target.value)} />
              <span>days</span>
              <button type="button" className="drap-btn" onClick={saveWindow} disabled={savingWindow}>{savingWindow ? 'Saving…' : 'Save'}</button>
            </div>
          </section>

          <section>
            <h4>Unlock a missed date</h4>
            <p>Lets one person add or edit a report for one date outside the window.</p>
            <div className="drap-row">
              <select value={unlockUser} onChange={e => setUnlockUser(e.target.value)}>
                <option value="">Staff member…</option>
                {staff.map(u => <option key={u._id} value={u._id}>{u.name || u.username}</option>)}
              </select>
              <input type="date" value={unlockDate} onChange={e => setUnlockDate(e.target.value)} />
              <button type="button" className="drap-btn" onClick={addUnlock}>Unlock</button>
            </div>
            {unlocks.length > 0 && (
              <ul className="drap-list">
                {unlocks.map(u => (
                  <li key={u._id}>
                    <span>{u.user?.name || u.user?.username || 'User'} — {u.date}</span>
                    <button type="button" className="drap-link" onClick={() => removeUnlock(u._id)}>Remove</button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <h4>Write a report for a staff member</h4>
            <p>Bypasses the edit window. One point per line.</p>
            <div className="drap-row">
              <select value={behalfUser} onChange={e => setBehalfUser(e.target.value)}>
                <option value="">Staff member…</option>
                {staff.map(u => <option key={u._id} value={u._id}>{u.name || u.username}</option>)}
              </select>
              <input type="date" value={behalfDate} onChange={e => setBehalfDate(e.target.value)} />
            </div>
            <textarea rows={4} value={behalfText} onChange={e => setBehalfText(e.target.value)} placeholder="What they worked on…" />
            <button type="button" className="drap-btn" onClick={saveBehalf} disabled={saving}>{saving ? 'Saving…' : 'Save report'}</button>
          </section>
        </div>
      )}
    </div>
  );
}
