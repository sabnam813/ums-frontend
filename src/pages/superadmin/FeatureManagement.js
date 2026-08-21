import React, { useEffect, useState } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { PageHeader, Loading, Toggle } from '../../components/superadmin/SuperAdminUI';

export default function FeatureManagement() {
  const [flags, setFlags] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await axios.get('/features');
      setFlags(res.data.flags || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const toggle = async (flag) => {
    setUpdating(flag.key);
    try {
      const res = await axios.put(`/features/${flag.key}`, { enabled: !flag.enabled });
      setFlags(fs => fs.map(f => f.key === flag.key ? res.data.flag : f));
      toast.success(`${flag.label} ${res.data.flag.enabled ? 'enabled' : 'disabled'}`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update feature flag');
    } finally {
      setUpdating(null);
    }
  };

  if (loading) return <Loading label="Loading feature flags…" />;

  return (
    <div>
      <PageHeader title="Feature Management" subtitle="Enable or disable application features globally, without a deploy" />
      <div className="sa-grid">
        {flags.map(flag => (
          <div className="sa-card" key={flag.key}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{flag.label}</div>
                <div style={{ fontSize: '0.78rem', color: 'var(--sa-text-dim)', marginTop: 4 }}>{flag.description}</div>
              </div>
              <Toggle checked={flag.enabled} onChange={() => toggle(flag)} disabled={updating === flag.key} />
            </div>
          </div>
        ))}
        {flags.length === 0 && <p style={{ color: 'var(--sa-text-dim)' }}>No feature flags configured yet.</p>}
      </div>
    </div>
  );
}
