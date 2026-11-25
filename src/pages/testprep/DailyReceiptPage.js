import React, { useState, useEffect, useCallback, useMemo } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { isPaidStatus } from '../../utils/paymentStatusHelper';
import './DailyReceiptPage.css';

const ORG = 'UniConsultants Alliance';
const BILL_NAMES = { bc: 'British Council', acc: 'Accounting', sum: 'Summary' };

function todayISO() {
  return format(new Date(), 'yyyy-MM-dd');
}

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function money(v) {
  return num(v).toLocaleString('en-IN');
}

function iso(d) {
  if (!d) return '';
  const x = new Date(d);
  return isNaN(x.getTime()) ? '' : x.toISOString().slice(0, 10);
}

function longDate(s) {
  if (!s) return '';
  const d = new Date(`${String(s).slice(0, 10)}T00:00:00`);
  return isNaN(d.getTime()) ? '' : format(d, 'd-MMMM-yyyy');
}

function shortDate(s) {
  if (!s) return '';
  const d = new Date(`${String(s).slice(0, 10)}T00:00:00`);
  return isNaN(d.getTime()) ? '' : format(d, 'd-MMM-yyyy');
}

function moduleCode(m) {
  const v = String(m || '');
  if (/writing on computer/i.test(v)) return 'CD';
  if (/writing on paper/i.test(v)) return 'CD+P';
  if (/ukvi/i.test(v)) return 'UKVI';
  if (/life\s*skills/i.test(v)) return 'LifeSkills A1';
  return v;
}

