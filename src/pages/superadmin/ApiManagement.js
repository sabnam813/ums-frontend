import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { PageHeader, StatCard, Loading, Badge } from '../../components/superadmin/SuperAdminUI';

export default function ApiManagement() {
  const [routes, setRoutes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [methodFilter, setMethodFilter] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const res = await axios.get('/superadmin/api-routes');
      setRoutes(res.data.routes);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  if (loading) return <Loading label="Introspecting registered API routes…" />;

  const methods = Array.from(new Set(routes.map(r => r.method))).sort();
  const filtered = routes.filter(r =>
    r.path.toLowerCase().includes(search.toLowerCase()) && (!methodFilter || r.method === methodFilter)
  );
  const totalRequests = routes.reduce((s, r) => s + r.requests24h, 0);
  const totalErrors = routes.reduce((s, r) => s + r.errors24h, 0);

  return (
    <div>
      <PageHeader title="API Management" subtitle="Every registered endpoint, with live 24h traffic" actions={<button className="sa-btn" onClick={load}>Refresh</button>} />

      <div className="sa-grid">
        <StatCard label="Registered Endpoints" value={routes.length} color="#2E4F8F" />
        <StatCard label="Requests (24h)" value={totalRequests.toLocaleString()} color="#F08641" />
        <StatCard label="Errors (24h)" value={totalErrors.toLocaleString()} color={totalErrors > 0 ? '#ef4444' : '#22c55e'} />
      </div>

      <div className="sa-card">
        <div className="sa-toolbar">
          <input className="sa-input sa-search-input" placeholder="Search paths…" value={search} onChange={e => setSearch(e.target.value)} />
          <select className="sa-select" value={methodFilter} onChange={e => setMethodFilter(e.target.value)}>
            <option value="">All methods</option>
            {methods.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
        <div className="sa-table-wrap">
          <table className="sa-table">
            <thead><tr><th>Method</th><th>Path</th><th>Requests (24h)</th><th>Errors (24h)</th></tr></thead>
            <tbody>
              {filtered.length === 0 && <tr><td colSpan={4} className="sa-empty-row">No routes match your search</td></tr>}
              {filtered.map((r, i) => (
                <tr key={i}>
                  <td><Badge tone="neutral">{r.method}</Badge></td>
                  <td className="sa-mono">{r.path}</td>
                  <td>{r.requests24h}</td>
                  <td>{r.errors24h > 0 ? <Badge tone="critical">{r.errors24h}</Badge> : '0'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
