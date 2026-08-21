import React, { useEffect, useState } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { PageHeader, StatCard, Loading } from '../../components/superadmin/SuperAdminUI';

export default function CacheManagement() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [flushing, setFlushing] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await axios.get('/superadmin/cache');
      setStats(res.data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 10000);
    return () => clearInterval(t);
  }, []);

  const flush = async () => {
    setFlushing(true);
    try {
      const res = await axios.post('/superadmin/cache/flush');
      toast.success(`Flushed ${res.data.cleared} cache entr${res.data.cleared === 1 ? 'y' : 'ies'}`);
      load();
    } finally {
      setFlushing(false);
    }
  };

  if (loading && !stats) return <Loading label="Loading cache stats…" />;
  if (!stats) return null;

  return (
    <div>
      <PageHeader
        title="Cache Management"
        subtitle="In-process cache used to speed up expensive dashboard aggregations"
        actions={<button className="sa-btn sa-btn-danger" onClick={flush} disabled={flushing}>{flushing ? 'Flushing…' : 'Flush Cache'}</button>}
      />

      <div className="sa-grid">
        <StatCard label="Cached Keys" value={stats.keys} color="#2E4F8F" />
        <StatCard label="Hits" value={stats.hits} color="#22c55e" />
        <StatCard label="Misses" value={stats.misses} color="#f59e0b" />
        <StatCard label="Hit Rate" value={`${stats.hitRate}%`} color="#F08641" />
      </div>

      <div className="sa-card">
        <div className="sa-panel-title">Cached Entries</div>
        <div className="sa-table-wrap">
          <table className="sa-table">
            <thead><tr><th>Key</th><th>Expires In</th></tr></thead>
            <tbody>
              {stats.entries.length === 0 && <tr><td colSpan={2} className="sa-empty-row">Cache is empty</td></tr>}
              {stats.entries.map(e => (
                <tr key={e.key}>
                  <td className="sa-mono">{e.key}</td>
                  <td>{Math.round(e.expiresInMs / 1000)}s</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
