import React, { useEffect, useState } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { PageHeader, Loading, Badge } from '../../components/superadmin/SuperAdminUI';

export default function BackgroundJobs() {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(null);
  const [history, setHistory] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await axios.get('/superadmin/jobs');
      setJobs(res.data.jobs);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const runJob = async (key) => {
    setRunning(key);
    try {
      const res = await axios.post(`/superadmin/jobs/${key}/run`);
      toast.success(res.data.message || 'Job completed');
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Job failed');
    } finally {
      setRunning(null);
    }
  };

  const viewHistory = async (key) => {
    const res = await axios.get(`/superadmin/jobs/${key}/history`);
    setHistory({ key, runs: res.data.runs });
  };

  if (loading) return <Loading label="Loading background jobs…" />;

  return (
    <div>
      <PageHeader title="Background Jobs" subtitle="Scheduled maintenance tasks" />

      <div className="sa-table-wrap" style={{ marginBottom: 20 }}>
        <table className="sa-table">
          <thead><tr><th>Job</th><th>Schedule</th><th>Last Run</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>
            {jobs.map(j => (
              <tr key={j.key}>
                <td style={{ fontWeight: 600 }}>{j.label}</td>
                <td>{j.schedule}</td>
                <td>{j.lastRun ? `${new Date(j.lastRun.at).toLocaleString()} (${j.lastRun.durationMs}ms)` : 'Never run'}</td>
                <td>{j.lastRun ? <Badge tone={j.lastRun.status === 'success' ? 'success' : 'critical'}>{j.lastRun.status}</Badge> : <Badge tone="neutral">Pending</Badge>}</td>
                <td style={{ display: 'flex', gap: 6 }}>
                  <button className="sa-btn sa-btn-primary" onClick={() => runJob(j.key)} disabled={running === j.key}>
                    {running === j.key ? 'Running…' : 'Run Now'}
                  </button>
                  <button className="sa-btn" onClick={() => viewHistory(j.key)}>History</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {history && (
        <div className="sa-card">
          <div className="sa-panel-title">
            History: {jobs.find(j => j.key === history.key)?.label}
            <button className="sa-btn" onClick={() => setHistory(null)}>Close</button>
          </div>
          <div className="sa-table-wrap">
            <table className="sa-table">
              <thead><tr><th>Time</th><th>Trigger</th><th>Status</th><th>Duration</th><th>Message</th></tr></thead>
              <tbody>
                {history.runs.length === 0 && <tr><td colSpan={5} className="sa-empty-row">No runs recorded yet</td></tr>}
                {history.runs.map(r => (
                  <tr key={r._id}>
                    <td>{new Date(r.createdAt).toLocaleString()}</td>
                    <td><Badge tone="neutral">{r.trigger}</Badge></td>
                    <td><Badge tone={r.status === 'success' ? 'success' : 'critical'}>{r.status}</Badge></td>
                    <td>{r.durationMs}ms</td>
                    <td>{r.message}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
