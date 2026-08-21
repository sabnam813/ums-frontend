import React from 'react';
import './Charts.css';

export function BarBreakdown({ data, colors = {}, defaultColor = 'var(--uca-blue)', height = 22 }) {
  const entries = Object.entries(data || {}).filter(([, v]) => v > 0);
  const max = Math.max(1, ...entries.map(([, v]) => v));

  if (entries.length === 0) {
    return <div className="chart-empty">No data yet</div>;
  }

  return (
    <div className="bar-breakdown">
      {entries.map(([label, value]) => (
        <div className="bar-breakdown-row" key={label}>
          <span className="bar-breakdown-label">{label}</span>
          <div className="bar-breakdown-track" style={{ height }}>
            <div
              className="bar-breakdown-fill"
              style={{
                width: `${Math.max(4, (value / max) * 100)}%`,
                background: colors[label] || defaultColor,
              }}
            />
          </div>
          <span className="bar-breakdown-value">{value}</span>
        </div>
      ))}
    </div>
  );
}

export function TrendChart({ data, width = 320, height = 110, color = 'var(--uca-blue)' }) {
  if (!data || data.length === 0) return <div className="chart-empty">No data yet</div>;

  const max = Math.max(1, ...data.map(d => d.count));
  const barWidth = width / data.length;
  const padding = 18;
  const chartHeight = height - padding;

  return (
    <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="xMidYMid meet" className="trend-chart">
      {data.map((d, i) => {
        const barHeight = Math.max(2, (d.count / max) * (chartHeight - 16));
        const x = i * barWidth + barWidth * 0.2;
        const w = barWidth * 0.6;
        const y = chartHeight - barHeight;
        return (
          <g key={i}>
            <rect x={x} y={y} width={w} height={barHeight} rx={3} fill={color} opacity={0.85} />
            <text x={x + w / 2} y={y - 6} textAnchor="middle" fontSize="10" fontWeight="700" fill="var(--gray-600)">
              {d.count > 0 ? d.count : ''}
            </text>
            <text x={x + w / 2} y={height - 2} textAnchor="middle" fontSize="10" fill="var(--gray-400)">
              {d.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export function RingStat({ percent = 0, size = 64, stroke = 8, color = 'var(--uca-blue)', label }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - Math.min(100, Math.max(0, percent)) / 100);

  return (
    <div className="ring-stat" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--gray-100)" strokeWidth={stroke} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke}
          strokeDasharray={c} strokeDashoffset={offset} strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <div className="ring-stat-label">
        <span className="ring-stat-value">{Math.round(percent)}%</span>
        {label && <span className="ring-stat-sub">{label}</span>}
      </div>
    </div>
  );
}
