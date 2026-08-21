import React, { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import { PageHeader, StatCard, Loading, Badge } from '../../components/superadmin/SuperAdminUI';
import { MiniLineChart } from '../../components/superadmin/charts';

function formatUptime(seconds) {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export default function InfrastructureDashboard() {
  const [data, setData] = useState(null);
  const [series, setSeries] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const [overviewRes, seriesRes] = await Promise.all([
        axios.get('/superadmin/overview'),
        axios.get('/superadmin/overview/timeseries'),
      ]);
      setData(overviewRes.data);
      setSeries(seriesRes.data.series.map(s => ({ ...s, label: new Date(s.hour).getHours() + ':00' })));
    } catch {
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, [load]);

  if (loading && !data) return <Loading label="Loading infrastructure overview…" />;
  if (!data) return null;

  const memPct = Math.round((data.server.memoryUsageMb / data.server.totalMemoryMb) * 100);

  return (
    <div>
      <PageHeader
        title="Infrastructure Dashboard"
        subtitle="Real-time server, database, and traffic overview"
      />

      {data.maintenanceMode.enabled && (
        <div className="sa-alert-banner warning">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
          Maintenance mode is currently <strong>enabled</strong>. Regular users cannot access the app.
        </div>
      )}

      <div className="sa-grid">
        <StatCard label="Server Uptime" value={formatUptime(data.server.uptimeSeconds)} sub={`Node ${data.server.nodeVersion} · ${data.server.environment}`} color="#2E4F8F" />
        <StatCard label="Memory Usage" value={`${data.server.memoryUsageMb} MB`} sub={`${memPct}% of ${data.server.totalMemoryMb} MB total`} color="#F08641" />
        <StatCard
          label="Database"
          value={data.database.connected ? 'Connected' : 'Disconnected'}
          sub={data.database.host ? `${data.database.host}/${data.database.name}` : 'No host info'}
          color={data.database.connected ? '#22c55e' : '#ef4444'}
        />
        <StatCard label="Requests (24h)" value={data.traffic.requests24h.toLocaleString()} sub={`${data.traffic.errors24h} error(s) · avg ${data.traffic.avgResponseMs}ms`} color="#f59e0b" />
      </div>

      <div className="sa-grid">
        <StatCard label="Total Users" value={data.counts.users.toLocaleString()} color="#2E4F8F" />
        <StatCard label="Trash Items" value={data.counts.trashItems.toLocaleString()} color="#6B5B95" />
        <StatCard label="Unread Alerts" value={data.alerts.unread} sub={`${data.alerts.critical} critical`} color={data.alerts.critical > 0 ? '#ef4444' : '#22c55e'} />
        <StatCard label="CPU Cores" value={data.server.cpuCount} sub={`Load avg: ${data.server.loadAvg.map(l => l.toFixed(2)).join(', ')}`} color="#F08641" />
      </div>

      <div className="sa-card sa-card-wide" style={{ marginBottom: 20 }}>
        <div className="sa-panel-title">Requests &amp; Errors (Last 24 Hours)</div>
        <MiniLineChart
          data={series}
          xKey="label"
          series={[
            { key: 'requests', label: 'Requests', color: '#2E4F8F' },
            { key: 'errors', label: 'Errors', color: '#ef4444' },
          ]}
        />
      </div>

      <div className="sa-card">
        <div className="sa-panel-title">Background Jobs</div>
        <div className="sa-table-wrap">
          <table className="sa-table">
            <thead><tr><th>Job</th><th>Schedule</th><th>Last Run</th><th>Status</th></tr></thead>
            <tbody>
              {data.jobs.map(j => (
                <tr key={j.key}>
                  <td>{j.label}</td>
                  <td>{j.schedule}</td>
                  <td>{j.lastRun ? new Date(j.lastRun.at).toLocaleString() : 'Never run'}</td>
                  <td>{j.lastRun ? <Badge tone={j.lastRun.status === 'success' ? 'success' : 'critical'}>{j.lastRun.status}</Badge> : <Badge tone="neutral">Pending</Badge>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
