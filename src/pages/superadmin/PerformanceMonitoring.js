import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { PageHeader, Loading, Badge } from '../../components/superadmin/SuperAdminUI';
import { MiniLineChart } from '../../components/superadmin/charts';

export default function PerformanceMonitoring() {
  const [routes, setRoutes] = useState([]);
  const [series, setSeries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const [perfRes, seriesRes] = await Promise.all([
        axios.get('/superadmin/performance'),
        axios.get('/superadmin/overview/timeseries'),
      ]);
      setRoutes(perfRes.data.routes);
      setSeries(seriesRes.data.series.map(s => ({ ...s, label: new Date(s.hour).getHours() + ':00' })));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  if (loading) return <Loading label="Loading performance data…" />;

  const filtered = routes.filter(r => r.path.toLowerCase().includes(search.toLowerCase()));

  return (
    <div>
      <PageHeader title="Performance Monitoring" subtitle="Average response time and request volume, last 24 hours" actions={<button className="sa-btn" onClick={load}>Refresh</button>} />

      <div className="sa-card sa-card-wide" style={{ marginBottom: 20 }}>
        <div className="sa-panel-title">Average Response Time (Last 24 Hours)</div>
        <MiniLineChart data={series} xKey="label" series={[{ key: 'avgMs', label: 'Avg ms', color: '#F08641' }]} />
      </div>

      <div className="sa-card">
        <div className="sa-panel-title">Slowest Endpoints</div>
        <div className="sa-toolbar">
          <input className="sa-input sa-search-input" placeholder="Filter by path…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="sa-table-wrap">
          <table className="sa-table">
            <thead><tr><th>Method</th><th>Path</th><th>Requests</th><th>Avg</th><th>Max</th><th>Errors</th></tr></thead>
            <tbody>
              {filtered.length === 0 && <tr><td colSpan={6} className="sa-empty-row">No traffic recorded in the last 24 hours yet</td></tr>}
              {filtered.map((r, i) => (
                <tr key={i}>
                  <td className="sa-mono">{r.method}</td>
                  <td className="sa-mono">{r.path}</td>
                  <td>{r.count}</td>
                  <td>{r.avgMs}ms</td>
                  <td>{r.maxMs}ms</td>
                  <td>{r.errors > 0 ? <Badge tone="critical">{r.errors}</Badge> : '0'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
