import React, { useEffect, useState } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { PageHeader, Loading, Badge } from '../../components/superadmin/SuperAdminUI';

export default function DeveloperTools() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await axios.get('/superadmin/devtools');
      setData(res.data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const runAction = async (key, label, confirmMsg, endpoint, method = 'post') => {
    if (confirmMsg && !window.confirm(confirmMsg)) return;
    setBusy(key);
    try {
      const res = await axios[method](endpoint);
      toast.success(res.data.message || `${label} completed`);
    } catch (err) {
      toast.error(err.response?.data?.message || `${label} failed`);
    } finally {
      setBusy(null);
    }
  };

  if (loading) return <Loading label="Loading developer diagnostics…" />;
  if (!data) return null;

  return (
    <div>
      <PageHeader title="Developer Tools" subtitle="Read-only diagnostics and safe maintenance utilities" />

      <div className="sa-grid">
        <div className="sa-card">
          <div className="sa-panel-title">Backend</div>
          <div className="sa-detail-row"><span className="sa-detail-label">Version</span><span className="sa-detail-value">{data.backend.version || '—'}</span></div>
          <div className="sa-detail-row"><span className="sa-detail-label">Node</span><span className="sa-detail-value">{data.backend.node}</span></div>
        </div>
        <div className="sa-card">
          <div className="sa-panel-title">Frontend</div>
          <div className="sa-detail-row"><span className="sa-detail-label">Version</span><span className="sa-detail-value">{data.frontend.version || '—'}</span></div>
          <div className="sa-detail-row"><span className="sa-detail-label">React</span><span className="sa-detail-value">{data.frontend.react || '—'}</span></div>
        </div>
      </div>

      <div className="sa-card" style={{ marginBottom: 20 }}>
        <div className="sa-panel-title">Backend Dependencies</div>
        <div className="sa-code-block">
          {Object.entries(data.backend.dependencies || {}).map(([k, v]) => `${k}: ${v}`).join('\n')}
        </div>
      </div>

      <div className="sa-card" style={{ marginBottom: 20 }}>
        <div className="sa-panel-title">Feature Flags Snapshot</div>
        <div className="sa-table-wrap">
          <table className="sa-table">
            <thead><tr><th>Key</th><th>Label</th><th>Status</th></tr></thead>
            <tbody>
              {data.featureFlags.map(f => (
                <tr key={f.key}>
                  <td className="sa-mono">{f.key}</td>
                  <td>{f.label}</td>
                  <td><Badge tone={f.enabled ? 'success' : 'neutral'}>{f.enabled ? 'Enabled' : 'Disabled'}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="sa-card">
        <div className="sa-panel-title">Maintenance Utilities</div>
        <p style={{ fontSize: '0.82rem', color: 'var(--sa-text-dim)', marginTop: -6, marginBottom: 14 }}>
          These use the same backend utilities as elsewhere. Each is safe, but some are irreversible, so a confirmation is required.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <button className="sa-btn" style={{ justifyContent: 'flex-start' }} disabled={busy === 'reseed'}
            onClick={() => runAction('reseed', 'Reseed test types', 'Reseed default Test Preparation types (IELTS/PTE/Duolingo)? This only runs if none exist yet.', '/system/reseed-test-types')}>
            {busy === 'reseed' ? 'Running…' : 'Reseed Default Test Types'}
          </button>
          <button className="sa-btn sa-btn-danger" style={{ justifyContent: 'flex-start' }} disabled={busy === 'trash'}
            onClick={() => runAction('trash', 'Empty trash', 'Permanently empty ALL trash across the entire system? This cannot be undone.', '/system/trash/empty-all', 'delete')}>
            {busy === 'trash' ? 'Running…' : 'Permanently Empty Trash (All Modules)'}
          </button>
          <button className="sa-btn sa-btn-danger" style={{ justifyContent: 'flex-start' }} disabled={busy === 'chat'}
            onClick={() => runAction('chat', 'Clean up chat', 'Delete conversations that reference deleted users? This cannot be undone.', '/system/chat/cleanup-orphaned', 'delete')}>
            {busy === 'chat' ? 'Running…' : 'Clean Up Orphaned Chat Data'}
          </button>
        </div>
      </div>
    </div>
  );
}
