import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { PageHeader, StatCard, Loading } from '../../components/superadmin/SuperAdminUI';

export default function StorageManagement() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const res = await axios.get('/superadmin/storage');
      setData(res.data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  if (loading) return <Loading label="Loading storage info…" />;
  if (!data) return null;

  return (
    <div>
      <PageHeader title="Storage Management" subtitle="Disk usage for backups and the database" actions={<button className="sa-btn" onClick={load}>Refresh</button>} />

      <div className="sa-grid">
        <StatCard label="Backup Storage" value={`${data.backups.sizeMb} MB`} sub={`${data.backups.files} file(s)`} color="#2E4F8F" />
        <StatCard label="Database Storage" value={data.database.storageSizeMb !== null ? `${data.database.storageSizeMb} MB` : '—'} color="#F08641" />
        {data.diskFree && <StatCard label="Free Disk Space" value={`${data.diskFree.freeGb} GB`} color="#22c55e" />}
      </div>

      <div className="sa-card">
        <div className="sa-panel-title">Backup Directory</div>
        <div className="sa-detail-row"><span className="sa-detail-label">Path</span><span className="sa-detail-value sa-mono">{data.backups.path}</span></div>
        <div className="sa-detail-row"><span className="sa-detail-label">Total size</span><span className="sa-detail-value">{data.backups.sizeMb} MB</span></div>
        <div className="sa-detail-row"><span className="sa-detail-label">Files</span><span className="sa-detail-value">{data.backups.files}</span></div>
      </div>
    </div>
  );
}
