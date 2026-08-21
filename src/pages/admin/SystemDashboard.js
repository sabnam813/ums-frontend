import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import './SystemDashboard.css';

function StatCard({ label, value }) {
  return (
    <div className="sys-stat-card">
      <span className="sys-stat-value">{value ?? '—'}</span>
      <span className="sys-stat-label">{label}</span>
    </div>
  );
}

export default function SystemDashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [flags, setFlags] = useState([]);
  const [flagsLoading, setFlagsLoading] = useState(true);

  const fetchStats = useCallback(async () => {
    try {
      const res = await axios.get('/system/stats');
      setStats(res.data);
    } catch (err) {
      toast.error('Failed to load system stats');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchFlags = useCallback(async () => {
    try {
      const res = await axios.get('/features');
      setFlags(res.data.flags || []);
    } catch (err) {
      toast.error('Failed to load feature flags');
    } finally {
      setFlagsLoading(false);
    }
  }, []);

  const toggleFlag = async (flag) => {
    const nextEnabled = !flag.enabled;
    setFlags(prev => prev.map(f => f.key === flag.key ? { ...f, enabled: nextEnabled } : f));
    try {
      await axios.put(`/features/${flag.key}`, { enabled: nextEnabled });
      toast.success(`${flag.label} ${nextEnabled ? 'enabled' : 'disabled'}`);
    } catch (err) {
      setFlags(prev => prev.map(f => f.key === flag.key ? { ...f, enabled: !nextEnabled } : f));
      toast.error(err.response?.data?.message || 'Failed to update feature');
    }
  };

  useEffect(() => { fetchStats(); fetchFlags(); }, [fetchStats, fetchFlags]);

  const runDangerAction = async (key, { confirmMsg, method, url, successMsg }) => {
    if (!window.confirm(confirmMsg)) return;
    setBusy(key);
    try {
      const res = await axios({ method, url });
      toast.success(res.data?.message || successMsg);
      fetchStats();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Action failed');
    } finally {
      setBusy('');
    }
  };

  if (loading) return (
    <div className="dt-loading"><div className="dt-spinner"/><p>Loading system dashboard…</p></div>
  );

  return (
    <div className="system-dashboard animate-fade">
      <div className="page-header">
        <div>
          <h2>System Dashboard</h2>
          <p>Server health, database stats, and maintenance tools</p>
        </div>
        <button className="btn-add" style={{ background: 'var(--gray-100)', color: 'var(--gray-700)', border: '1.5px solid var(--gray-200)' }} onClick={fetchStats}>
          Refresh
        </button>
      </div>

      <div className="sys-section">
        <h3>Server</h3>
        <div className="sys-stat-grid">
          <StatCard label="Environment" value={stats?.server.environment} />
          <StatCard label="Node Version" value={stats?.server.nodeVersion} />
          <StatCard label="Memory (MB)" value={stats?.server.memoryUsageMb} />
          <StatCard label="Uptime (s)" value={stats?.server.uptimeSeconds} />
        </div>
      </div>

      <div className="sys-section">
        <h3>Database</h3>
        <div className="sys-stat-grid">
          <StatCard label="Connected" value={stats?.database.connected ? 'Yes' : 'No'} />
          <StatCard label="State" value={stats?.database.state} />
          <StatCard label="Host" value={stats?.database.host} />
        </div>
      </div>

      <div className="sys-section">
        <h3>Data Overview</h3>
        <div className="sys-stat-grid">
          <StatCard label="Total Users" value={stats?.counts.users} />
          <StatCard label="Admins" value={stats?.counts.admins} />
          <StatCard label="Staff" value={stats?.counts.staff} />
          <StatCard label="Countries" value={stats?.counts.countries} />
          <StatCard label="Applications" value={stats?.counts.applications} />
          <StatCard label="Inquiries" value={stats?.counts.inquiries} />
          <StatCard label="Test Types" value={stats?.counts.testTypes} />
          <StatCard label="Test Prep Records" value={stats?.counts.testPrepRecords} />
          <StatCard label="Trash Items" value={stats?.counts.trashItems} />
          <StatCard label="Conversations" value={stats?.counts.conversations} />
          <StatCard label="Messages" value={stats?.counts.messages} />
        </div>
      </div>

      <div className="sys-section">
        <h3>Feature Modules</h3>
        <p className="section-hint">Turn whole modules on/off system-wide without touching any code. Disabled modules stay visible to you (Super Admin) but are blocked for everyone else.</p>
        {flagsLoading ? (
          <p className="section-hint">Loading…</p>
        ) : (
          <div className="sys-danger-actions">
            {flags.map(flag => (
              <div className="sys-danger-row" key={flag.key}>
                <div>
                  <strong>{flag.label}</strong>
                  <p>{flag.description}</p>
                </div>
                <button
                  className={flag.enabled ? 'btn-cancel' : 'btn-cancel danger'}
                  onClick={() => toggleFlag(flag)}
                >
                  {flag.enabled ? 'Enabled, click to disable' : 'Disabled, click to enable'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="sys-section danger">
        <h3>Danger Zone</h3>
        <p className="section-hint">These actions are irreversible or affect the whole system. Use with care.</p>
        <div className="sys-danger-actions">
          <div className="sys-danger-row">
            <div>
              <strong>Re-seed default Test Types</strong>
              <p>Recreates IELTS / PTE / Duolingo if they were all deleted and none exist.</p>
            </div>
            <button
              className="btn-cancel"
              disabled={busy === 'reseed'}
              onClick={() => runDangerAction('reseed', {
                confirmMsg: 'Re-seed default test types (IELTS, PTE, Duolingo)?',
                method: 'post',
                url: '/system/reseed-test-types',
                successMsg: 'Default test types re-seeded',
              })}
            >
              {busy === 'reseed' ? 'Working…' : 'Re-seed'}
            </button>
          </div>

          <div className="sys-danger-row">
            <div>
              <strong>Empty Trash Permanently</strong>
              <p>Deletes every soft-deleted record system-wide. This cannot be undone.</p>
            </div>
            <button
              className="btn-cancel danger"
              disabled={busy === 'trash'}
              onClick={() => runDangerAction('trash', {
                confirmMsg: 'Permanently delete ALL items in Trash across the entire system? This cannot be undone.',
                method: 'delete',
                url: '/system/trash/empty-all',
                successMsg: 'Trash emptied',
              })}
            >
              {busy === 'trash' ? 'Working…' : 'Empty Trash'}
            </button>
          </div>

          <div className="sys-danger-row">
            <div>
              <strong>Clean Up Orphaned Chats</strong>
              <p>Removes conversations/messages left behind by deleted users.</p>
            </div>
            <button
              className="btn-cancel"
              disabled={busy === 'chat'}
              onClick={() => runDangerAction('chat', {
                confirmMsg: 'Remove chat conversations left behind by deleted users?',
                method: 'delete',
                url: '/system/chat/cleanup-orphaned',
                successMsg: 'Orphaned chat data cleaned up',
              })}
            >
              {busy === 'chat' ? 'Working…' : 'Clean Up'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
