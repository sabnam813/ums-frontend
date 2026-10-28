import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { PageHeader, StatCard, Loading } from '../../components/superadmin/SuperAdminUI';

export default function DatabaseManagement() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const res = await axios.get('/superadmin/database');
      setData(res.data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  if (loading) return <Loading label="Loading database stats…" />;
  if (!data) return null;

  if (!data.connected) {
    return (
      <div>
        <PageHeader title="Database Management" subtitle="MongoDB connection status and collection statistics" />
        <div className="sa-alert-banner critical">Database is currently disconnected.</div>
      </div>
    );
  }

  const filtered = data.collections.filter(c => c.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div>
      <PageHeader
        title="Database Management"
        subtitle={`${data.host}/${data.name}`}
        actions={<button className="sa-btn" onClick={load}>Refresh</button>}
      />

      <div className="sa-grid">
        <StatCard label="Collections" value={data.stats.collections} color="#2E4F8F" />
        <StatCard label="Documents" value={data.stats.objects.toLocaleString()} color="#F08641" />
        <StatCard label="Data Size" value={`${data.stats.dataSizeMb} MB`} color="#f59e0b" />
        <StatCard label="Storage Size" value={`${data.stats.storageSizeMb} MB`} sub={`${data.stats.indexes} indexes · ${data.stats.indexSizeMb} MB`} color="#6B5B95" />
      </div>

      <div className="sa-card">
        <div className="sa-panel-title">Collections</div>
        <div className="sa-toolbar">
          <input className="sa-input sa-search-input" placeholder="Search collections…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="sa-table-wrap">
          <table className="sa-table">
            <thead><tr><th>Collection</th><th>Documents</th></tr></thead>
            <tbody>
              {filtered.length === 0 && <tr><td colSpan={2} className="sa-empty-row">No collections match your search</td></tr>}
              {filtered.map(c => (
                <tr key={c.name}>
                  <td className="sa-mono">{c.name}</td>
                  <td>{c.documents === null ? '—' : c.documents.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
