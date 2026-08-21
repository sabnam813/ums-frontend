import React, { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { PageHeader, Loading, Badge, Pagination, timeAgo } from '../../components/superadmin/SuperAdminUI';

const PAGE_SIZE = 30;

export default function NotificationCenter() {
  const [alerts, setAlerts] = useState([]);
  const [total, setTotal] = useState(0);
  const [unread, setUnread] = useState(0);
  const [page, setPage] = useState(1);
  const [severity, setSeverity] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get('/superadmin/alerts', { params: { page, limit: PAGE_SIZE, severity: severity || undefined } });
      setAlerts(res.data.alerts);
      setTotal(res.data.total);
      setUnread(res.data.unread);
    } finally {
      setLoading(false);
    }
  }, [page, severity]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [severity]);

  const markRead = async (id) => {
    await axios.put(`/superadmin/alerts/${id}/read`);
    load();
  };
  const markAllRead = async () => {
    await axios.put('/superadmin/alerts/read-all');
    toast.success('All alerts marked as read');
    load();
  };
  const clearRead = async () => {
    if (!window.confirm('Delete all read alerts?')) return;
    const res = await axios.delete('/superadmin/alerts');
    toast.success(`${res.data.deleted} alert(s) cleared`);
    load();
  };

  return (
    <div>
      <PageHeader
        title="Notification Center"
        subtitle={`${unread} unread critical/system alert(s)`}
        actions={<>
          <button className="sa-btn" onClick={markAllRead}>Mark All Read</button>
          <button className="sa-btn sa-btn-danger" onClick={clearRead}>Clear Read</button>
        </>}
      />

      <div className="sa-toolbar">
        <select className="sa-select" value={severity} onChange={e => setSeverity(e.target.value)}>
          <option value="">All severities</option>
          <option value="critical">Critical</option>
          <option value="warning">Warning</option>
          <option value="info">Info</option>
        </select>
      </div>

      {loading ? <Loading /> : (
        <>
          <div className="sa-table-wrap">
            <table className="sa-table">
              <thead><tr><th></th><th>Severity</th><th>Title</th><th>Message</th><th>Source</th><th>When</th><th></th></tr></thead>
              <tbody>
                {alerts.length === 0 && <tr><td colSpan={7} className="sa-empty-row">No alerts. All clear</td></tr>}
                {alerts.map(a => (
                  <tr key={a._id} style={{ opacity: a.read ? 0.6 : 1 }}>
                    <td><span className={`sa-dot sa-dot-${a.severity === 'critical' ? 'critical' : a.severity === 'warning' ? 'warning' : 'success'}`} /></td>
                    <td><Badge tone={a.severity === 'critical' ? 'critical' : a.severity === 'warning' ? 'warning' : 'neutral'}>{a.severity}</Badge></td>
                    <td style={{ fontWeight: 600 }}>{a.title}</td>
                    <td>{a.message}</td>
                    <td><Badge tone="neutral">{a.source}</Badge></td>
                    <td>{timeAgo(a.createdAt)}</td>
                    <td>{!a.read && <button className="sa-btn" onClick={() => markRead(a._id)}>Mark Read</button>}</td>
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
