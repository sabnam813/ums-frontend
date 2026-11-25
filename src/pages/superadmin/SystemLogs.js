import React, { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { PageHeader, Loading, Badge, Pagination, statusTone } from '../../components/superadmin/SuperAdminUI';

const PAGE_SIZE = 50;

export default function SystemLogs() {
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ pathFilter: '', level: '', statusCode: '' });
  const [expanded, setExpanded] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get('/superadmin/logs', {
        params: {
          type: 'request', page, limit: PAGE_SIZE,
          path: filters.pathFilter || undefined,
          level: filters.level || undefined,
          statusCode: filters.statusCode || undefined,
        },
      });
      setLogs(res.data.logs);
      setTotal(res.data.total);
    } catch {
      toast.error('Failed to load system logs');
    } finally {
      setLoading(false);
    }
  }, [page, filters]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [filters]);

  const handleClear = async () => {
    if (!window.confirm('Clear system logs older than 30 days?')) return;
    await axios.delete('/superadmin/logs', { params: { olderThanDays: 30 } });
    toast.success('Old logs cleared');
    load();
  };

  const exportCsv = () => {
    const header = ['Time', 'Method', 'Path', 'Status', 'Duration (ms)', 'IP'];
    const rows = logs.map(l => [new Date(l.createdAt).toISOString(), l.method, l.path, l.statusCode, l.durationMs, l.ip]);
    const csv = [header, ...rows].map(r => r.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `system-logs-page${page}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <PageHeader
        title="System Logs"
        subtitle="Every HTTP request handled by the API, with timing and status"
        actions={<>
          <button className="sa-btn" onClick={exportCsv}>Export CSV</button>
          <button className="sa-btn sa-btn-danger" onClick={handleClear}>Clear Old Logs</button>
        </>}
      />

      <div className="sa-toolbar">
        <input className="sa-input sa-search-input" placeholder="Filter by path…"
          value={filters.pathFilter} onChange={e => setFilters(f => ({ ...f, pathFilter: e.target.value }))} />
        <select className="sa-select" value={filters.level} onChange={e => setFilters(f => ({ ...f, level: e.target.value }))}>
          <option value="">All levels</option>
          <option value="info">Info</option>
          <option value="warn">Warn</option>
          <option value="error">Error</option>
        </select>
        <input className="sa-input" style={{ width: 110 }} placeholder="Status code"
          value={filters.statusCode} onChange={e => setFilters(f => ({ ...f, statusCode: e.target.value }))} />
      </div>

      {loading ? <Loading /> : (
        <>
          <div className="sa-table-wrap">
            <table className="sa-table">
              <thead><tr><th>Time</th><th>Method</th><th>Path</th><th>Status</th><th>Duration</th><th>IP</th></tr></thead>
              <tbody>
                {logs.length === 0 && <tr><td colSpan={6} className="sa-empty-row">No logs match your filters</td></tr>}
                {logs.map(l => (
                  <tr key={l._id} onClick={() => setExpanded(expanded === l._id ? null : l._id)} style={{ cursor: 'pointer' }}>
                    <td>{new Date(l.createdAt).toLocaleString()}</td>
                    <td className="sa-mono">{l.method}</td>
                    <td className="sa-mono">{l.path}</td>
                    <td><Badge tone={statusTone(l.statusCode)}>{l.statusCode}</Badge></td>
                    <td>{l.durationMs}ms</td>
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
