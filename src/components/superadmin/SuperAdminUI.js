import React from 'react';

export function PageHeader({ title, subtitle, actions }) {
  return (
    <div className="sa-page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 12 }}>
      <div>
        <h1 className="sa-page-title">{title}</h1>
        {subtitle && <p className="sa-page-subtitle">{subtitle}</p>}
      </div>
      {actions && <div style={{ display: 'flex', gap: 8 }}>{actions}</div>}
    </div>
  );
}

export function StatCard({ label, value, sub, color, icon }) {
  return (
    <div className="sa-card">
      {icon && <div className="sa-stat-icon" style={{ background: `${color}22`, color }}>{icon}</div>}
      <div className="sa-stat-label">{label}</div>
      <div className="sa-stat-value">{value}</div>
      {sub && <div className="sa-stat-sub">{sub}</div>}
    </div>
  );
}

export function Badge({ tone = 'neutral', children }) {
  return <span className={`sa-badge sa-badge-${tone}`}>{children}</span>;
}

export function Loading({ label = 'Loading…' }) {
  return <div className="sa-loading">{label}</div>;
}

export function Pagination({ page, pageSize, total, onPage }) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  return (
    <div className="sa-pagination">
      <button className="sa-btn" disabled={page <= 1} onClick={() => onPage(page - 1)}>Prev</button>
      <span>Page {page} of {totalPages} &middot; {total} total</span>
      <button className="sa-btn" disabled={page >= totalPages} onClick={() => onPage(page + 1)}>Next</button>
    </div>
  );
}

export function Toggle({ checked, onChange, disabled }) {
  return (
    <label className="sa-switch">
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} disabled={disabled} />
      <span className="sa-switch-slider" />
    </label>
  );
}

export function timeAgo(dateStr) {
  if (!dateStr) return '—';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export function statusTone(statusCode) {
  if (!statusCode) return 'neutral';
  if (statusCode >= 500) return 'critical';
  if (statusCode >= 400) return 'warning';
  return 'success';
}
