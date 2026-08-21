import React, { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { PageHeader, Loading, Badge, Pagination } from '../../components/superadmin/SuperAdminUI';

const PAGE_SIZE = 50;

export default function AuditCenter() {
  const [logs, setLogs] = useState([]);
  const [actions, setActions] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ username: '', action: '' });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get('/logs', {
        params: { page, limit: PAGE_SIZE, username: filters.username || undefined, action: filters.action || undefined },
      });
      setLogs(res.data.logs);
      setTotal(res.data.total);
      setActions(res.data.actions || []);
    } catch {
      toast.error('Failed to load audit logs');
    } finally {
      setLoading(false);
    }
  }, [page, filters]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [filters]);

  const clearOld = async () => {
    if (!window.confirm('Clear audit logs older than 90 days?')) return;
    const res = await axios.delete('/logs/clear', { params: { olderThanDays: 90 } });
    toast.success(`${res.data.deleted} old log(s) cleared`);
    load();
  };

  return (
    <div>
      <PageHeader
        title="Audit Center"
        subtitle="Every meaningful action taken by users and admins across the system"
        actions={<button className="sa-btn sa-btn-danger" onClick={clearOld}>Clear Logs &gt;90d</button>}
      />

      <div className="sa-toolbar">
        <input className="sa-input sa-search-input" placeholder="Filter by username…" value={filters.username} onChange={e => setFilters(f => ({ ...f, username: e.target.value }))} />
        <select className="sa-select" value={filters.action} onChange={e => setFilters(f => ({ ...f, action: e.target.value }))}>
          <option value="">All actions</option>
          {actions.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
      </div>

      {loading ? <Loading /> : (
        <>
          <div className="sa-table-wrap">
            <table className="sa-table">
              <thead><tr><th>Time</th><th>Actor</th><th>Action</th><th>Message</th><th>IP</th></tr></thead>
              <tbody>
                {logs.length === 0 && <tr><td colSpan={5} className="sa-empty-row">No matching audit entries</td></tr>}
                {logs.map(l => (
                  <tr key={l._id}>
                    <td>{new Date(l.createdAt).toLocaleString()}</td>
                    <td>{l.actor?.username || '—'} <Badge tone="neutral">{l.actor?.role}</Badge></td>
                    <td className="sa-mono">{l.action}</td>
                    <td>{l.message}</td>
                    <td className="sa-mono">{l.ip || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={page} pageSize={PAGE_SIZE} total={total} onPage={setPage} />
        </>
      )}
    </div>
  );
}
