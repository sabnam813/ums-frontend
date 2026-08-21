import React from 'react';

export function MiniLineChart({ data, xKey, series, height = 160, formatValue }) {
  const width = 600;
  const padding = { top: 12, right: 12, bottom: 24, left: 12 };
  const innerW = width - padding.left - padding.right;
  const innerH = height - padding.top - padding.bottom;

  if (!data || data.length === 0) {
    return <div className="sa-chart-empty">No data yet</div>;
  }

  const allValues = data.flatMap(d => series.map(s => Number(d[s.key]) || 0));
  const maxVal = Math.max(1, ...allValues);

  const points = (key) => data.map((d, i) => {
    const x = padding.left + (i / Math.max(1, data.length - 1)) * innerW;
    const y = padding.top + innerH - ((Number(d[key]) || 0) / maxVal) * innerH;
    return `${x},${y}`;
  }).join(' ');

  return (
    <div className="sa-chart-wrap">
      <svg viewBox={`0 0 ${width} ${height}`} className="sa-chart-svg" preserveAspectRatio="none">
        {[0.25, 0.5, 0.75, 1].map(f => (
          <line key={f} x1={padding.left} x2={width - padding.right}
            y1={padding.top + innerH * (1 - f)} y2={padding.top + innerH * (1 - f)}
            className="sa-chart-gridline" />
        ))}
        {series.map(s => (
          <polyline key={s.key} points={points(s.key)} fill="none" stroke={s.color} strokeWidth="2" />
        ))}
      </svg>
      <div className="sa-chart-legend">
        {series.map(s => (
          <span key={s.key} className="sa-chart-legend-item">
            <span className="sa-chart-dot" style={{ background: s.color }} />
            {s.label}
          </span>
        ))}
      </div>
    </div>
  );
}

export function MiniBarChart({ data, labelKey, valueKey, color = 'var(--sa-accent)', height = 160 }) {
  if (!data || data.length === 0) return <div className="sa-chart-empty">No data yet</div>;
  const maxVal = Math.max(1, ...data.map(d => Number(d[valueKey]) || 0));
  return (
    <div className="sa-bar-chart" style={{ height }}>
      {data.map((d, i) => {
        const pct = ((Number(d[valueKey]) || 0) / maxVal) * 100;
        return (
          <div className="sa-bar-col" key={i} title={`${d[labelKey]}: ${d[valueKey]}`}>
            <div className="sa-bar" style={{ height: `${pct}%`, background: color }} />
            <span className="sa-bar-label">{d[labelKey]}</span>
          </div>
        );
      })}
    </div>
  );
}

export function Sparkline({ values, color = 'var(--sa-accent)', width = 100, height = 28 }) {
  if (!values || values.length === 0) return null;
  const max = Math.max(1, ...values);
  const points = values.map((v, i) => {
    const x = (i / Math.max(1, values.length - 1)) * width;
    const y = height - (v / max) * height;
    return `${x},${y}`;
  }).join(' ');
  return (
    <svg width={width} height={height} className="sa-sparkline">
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" />
    </svg>
  );
}
