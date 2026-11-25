import React, { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import { PageHeader, Loading, Badge, Pagination } from '../../components/superadmin/SuperAdminUI';
import { MiniLineChart } from '../../components/superadmin/charts';

const PAGE_SIZE = 30;

export default function CrashErrorMonitoring() {
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [series, setSeries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(null);
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [logsRes, seriesRes] = await Promise.all([
        axios.get('/superadmin/logs', { params: { type: 'error,crash', page, limit: PAGE_SIZE, path: search || undefined } }),
        axios.get('/superadmin/overview/timeseries'),
      ]);
      setLogs(logsRes.data.logs);
      setTotal(logsRes.data.total);
      setSeries(seriesRes.data.series.map(s => ({ ...s, label: new Date(s.hour).getHours() + ':00' })));
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [search]);

  return (
    <div>
      <PageHeader title="Crash & Error Monitoring" subtitle="Unhandled errors, failed requests, and process-level crashes" />

      <div className="sa-card sa-card-wide" style={{ marginBottom: 20 }}>
        <div className="sa-panel-title">Error Volume (Last 24 Hours)</div>
        <MiniLineChart data={series} xKey="label" series={[{ key: 'errors', label: 'Errors', color: '#ef4444' }]} />
      </div>

      <div className="sa-toolbar">
        <input className="sa-input sa-search-input" placeholder="Filter by path…" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {loading ? <Loading /> : (
        <>
          <div className="sa-table-wrap">
            <table className="sa-table">
              <thead><tr><th>Time</th><th>Type</th><th>Path</th><th>Status</th><th>Message</th></tr></thead>
              <tbody>
                {logs.length === 0 && <tr><td colSpan={5} className="sa-empty-row">No errors or crashes recorded. Good sign!</td></tr>}
                {logs.map(l => (
                  <React.Fragment key={l._id}>
                    <tr onClick={() => setExpanded(expanded === l._id ? null : l._id)} style={{ cursor: 'pointer' }}>
                      <td>{new Date(l.createdAt).toLocaleString()}</td>
                      <td><Badge tone={l.type === 'crash' ? 'critical' : 'warning'}>{l.type}</Badge></td>
                      <td className="sa-mono">{l.method} {l.path}</td>
                      <td>{l.statusCode || '—'}</td>
                      <td>{l.message}</td>
                    </tr>
                    {expanded === l._id && l.stack && (
                      <tr><td colSpan={5}><pre className="sa-code-block">{l.stack}</pre></td></tr>
                    )}
                  </React.Fragment>
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
