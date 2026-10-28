import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { PageHeader, StatCard, Loading, Badge } from '../../components/superadmin/SuperAdminUI';

export default function SecurityCenter() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('failed');

  const load = async () => {
    setLoading(true);
    try {
      const res = await axios.get('/superadmin/security');
      setData(res.data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  if (loading) return <Loading label="Loading security data…" />;
  if (!data) return null;

  const rows = tab === 'failed' ? data.failedLogins : data.recentLogins;

  return (
    <div>
      <PageHeader title="Security Center" subtitle="Authentication activity, sessions, and access configuration" actions={<button className="sa-btn" onClick={load}>Refresh</button>} />

      <div className="sa-grid">
        <StatCard label="Active Sessions" value={data.activeSessions} sub="Users with a live refresh token" color="#2E4F8F" />
        <StatCard label="Failed Logins (recent)" value={data.failedLogins.length} color={data.failedLogins.length > 10 ? '#ef4444' : '#f59e0b'} />
        <StatCard label="Must Change Password" value={data.mustChangePasswordCount} color="#6B5B95" />
        <StatCard label="Roles" value={data.roleBreakdown.map(r => `${r.role}: ${r.count}`).join(' · ')} color="#F08641" />
      </div>

      <div className="sa-card" style={{ marginBottom: 20 }}>
        <div className="sa-panel-title">Access Configuration</div>
        <div className="sa-detail-row"><span className="sa-detail-label">Access token expiry</span><span className="sa-detail-value">{data.config.jwtExpiresIn}</span></div>
        <div className="sa-detail-row"><span className="sa-detail-label">Refresh token expiry</span><span className="sa-detail-value">{data.config.refreshExpiresIn}</span></div>
        <div className="sa-detail-row"><span className="sa-detail-label">Allowed CORS origins</span><span className="sa-detail-value">{data.config.corsOrigins.join(', ')}</span></div>
      </div>

      <div className="sa-card">
        <div className="sa-panel-title">
          Login Activity
          <div style={{ display: 'flex', gap: 6 }}>
            <button className={`sa-btn ${tab === 'failed' ? 'sa-btn-primary' : ''}`} onClick={() => setTab('failed')}>Failed Attempts</button>
            <button className={`sa-btn ${tab === 'success' ? 'sa-btn-primary' : ''}`} onClick={() => setTab('success')}>Successful Logins</button>
          </div>
        </div>
        <div className="sa-table-wrap">
          <table className="sa-table">
            <thead><tr><th>Time</th><th>Username</th><th>Message</th><th>IP</th></tr></thead>
            <tbody>
              {rows.length === 0 && <tr><td colSpan={4} className="sa-empty-row">Nothing to show</td></tr>}
              {rows.map(r => (
                <tr key={r._id}>
                  <td>{new Date(r.createdAt).toLocaleString()}</td>
                  <td>{r.actor?.username || r.meta?.username || '—'} {r.actor?.role && <Badge tone="neutral">{r.actor.role}</Badge>}</td>
                  <td>{r.message}</td>
                  <td className="sa-mono">{r.ip || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
