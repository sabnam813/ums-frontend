import React, { useState, useEffect } from 'react';
import { Link, Navigate, useOutletContext } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';
import '../admin/ApplicationsList.css';

export default function DailyReceiptsHome() {
  const outletCtx = useOutletContext() || {};
  const base = outletCtx.isAdmin ? '/admin/test-prep' : '/test-prep';
  const [testTypes, setTestTypes] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios.get('/test-types')
      .then(res => setTestTypes(res.data.testTypes || []))
      .catch(err => toast.error(err.response?.data?.message || 'Failed to load test types'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="dt-loading">
        <div className="dt-spinner" />
        <p>Loading…</p>
      </div>
    );
  }

  if (testTypes.length === 1) {
    return <Navigate to={`${base}/${testTypes[0].slug}/daily-receipts`} replace />;
  }

  return (
    <div className="apps-list animate-fade">
      <div className="page-header">
        <div>
          <h2>Daily Receipts</h2>
          <p>Pick a test type to open its receipts.</p>
        </div>
      </div>
      <div className="countries-grid">
        {testTypes.map(t => (
          <div className="country-card" key={t._id}>
            <h3 className="cc-name">{t.name}</h3>
            <Link to={`${base}/${t.slug}/daily-receipts`} className="cc-open-btn">
              Open Receipts
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </Link>
          </div>
        ))}
        {testTypes.length === 0 && <p>No test types yet.</p>}
      </div>
    </div>
  );
}
