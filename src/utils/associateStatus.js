export const STATUS_COLORS = {
  Shareholder: '#16a34a',
  Associate: '#111827',
  Terminated: '#dc2626',
  Closed: '#dc2626',
  Inactive: '#dc2626',
};

export function normKey(v) {
  return String(v || '').toLowerCase().replace(/[\s,.]+/g, ' ').trim();
}

export function buildStatusMap(list) {
  const m = new Map();
  (list || []).forEach(a => {
    [a.name, ...(a.aliases || [])].forEach(n => {
      const k = normKey(n);
      if (k && !m.has(k)) m.set(k, a.status);
    });
  });
  return m;
}

export function statusColor(status) {
  return STATUS_COLORS[status] || undefined;
}

export function hexToRgb(hex) {
  const h = String(hex || '').replace('#', '');
  if (h.length !== 6) return null;
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

export function htmlStyleAttr(color) {
  return color ? ` style="color:${color};font-weight:600"` : '';
}

export function pdfColorHook(keys, assocKeys, resolve) {
  const idx = keys.map((k, i) => (assocKeys.includes(k) ? i : -1)).filter(i => i >= 0);
  return (d) => {
    if (d.section !== 'body' || !idx.includes(d.column.index)) return;
    const rgb = hexToRgb(resolve(d.cell.raw, d.row.index));
    if (rgb) {
      d.cell.styles.textColor = rgb;
      d.cell.styles.fontStyle = 'bold';
    }
  };
}