function esc(v) {
  return String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

const BC_COLS = [
  ['name', 'Name', 'text'], ['referenceNumber', 'Reference Number', 'text'], ['passportNo', 'Passport No.', 'text'],
  ['examDate', 'Exam Date', 'date'], ['test', 'Test', 'text'], ['type', 'Type', 'text'], ['module', 'Module', 'text'],
  ['place', 'Place', 'text'], ['payable', 'Payable to BCN', 'num'],
];

const ACC_COLS = [
  ['quotedPrice', 'Quoted Price', 'num'], ['collectedPrice', 'Collected Price', 'num'], ['margin', 'Margin', 'num'],
  ['associates', 'Associates', 'text'], ['paidBy', 'Paid by', 'text'], ['collectionDate', 'Date of Collection', 'date'], ['remarks', 'Remarks', 'text'],
];

function Cell({ value, type, onChange, disabled, edited }) {
  if (disabled) {
    if (type === 'num') return <span>{value === '' || value === undefined ? '' : money(value)}</span>;
    if (type === 'date') return <span>{shortDate(value)}</span>;
    return <span>{value}</span>;
  }
  const cls = `drp-in${type === 'num' ? ' num' : ''}${edited ? ' edited' : ''}`;
  if (type === 'num') return <input type="number" step="0.01" className={cls} value={value ?? ''} onChange={e => onChange(e.target.value)} />;
  if (type === 'date') return <input type="date" className={cls} value={String(value || '').slice(0, 10)} onChange={e => onChange(e.target.value)} />;
  return <input type="text" className={cls} value={value ?? ''} onChange={e => onChange(e.target.value)} />;
}

export default function DailyReceiptPage() {
  const [meta, setMeta] = useState(null);
  const [tab, setTab] = useState('edit');
  const [date, setDate] = useState(todayISO());
  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState([]);
  const [perms, setPerms] = useState({ bc: {}, acc: {} });
  const [overrides, setOverrides] = useState({});
  const [manualRows, setManualRows] = useState([]);
  const [sumRows, setSumRows] = useState({});
  const [sumExtra, setSumExtra] = useState([]);
  const [difference, setDifference] = useState('');
  const [paidOn, setPaidOn] = useState('');
  const [signoff, setSignoff] = useState({ preparedBy: '', checkedBy: '', approvedBy: '' });
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [metaError, setMetaError] = useState('');
  const [picked, setPicked] = useState({ bc: true, acc: true, sum: true });

  useEffect(() => {
    axios.get('/daily-receipts/meta')
      .then(res => { setMeta(res.data.testType); setPerms(res.data.perms); })
      .catch(err => { setMetaError(err.response?.data?.message || 'Failed to load Daily Receipt'); setLoading(false); });
  }, []);

  const slug = meta?.slug || 'ielts';
  const canBc = !!perms.bc.view;
  const canAcc = !!perms.acc.view;
  const editBc = canBc && (perms.bc.create || perms.bc.edit);
  const editAcc = canAcc && (perms.acc.create || perms.acc.edit);
  const canDeleteAny = (canBc && perms.bc.delete) || (canAcc && perms.acc.delete);

  const loadDay = useCallback(async (d) => {
    setLoading(true);
    try {
      const res = await axios.get(`/daily-receipts/${slug}/${d}`);
      const doc = res.data.doc || {};
      setRecords(res.data.records || []);
      setPerms(res.data.perms || { bc: {}, acc: {} });
      setOverrides(doc.overrides || {});
      setManualRows(doc.manualRows || []);
      setSumRows(doc.summaryRows || {});
      setSumExtra(doc.summaryExtra || []);
      setDifference(doc.difference || '');
      setPaidOn(iso(doc.paidOn));
      setSignoff({ preparedBy: doc.preparedBy || '', checkedBy: doc.checkedBy || '', approvedBy: doc.approvedBy || '' });
      setDirty(false);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load receipts');
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => { if (meta) loadDay(date); }, [meta, date, loadDay]);

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const res = await axios.get(`/daily-receipts/${slug}/history`);
      setHistory(res.data.history || []);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load history');
    } finally {
      setHistoryLoading(false);
    }
  }, [slug]);

  useEffect(() => { if (meta && tab === 'history') loadHistory(); }, [meta, tab, loadHistory]);

  const deleteReceipt = async (d) => {
    if (!window.confirm(`Delete the receipt of ${longDate(d)}? Its saved edits are removed and its students lose their Accounts Date. Booking data is otherwise untouched.`)) return;
    try {
      await axios.delete(`/daily-receipts/${slug}/${d}`, { params: { full: 'true' } });
      toast.success('Receipt deleted');
      if (d === date) await loadDay(d);
      loadHistory();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete receipt');
    }
  };

  const changeDate = (d) => {
    if (dirty && !window.confirm('Discard unsaved changes?')) return;
    setDate(d);
  };

  const rows = useMemo(() => {
    const auto = records.map(r => {
      const ov = overrides[r._id] || {};
      const paid = isPaidStatus(r.paymentStatus) || /direct/i.test(r.paymentStatus || '');
      const base = {
        id: r._id, auto: true,
        name: r.candidateName || '', referenceNumber: r.referenceNumber || '', passportNo: r.passportNo || '',
        examDate: iso(r.examDate), test: 'IELTS', type: r.module || '', module: moduleCode(r.ieltsModule), place: r.place || '',
        payable: r.paymentAmount ?? 0,
        quotedPrice: r.paymentAmount ?? 0, collectedPrice: paid ? (r.paymentAmount ?? 0) : 0, margin: r.margin ?? 0,
        associates: r.associates || '', paidBy: r.paymentMadeBy || '', collectionDate: date, remarks: '',
      };
      return { ...base, ...ov, id: r._id, auto: true, _ov: ov };
    }).filter(r => !r.excluded);
    const manual = manualRows.filter(r => !r.excluded).map(r => ({
      test: 'IELTS', collectionDate: date, ...r, id: r.rid, auto: false, _ov: r,
    }));
    return [...auto, ...manual];
  }, [records, overrides, manualRows, date]);

  const edit = (row, key, val) => {
    setDirty(true);
    if (row.auto) setOverrides(o => ({ ...o, [row.id]: { ...(o[row.id] || {}), [key]: val } }));
    else setManualRows(list => list.map(r => (r.rid === row.id ? { ...r, [key]: val } : r)));
  };

  const removeRow = (row) => {
    if (!window.confirm(row.auto ? 'Hide this student from the receipts for this date?' : 'Remove this manual row?')) return;
    setDirty(true);
    if (row.auto) setOverrides(o => ({ ...o, [row.id]: { ...(o[row.id] || {}), excluded: true } }));
    else setManualRows(list => list.filter(r => r.rid !== row.id));
  };

  const addRow = () => {
    setDirty(true);
    setManualRows(list => [...list, { rid: `m${Date.now()}${list.length}`, test: 'IELTS', payable: '', quotedPrice: '', collectedPrice: '', margin: '', collectionDate: date }]);
  };

  const hiddenCount = useMemo(() => Object.values(overrides).filter(o => o.excluded).length, [overrides]);

  const restoreHidden = () => {
    setDirty(true);
    setOverrides(o => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, { ...v, excluded: false }])));
  };

  const groups = useMemo(() => {
    const map = new Map();
    rows.forEach(r => {
      const key = `${r.type || ''}|${r.module || ''}`;
      if (!map.has(key)) map.set(key, { key, type: r.type || '', module: r.module || '', count: 0, total: 0, amounts: {} });
      const g = map.get(key);
      g.count += 1;
      g.total += num(r.payable);
      const a = num(r.payable);
      g.amounts[a] = (g.amounts[a] || 0) + 1;
    });
    return [...map.values()].map(g => {
      const common = Object.entries(g.amounts).sort((a, b) => b[1] - a[1])[0];
      return { ...g, autoAmount: common ? Number(common[0]) : 0 };
    }).sort((a, b) => a.key.localeCompare(b.key));
  }, [rows]);

  const setSum = (key, field, val) => {
    setDirty(true);
    setSumRows(s => ({ ...s, [key]: { ...(s[key] || {}), [field]: val } }));
  };

  const setExtra = (rid, field, val) => {
    setDirty(true);
    setSumExtra(list => list.map(r => (r.rid === rid ? { ...r, [field]: val } : r)));
  };

  const addExtra = () => {
    setDirty(true);
    setSumExtra(list => [...list, { rid: `s${Date.now()}${list.length}`, test: 'IELTS', type: '', module: '', amount: '', receivable: '', payableAssociates: '', marginExpected: '', count: '', total: '', remarks: '' }]);
  };

  const removeExtra = (rid) => {
    setDirty(true);
    setSumExtra(list => list.filter(r => r.rid !== rid));
  };

  const sumTable = useMemo(() => {
    const body = groups.map(g => {
      const s = sumRows[g.key] || {};
      return {
        key: g.key, test: 'IELTS', type: g.type, module: g.module,
        amount: s.amount !== undefined && s.amount !== '' ? s.amount : g.autoAmount,
        receivable: s.receivable ?? '', payableAssociates: s.payableAssociates ?? '', marginExpected: s.marginExpected ?? '',
        count: g.count, total: g.total, remarks: s.remarks ?? '',
      };
    });
    const extra = sumExtra.map(e => ({ ...e, extra: true, key: e.rid }));
    const all = [...body, ...extra];
    const tot = all.reduce((t, r) => ({
      count: t.count + num(r.count), total: t.total + num(r.total), receivable: t.receivable + num(r.receivable),
      payableAssociates: t.payableAssociates + num(r.payableAssociates), marginExpected: t.marginExpected + num(r.marginExpected),
    }), { count: 0, total: 0, receivable: 0, payableAssociates: 0, marginExpected: 0 });
    return { body, extra, all, tot };
  }, [groups, sumRows, sumExtra]);

  const autoDifference = sumTable.tot.receivable ? String(sumTable.tot.total - sumTable.tot.receivable) : '';
  const shownDifference = difference !== '' ? difference : autoDifference;

  const bcTotal = rows.reduce((s, r) => s + num(r.payable), 0);
  const accTotals = rows.reduce((t, r) => ({ q: t.q + num(r.quotedPrice), c: t.c + num(r.collectedPrice), m: t.m + num(r.margin) }), { q: 0, c: 0, m: 0 });

  const save = async () => {
    setSaving(true);
    try {
      await axios.put(`/daily-receipts/${slug}/${date}`, {
        overrides, manualRows, summaryRows: sumRows, summaryExtra: sumExtra, difference, paidOn: paidOn || null, ...signoff,
      });
      toast.success('Receipts saved');
      await loadDay(date);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save receipts');
    } finally {
      setSaving(false);
    }
  };

  const resetEdits = async () => {
    if (!window.confirm('Clear all saved manual edits and rows for this date? Student data is not affected.')) return;
    try {
      await axios.delete(`/daily-receipts/${slug}/${date}`);
      toast.success('Saved edits cleared');
      await loadDay(date);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to clear edits');
    }
  };

  const bills = useMemo(() => {
    const out = {};
    out.bc = {
      id: 'bc', sheet: 'British Council', title: `IELTS Registration from ${ORG}`,
      head: ['S.N.', 'NAME', 'REFERENCE NUMBER', 'PASSPORT NO.', 'EXAM DATE', 'TEST', 'TYPE', 'MODULE', 'PLACE', 'Payable to BCN'],
      body: rows.map((r, i) => [i + 1, r.name, r.referenceNumber, r.passportNo, shortDate(r.examDate), r.test, r.type, r.module, r.place, money(r.payable)]),
      foot: ['', '', '', '', '', '', '', '', '', money(bcTotal)],
      raw: rows.map((r, i) => [i + 1, r.name, r.referenceNumber, r.passportNo, shortDate(r.examDate), r.test, r.type, r.module, r.place, num(r.payable)]),
      rawFoot: ['', '', '', '', '', '', '', '', '', bcTotal],
    };
    out.acc = {
      id: 'acc', sheet: 'Accounting', title: `Accounting Calculations (Dated on: ${longDate(date)})`,
      head: ['S.N.', 'NAME', 'REFERENCE NUMBER', 'Quoted Price', 'Collected Price', 'Margin', 'Associates', 'Paid by', 'Date of Collection', 'Remarks'],
      body: rows.map((r, i) => [i + 1, r.name, r.referenceNumber, money(r.quotedPrice), money(r.collectedPrice), r.margin === '' ? '' : money(r.margin), r.associates, r.paidBy, shortDate(r.collectionDate), r.remarks || '']),
      foot: ['', 'TOTAL', '', money(accTotals.q), money(accTotals.c), money(accTotals.m), '', '', '', ''],
      raw: rows.map((r, i) => [i + 1, r.name, r.referenceNumber, num(r.quotedPrice), num(r.collectedPrice), r.margin === '' ? '' : num(r.margin), r.associates, r.paidBy, shortDate(r.collectionDate), r.remarks || '']),
      rawFoot: ['', 'TOTAL', '', accTotals.q, accTotals.c, accTotals.m, '', '', '', ''],
    };
    const t = sumTable.tot;
    out.sum = {
      id: 'sum', sheet: 'Summary', title: `Registration Summary (Date on: ${longDate(date)})`,
      head: ['Test', 'Type', 'Module', 'Amount', 'Receivable (BCN)', 'Payable Associates', 'Margin (Expected)', 'No. of Cand.', 'Total', 'Remarks'],
      body: sumTable.all.map(r => [r.test || 'IELTS', r.type, r.module, money(r.amount), r.receivable === '' ? '' : money(r.receivable), r.payableAssociates === '' ? '' : money(r.payableAssociates), r.marginExpected === '' ? '' : money(r.marginExpected), r.count, money(r.total), r.remarks || '']),
      foot: ['TOTAL', '', '', '', t.receivable ? money(t.receivable) : '', t.payableAssociates ? money(t.payableAssociates) : '', t.marginExpected ? money(t.marginExpected) : '', t.count, money(t.total), ''],
      note: `Difference: ${shownDifference === '' ? '' : money(shownDifference)}    Paid on (Date): ${paidOn ? longDate(paidOn) : ''}`,
      sign: `Prepared by: ${signoff.preparedBy}        Checked by: ${signoff.checkedBy}        Approved by: ${signoff.approvedBy}`,
      raw: sumTable.all.map(r => [r.test || 'IELTS', r.type, r.module, num(r.amount), r.receivable === '' ? '' : num(r.receivable), r.payableAssociates === '' ? '' : num(r.payableAssociates), r.marginExpected === '' ? '' : num(r.marginExpected), num(r.count), num(r.total), r.remarks || '']),
      rawFoot: ['TOTAL', '', '', '', t.receivable, t.payableAssociates, t.marginExpected, t.count, t.total, ''],
    };
    return out;
  }, [rows, date, bcTotal, accTotals, sumTable, shownDifference, paidOn, signoff]);

  const exportExcel = (ids) => {
    const wb = XLSX.utils.book_new();
    ids.forEach(id => {
      const b = bills[id];
      const aoa = [[b.title], [], b.head, ...b.raw, b.rawFoot];
      if (b.note) aoa.push([], [b.note]);
      if (b.sign) aoa.push([], [b.sign]);
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), b.sheet);
    });
    XLSX.writeFile(wb, `IELTS_Daily_Receipt_${date}.xlsx`);
    toast.success('Exported to Excel');
  };

  const exportPDF = (ids) => {
    const doc = new jsPDF({ orientation: 'landscape' });
    let y = 14;
    ids.forEach((id, idx) => {
      const b = bills[id];
      if (idx > 0 && y > 120) { doc.addPage(); y = 14; }
      doc.setFontSize(12);
      doc.text(b.title, 14, y);
      doc.autoTable({
        startY: y + 4, head: [b.head], body: b.body.map(r => r.map(String)), foot: [b.foot.map(String)],
        styles: { fontSize: 8, cellPadding: 1.8 },
        headStyles: { fillColor: [21, 101, 192], textColor: 255, fontStyle: 'bold' },
        footStyles: { fillColor: [240, 240, 240], textColor: 20, fontStyle: 'bold' },
        margin: { left: 10, right: 10 },
      });
      y = doc.lastAutoTable.finalY + 8;
      doc.setFontSize(9);
      if (b.note) { doc.text(b.note, 14, y); y += 6; }
      if (b.sign) { doc.text(b.sign, 14, y + 8); y += 16; }
      y += 6;
    });
    doc.save(`IELTS_Daily_Receipt_${date}.pdf`);
    toast.success('Exported to PDF');
  };

  const printBills = (ids) => {
    const html = ids.map(id => {
      const b = bills[id];
      return `<h3>${esc(b.title)}</h3>
<table><thead><tr>${b.head.map(h => `<th>${esc(h)}</th>`).join('')}</tr></thead>
<tbody>${b.body.map(r => `<tr>${r.map(v => `<td>${esc(v)}</td>`).join('')}</tr>`).join('')}</tbody>
<tfoot><tr>${b.foot.map(v => `<td>${esc(v)}</td>`).join('')}</tr></tfoot></table>
${b.note ? `<p>${esc(b.note)}</p>` : ''}${b.sign ? `<p class="sign">${esc(b.sign)}</p>` : ''}`;
    }).join('');
    const page = `<!DOCTYPE html><html><head><title>IELTS Daily Receipt ${esc(date)}</title>
<style>
@page { size: A4 landscape; margin: 10mm; }
* { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
body { font-family: Arial, sans-serif; font-size: 10px; color: #000; margin: 0; }
h3 { margin: 14px 0 4px; font-size: 12px; text-align: center; }
table { border-collapse: collapse; width: 100%; }
th, td { border: 1px solid #333; padding: 4px 6px; text-align: left; }
th { background: #f0f0f0; }
tfoot td { font-weight: 700; }
p { margin: 6px 0; }
.sign { margin-top: 36px; }
</style></head><body>${html}</body></html>`;
    const win = window.open('', '_blank');
    if (!win) { toast.error('Pop-up blocked. Please allow pop-ups to print.'); return; }
    win.document.write(page);
    win.document.close();
    win.onload = () => { win.focus(); win.print(); };
    win.onafterprint = () => win.close();
  };

  const permFor = (id, action) => (id === 'bc' ? !!(canBc && perms.bc[action]) : !!(canAcc && perms.acc[action]));

  const BillButtons = ({ ids }) => {
    const ex = ids.length > 0 && ids.every(id => permFor(id, 'exportExcel'));
    const pd = ids.length > 0 && ids.every(id => permFor(id, 'exportPdf'));
    const pr = ids.length > 0 && ids.every(id => permFor(id, 'print'));
    return (
      <div className="drp-bill-actions">
        {ex && <button type="button" className="drp-btn" onClick={() => exportExcel(ids)}>Excel</button>}
        {pd && <button type="button" className="drp-btn" onClick={() => exportPDF(ids)}>PDF</button>}
        {pr && <button type="button" className="drp-btn" onClick={() => printBills(ids)}>Print</button>}
      </div>
    );
  };

  if (metaError) return <div className="drp-root"><div className="drp-empty">{metaError}</div></div>;

  const allIds = ['bc', 'acc', 'sum'].filter(id => (id === 'bc' ? canBc : canAcc));

  return (
    <div className="drp-root animate-fade">
      <div className="drp-head">
        <div>
          <h2>Daily Receipt (IELTS)</h2>
          <p>Receipt date follows the Accounts Date on each IELTS booking.</p>
        </div>
        <div className="drp-tabs">
          <button type="button" className={`drp-tab${tab === 'edit' ? ' active' : ''}`} onClick={() => setTab('edit')}>Add</button>
          <button type="button" className={`drp-tab${tab === 'history' ? ' active' : ''}`} onClick={() => setTab('history')}>History</button>
        </div>
      </div>

      {tab === 'history' && (
        <div className="drp-bill">
          <div className="drp-bill-head"><h3>History</h3></div>
          {historyLoading ? <div className="drp-empty">Loading…</div> : history.length === 0 ? <div className="drp-empty">No receipts yet.</div> : (
            <div className="drp-scroll">
              <table className="drp-table">
                <thead><tr><th>Receipt Date</th><th className="num">Students</th>{canAcc && <th className="num">Total</th>}<th className="num">Manual Rows</th><th>Saved</th><th /></tr></thead>
                <tbody>
                  {history.map(h => (
                    <tr key={h.date}>
                      <td>{longDate(h.date)}</td>
                      <td className="num">{h.count}</td>
                      {canAcc && <td className="num">{money(h.total)}</td>}
                      <td className="num">{h.manual}</td>
                      <td>{h.saved ? 'Yes' : 'Auto only'}</td>
                      <td>
                        <button type="button" className="drp-link" onClick={() => { setDate(h.date); setTab('edit'); }}>Open</button>
                        {canDeleteAny && <button type="button" className="drp-link drp-del" onClick={() => deleteReceipt(h.date)}>Delete</button>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === 'edit' && (
        <>
          <div className="drp-bar">
            <div className="drp-field">
              <label>Receipt Date (Accounts Date)</label>
              <input type="date" value={date} onChange={e => e.target.value && changeDate(e.target.value)} />
            </div>
            {(editBc || editAcc) && <button type="button" className="drp-btn primary" onClick={save} disabled={saving || !dirty}>{saving ? 'Saving…' : 'Save'}</button>}
            {editBc && <button type="button" className="drp-btn" onClick={addRow}>+ Add Row</button>}
            {hiddenCount > 0 && editBc && <button type="button" className="drp-btn" onClick={restoreHidden}>Restore {hiddenCount} hidden</button>}
            {canDeleteAny && <button type="button" className="drp-btn danger" onClick={resetEdits}>Clear saved edits</button>}
            {canDeleteAny && <button type="button" className="drp-btn danger" onClick={() => deleteReceipt(date)}>Delete receipt</button>}
            {allIds.length > 1 && (
              <div className="drp-pick">
                {allIds.map(id => (
                  <label key={id}>
                    <input type="checkbox" checked={!!picked[id]} onChange={() => setPicked(p => ({ ...p, [id]: !p[id] }))} />
                    {BILL_NAMES[id]}
                  </label>
                ))}
                <BillButtons ids={allIds.filter(id => picked[id])} />
              </div>
            )}
          </div>

          {loading ? <div className="drp-empty">Loading…</div> : (
            <>
              {canBc && (
                <div className="drp-bill">
                  <div className="drp-bill-head">
                    <h3>Bill 1: British Council</h3>
                    <BillButtons ids={['bc']} />
                  </div>
                  <div className="drp-note">IELTS Registration from {ORG}</div>
                  <div className="drp-scroll">
                    <table className="drp-table">
                      <thead>
                        <tr><th>S.N.</th>{BC_COLS.map(([k, l, t]) => <th key={k} className={t === 'num' ? 'num' : ''}>{l}</th>)}{editBc && <th />}</tr>
                      </thead>
                      <tbody>
                        {rows.length === 0 && <tr><td colSpan={BC_COLS.length + 2} className="drp-empty">No IELTS bookings with this Accounts Date.</td></tr>}
                        {rows.map((r, i) => (
                          <tr key={r.id} className={r.auto ? '' : 'manual'}>
                            <td>{i + 1}</td>
                            {BC_COLS.map(([k, , t]) => (
                              <td key={k} className={t === 'num' ? 'num' : ''}>
                                <Cell value={r[k]} type={t} disabled={!editBc} edited={r.auto && r._ov[k] !== undefined} onChange={v => edit(r, k, v)} />
                              </td>
                            ))}
                            {editBc && <td><button type="button" className="drp-x" title="Remove" onClick={() => removeRow(r)}>✕</button></td>}
                          </tr>
                        ))}
                        {rows.length > 0 && (
                          <tr className="total"><td colSpan={BC_COLS.length} className="num">Total</td><td className="num">{money(bcTotal)}</td>{editBc && <td />}</tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {canAcc && (
                <div className="drp-bill">
                  <div className="drp-bill-head">
                    <h3>Bill 2: Accounting Calculations (Dated on: {longDate(date)})</h3>
                    <BillButtons ids={['acc']} />
                  </div>
                  <div className="drp-scroll">
                    <table className="drp-table">
                      <thead>
                        <tr><th>S.N.</th><th>Name</th><th>Reference Number</th>{ACC_COLS.map(([k, l, t]) => <th key={k} className={t === 'num' ? 'num' : ''}>{l}</th>)}{editBc && <th />}</tr>
                      </thead>
                      <tbody>
                        {rows.length === 0 && <tr><td colSpan={ACC_COLS.length + 3} className="drp-empty">No rows.</td></tr>}
                        {rows.map((r, i) => (
                          <tr key={r.id} className={r.auto ? '' : 'manual'}>
                            <td>{i + 1}</td>
                            <td>{r.name}</td>
                            <td>{r.referenceNumber}</td>
                            {ACC_COLS.map(([k, , t]) => (
                              <td key={k} className={t === 'num' ? 'num' : ''}>
                                <Cell value={r[k]} type={t} disabled={!editAcc} edited={r.auto && r._ov[k] !== undefined} onChange={v => edit(r, k, v)} />
                              </td>
                            ))}
                            {editBc && <td><button type="button" className="drp-x" title="Delete row" onClick={() => removeRow(r)}>✕</button></td>}
                          </tr>
                        ))}
                        {rows.length > 0 && (
                          <tr className="total"><td colSpan={3} className="num">Total</td><td className="num">{money(accTotals.q)}</td><td className="num">{money(accTotals.c)}</td><td className="num">{money(accTotals.m)}</td><td colSpan={editBc ? 5 : 4} /></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {canAcc && (
                <div className="drp-bill">
                  <div className="drp-bill-head">
                    <h3>Bill 3: Registration Summary (Date on: {longDate(date)})</h3>
                    <BillButtons ids={['sum']} />
                  </div>
                  <div className="drp-scroll">
                    <table className="drp-table">
                      <thead>
                        <tr>
                          <th>Test</th><th>Type</th><th>Module</th><th className="num">Amount</th><th className="num">Receivable (BCN)</th>
                          <th className="num">Payable Associates</th><th className="num">Margin (Expected)</th><th className="num">No. of Cand.</th><th className="num">Total</th><th>Remarks</th>{editAcc && <th />}
                        </tr>
                      </thead>
                      <tbody>
                        {sumTable.body.map(r => (
                          <tr key={r.key}>
                            <td>IELTS</td><td>{r.type}</td><td>{r.module}</td>
                            <td className="num"><Cell type="num" value={r.amount} disabled={!editAcc} onChange={v => setSum(r.key, 'amount', v)} /></td>
                            <td className="num"><Cell type="num" value={r.receivable} disabled={!editAcc} onChange={v => setSum(r.key, 'receivable', v)} /></td>
                            <td className="num"><Cell type="num" value={r.payableAssociates} disabled={!editAcc} onChange={v => setSum(r.key, 'payableAssociates', v)} /></td>
                            <td className="num"><Cell type="num" value={r.marginExpected} disabled={!editAcc} onChange={v => setSum(r.key, 'marginExpected', v)} /></td>
                            <td className="num">{r.count}</td>
                            <td className="num">{money(r.total)}</td>
                            <td><Cell type="text" value={r.remarks} disabled={!editAcc} onChange={v => setSum(r.key, 'remarks', v)} /></td>
                            {editAcc && <td />}
                          </tr>
                        ))}
                        {sumTable.extra.map(r => (
                          <tr key={r.rid} className="manual">
                            <td><Cell type="text" value={r.test} disabled={!editAcc} onChange={v => setExtra(r.rid, 'test', v)} /></td>
                            <td><Cell type="text" value={r.type} disabled={!editAcc} onChange={v => setExtra(r.rid, 'type', v)} /></td>
                            <td><Cell type="text" value={r.module} disabled={!editAcc} onChange={v => setExtra(r.rid, 'module', v)} /></td>
                            {['amount', 'receivable', 'payableAssociates', 'marginExpected', 'count', 'total'].map(f => (
                              <td key={f} className="num"><Cell type="num" value={r[f]} disabled={!editAcc} onChange={v => setExtra(r.rid, f, v)} /></td>
                            ))}
                            <td><Cell type="text" value={r.remarks} disabled={!editAcc} onChange={v => setExtra(r.rid, 'remarks', v)} /></td>
                            {editAcc && <td><button type="button" className="drp-x" onClick={() => removeExtra(r.rid)}>✕</button></td>}
                          </tr>
                        ))}
                        <tr className="total">
                          <td colSpan={4}>TOTAL</td>
                          <td className="num">{sumTable.tot.receivable ? money(sumTable.tot.receivable) : ''}</td>
                          <td className="num">{sumTable.tot.payableAssociates ? money(sumTable.tot.payableAssociates) : ''}</td>
                          <td className="num">{sumTable.tot.marginExpected ? money(sumTable.tot.marginExpected) : ''}</td>
                          <td className="num">{sumTable.tot.count}</td>
                          <td className="num">{money(sumTable.tot.total)}</td>
                          <td />{editAcc && <td />}
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  <div className="drp-foot">
                    {editAcc && <button type="button" className="drp-btn" onClick={addExtra}>+ Add Summary Row</button>}
                    <label>Difference
                      <input type="number" step="0.01" value={difference} placeholder={autoDifference} disabled={!editAcc}
                        onChange={e => { setDifference(e.target.value); setDirty(true); }} />
                    </label>
                    <label>Paid on (Date)
                      <input type="date" value={paidOn} disabled={!editAcc} onChange={e => { setPaidOn(e.target.value); setDirty(true); }} />
                    </label>
                  </div>
                  <div className="drp-foot">
                    {[['preparedBy', 'Prepared by'], ['checkedBy', 'Checked by'], ['approvedBy', 'Approved by']].map(([k, l]) => (
                      <label key={k}>{l}
                        <input type="text" value={signoff[k]} disabled={!editAcc} onChange={e => { setSignoff(s => ({ ...s, [k]: e.target.value })); setDirty(true); }} />
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
