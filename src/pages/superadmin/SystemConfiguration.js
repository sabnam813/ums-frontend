import React, { useEffect, useState } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { PageHeader, Loading, Toggle } from '../../components/superadmin/SuperAdminUI';

export default function SystemConfiguration() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await axios.get('/superadmin/config');
      setData(res.data);
      setMessage(res.data.maintenanceMode.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const toggleMaintenance = async (enabled) => {
    setSaving(true);
    try {
      const res = await axios.put('/superadmin/config/maintenance', { enabled, message });
      setData(d => ({ ...d, maintenanceMode: res.data.maintenanceMode }));
      toast.success(enabled ? 'Maintenance mode enabled. Non-Super-Admin traffic is now blocked.' : 'Maintenance mode disabled');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update maintenance mode');
    } finally {
      setSaving(false);
    }
  };

  const saveMessage = async () => {
    setSaving(true);
    try {
      const res = await axios.put('/superadmin/config/maintenance', { message });
      setData(d => ({ ...d, maintenanceMode: res.data.maintenanceMode }));
      toast.success('Maintenance message updated');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Loading label="Loading configuration…" />;
  if (!data) return null;

  return (
    <div>
      <PageHeader title="System Configuration" subtitle="Maintenance mode and environment settings" />

      <div className="sa-card" style={{ marginBottom: 20 }}>
        <div className="sa-panel-title">
          Maintenance Mode
          <Toggle checked={data.maintenanceMode.enabled} onChange={toggleMaintenance} disabled={saving} />
        </div>
        <p style={{ fontSize: '0.82rem', color: 'var(--sa-text-dim)', marginTop: -6, marginBottom: 14 }}>
          When enabled, every request is blocked with a 503 for everyone except Super Admins, including your own login page for other roles.
        </p>
        <label style={{ fontSize: '0.78rem', fontWeight: 600, display: 'block', marginBottom: 6 }}>Message shown to blocked users</label>
        <textarea
          className="sa-input" style={{ width: '100%', minHeight: 70, fontFamily: 'inherit' }}
          value={message} onChange={e => setMessage(e.target.value)}
        />
        <div style={{ marginTop: 10 }}>
          <button className="sa-btn sa-btn-primary" onClick={saveMessage} disabled={saving}>Save Message</button>
        </div>
      </div>

      <div className="sa-card">
        <div className="sa-panel-title">Environment</div>
        <div className="sa-detail-row"><span className="sa-detail-label">Node environment</span><span className="sa-detail-value">{data.environment.nodeEnv}</span></div>
        <div className="sa-detail-row"><span className="sa-detail-label">Node version</span><span className="sa-detail-value">{data.environment.nodeVersion}</span></div>
        <div className="sa-detail-row"><span className="sa-detail-label">Port</span><span className="sa-detail-value">{data.environment.port}</span></div>
        <div className="sa-detail-row"><span className="sa-detail-label">Client URL</span><span className="sa-detail-value">{data.environment.clientUrl}</span></div>
        <div className="sa-detail-row"><span className="sa-detail-label">Auto-backup interval</span><span className="sa-detail-value">{data.environment.autoBackupIntervalHours}h</span></div>
      </div>
    </div>
  );
}
