import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';

function fmtWhen(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

const STATUS_LABEL = { pending: 'Scheduled', completed: 'Completed', cancelled: 'Cancelled' };

export default function StudentFollowUpAdminSummary() {
  const [data, setData] = useState(null);
  const [open, setOpen] = useState(true);

  const load = useCallback(() => {
    axios.get('/student-follow-ups/admin-summary').then(res => setData(res.data)).catch(() => {});
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, 60000);
    return () => clearInterval(id);
  }, [load]);

  if (!data) return null;
  const t = data.totals;

  return (
    <div className="sfu-admin-summary">
      <button type="button" className="sfu-admin-toggle" onClick={() => setOpen(v => !v)}>
        <strong>Follow-up overview</strong>
        <span>{open ? 'Hide' : `${t.today} today · ${t.overdue} overdue · ${t.cancelled} cancelled`}</span>
      </button>
      {open && (
        <div className="sfu-admin-body">
          <div className="sfu-admin-stats">
            <div className="sfu-admin-stat"><span>{t.today}</span>Today</div>
            <div className="sfu-admin-stat overdue"><span>{t.overdue}</span>Overdue</div>
            <div className="sfu-admin-stat"><span>{t.pending}</span>Scheduled</div>
            <div className="sfu-admin-stat"><span>{t.completed}</span>Completed</div>
            <div className="sfu-admin-stat cancelled"><span>{t.cancelled}</span>Cancelled</div>
            <div className="sfu-admin-stat"><span>{t.total}</span>All time</div>
          </div>
          <div className="sfu-admin-activity">
            <h4>Recent activity</h4>
            <table className="sfu-admin-activity-table">
              <thead>
                <tr><th>Student</th><th>Country</th><th>Status</th><th>By</th><th>When</th></tr>
              </thead>
              <tbody>
                {data.activity.map(a => (
                  <tr key={a.id}>
                    <td>{a.studentName || '—'}</td>
                    <td>{a.country ? `${a.country.flag ? a.country.flag + ' ' : ''}${a.country.name}` : '—'}</td>
                    <td><span className={`sfu-admin-status ${a.status}`}>{STATUS_LABEL[a.status] || a.status}</span></td>
                    <td>{a.who}</td>
                    <td>{fmtWhen(a.when)}</td>
                  </tr>
                ))}
                {data.activity.length === 0 && (
                  <tr><td colSpan={5} className="sfu-td-empty">No follow-ups yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
