import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import './ActivityLogs.css';

const ACTION_LABELS = {
  'auth.login': 'Logged in',
  'auth.login_failed': 'Failed login attempt',
  'auth.logout': 'Logged out',
  'user.created': 'User created',
  'user.updated': 'User updated',
  'user.status_changed': 'User status changed',
  'user.password_reset': 'Password reset',
  'user.role_changed': 'Role changed',
  'user.deleted': 'User deleted',
  'backup.created': 'Backup created',
  'backup.restored': 'Backup restored',
  'backup.deleted': 'Backup deleted',
  'system.reseed_test_types': 'Re-seeded test types',
  'system.trash_emptied': 'Trash emptied',
  'system.chat_cleanup': 'Orphaned chats cleaned up',
  'feature.enabled': 'Feature enabled',
  'feature.disabled': 'Feature disabled',
};

function formatWhen(iso) {
  const d = new Date(iso);
  return d.toLocaleString();
}

export default function ActivityLogs() {
  const [logs, setLogs] = useState([]);
  const [actions, setActions] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ action: '', username: '' });
  const pageSize = 50;

  const fetchLogs = useCallback(async (opts = {}) => {
    setLoading(true);
    try {
      const params = { page, limit: pageSize, ...filters, ...opts };
      Object.keys(params).forEach(k => { if (!params[k]) delete params[k]; });
      const res = await axios.get('/logs', { params });
      setLogs(res.data.logs || []);
      setTotal(res.data.total || 0);
      setActions(res.data.actions || []);
    } catch (err) {
      toast.error('Failed to load activity logs');
    } finally {
      setLoading(false);
    }
  }, [page, filters]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  const applyFilters = (e) => {
    e.preventDefault();
    setPage(1);
    fetchLogs({ page: 1 });
  };

  const clearOldLogs = async () => {
    if (!window.confirm('Delete all activity logs older than 90 days? This cannot be undone.')) return;
    try {
      const res = await axios.delete('/logs/clear', { params: { olderThanDays: 90 } });
      toast.success(res.data.message || 'Old logs cleared');
      fetchLogs();
    } catch (err) {
      toast.error('Failed to clear logs');
    }
  };

  const totalPages = Math.max(Math.ceil(total / pageSize), 1);

  return (
    <div className="activity-logs animate-fade">
      <div className="page-header">
        <div>
          <h2>Activity Logs</h2>
          <p>Every login, user change, backup, and system action.</p>
        </div>
        <button className="btn-cancel danger" onClick={clearOldLogs}>Clear logs older than 90 days</button>
      </div>

      <form className="logs-filters" onSubmit={applyFilters}>
        <select
          value={filters.action}
          onChange={(e) => setFilters(f => ({ ...f, action: e.target.value }))}
        >
          <option value="">All actions</option>
          {actions.map(a => (
            <option key={a} value={a}>{ACTION_LABELS[a] || a}</option>
          ))}
        </select>
        <input
          type="text"
          placeholder="Filter by username…"
          value={filters.username}
          onChange={(e) => setFilters(f => ({ ...f, username: e.target.value }))}
        />
        <button type="submit" className="btn-add">Filter</button>
      </form>

      {loading ? (
        <div className="dt-loading"><div className="dt-spinner" /><p>Loading logs…</p></div>
      ) : (
        <>
          <div className="logs-table-wrap">
            <table className="logs-table">
              <thead>
                <tr>
                  <th>When</th>
                  <th>Actor</th>
                  <th>Action</th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody>
                {logs.length === 0 && (
                  <tr><td colSpan={4} className="logs-empty">No activity recorded yet.</td></tr>
                )}
                {logs.map(log => (
                  <tr key={log._id}>
                    <td>{formatWhen(log.createdAt)}</td>
                    <td>
                      <strong>{log.actor?.username || 'unknown'}</strong>
                      <span className="logs-role"> ({log.actor?.role || '—'})</span>
                    </td>
                    <td>
                      <span className={`logs-action-badge ${log.action.startsWith('auth.login_failed') ? 'warn' : ''}`}>
                        {ACTION_LABELS[log.action] || log.action}
                      </span>
                    </td>
                    <td className="logs-message">{log.message}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="logs-pagination">
            <button
              className="btn-cancel"
              disabled={page <= 1}
              onClick={() => setPage(p => Math.max(p - 1, 1))}
            >
              Previous
            </button>
            <span>Page {page} of {totalPages}, {total} total</span>
            <button
              className="btn-cancel"
              disabled={page >= totalPages}
              onClick={() => setPage(p => Math.min(p + 1, totalPages))}
            >
              Next
            </button>
          </div>
        </>
      )}
    </div>
  );
}
