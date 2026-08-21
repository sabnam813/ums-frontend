import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { useAuth } from '../context/AuthContext';
import { isAdmin } from '../utils/permissions';
import { hasPermission } from '../utils/rbac';
import { FISCAL_YEARS, getFiscalYearRange } from '../utils/fiscalYear';
import { useFiscalYear } from '../context/FiscalYearContext';
import { toastExcel } from '../utils/exportHelpers';
import './FollowUp.css';

function exportToExcel(followUps, adminUser) {
  try {
    const headers = adminUser
      ? ['Date', 'Company Name', 'Talked To', 'Remarks', 'Added By']
      : ['Date', 'Company Name', 'Talked To', 'Remarks'];
    const rows = followUps.map(fu => {
      const row = [
        fu.date ? format(new Date(fu.date), 'yyyy-MM-dd') : '',
        fu.companyName || '',
        fu.talkedTo || '',
        fu.remarks || '',
      ];
      if (adminUser) row.push(fu.createdBy?.name || fu.createdBy?.username || '');
      return row;
    });
    const csvContent = [headers, ...rows]
      .map(r => r.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `follow-ups-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toastExcel();
  } catch { toast.error('Export failed'); }
}

function exportToPDF(followUps, adminUser) {
  try {
    const dateStr = format(new Date(), 'dd MMM yyyy');
    const colWidths = adminUser ? ['12%','20%','18%','35%','15%'] : ['14%','22%','20%','44%'];
    const headers = adminUser
      ? ['Date','Company Name','Talked To','Remarks','Added By']
      : ['Date','Company Name','Talked To','Remarks'];
    const rows = followUps.map(fu => {
      const r = [
        fu.date ? format(new Date(fu.date), 'dd MMM yyyy') : '—',
        fu.companyName || '—',
        fu.talkedTo || '—',
        fu.remarks || '—',
      ];
      if (adminUser) r.push(fu.createdBy?.name || fu.createdBy?.username || '—');
      return r;
    });
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
<title>Follow-Up Report</title>
<style>
  body{font-family:Arial,sans-serif;font-size:12px;color:#111;margin:32px}
  h1{font-size:18px;margin:0 0 4px}
  .meta{color:#666;font-size:11px;margin-bottom:20px}
  table{width:100%;border-collapse:collapse}
  th{background:#1565c0;color:#fff;padding:8px 10px;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:.5px}
  td{padding:7px 10px;border-bottom:1px solid #e5e7eb;vertical-align:top}
  tr:nth-child(even) td{background:#f8faff}
  @media print{body{margin:16px}}
</style></head><body>
<h1>Follow-Up Records</h1>
<p class="meta">Generated: ${dateStr} &nbsp;|&nbsp; Total: ${followUps.length} records</p>
<table><thead><tr>${headers.map((h,i)=>`<th style="width:${colWidths[i]}">${h}</th>`).join('')}</tr></thead>
<tbody>${rows.map(r=>`<tr>${r.map(c=>`<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table>
</body></html>`;
    const win = window.open('','_blank');
    if (!win) { toast.error('Pop-up blocked. Allow pop-ups and try again.'); return; }
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); win.close(); }, 500);
    toast.success('PDF ready to print/save');
  } catch { toast.error('PDF export failed'); }
}

function printFollowUps(followUps, adminUser) {
  try {
    const dateStr = format(new Date(), 'dd MMM yyyy');
    const headers = adminUser
      ? ['Date','Company Name','Talked To','Remarks','Added By']
      : ['Date','Company Name','Talked To','Remarks'];
    const rows = followUps.map(fu => {
      const r = [
        fu.date ? format(new Date(fu.date), 'dd MMM yyyy') : '—',
        fu.companyName || '—',
        fu.talkedTo || '—',
        fu.remarks || '—',
      ];
      if (adminUser) r.push(fu.createdBy?.name || fu.createdBy?.username || '—');
      return r;
    });
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
<title>Follow-Up Records</title>
<style>
  body{font-family:Arial,sans-serif;font-size:11px;color:#111;margin:20px}
  h1{font-size:16px;margin:0 0 4px}
  .meta{color:#666;font-size:10px;margin-bottom:16px}
  table{width:100%;border-collapse:collapse}
  th{background:#333;color:#fff;padding:6px 8px;text-align:left;font-size:10px}
  td{padding:5px 8px;border-bottom:1px solid #ddd;vertical-align:top}
  @media print{@page{margin:10mm}}
</style></head><body>
<h1>Follow-Up Records</h1>
<p class="meta">Date: ${dateStr} | Total: ${followUps.length} records</p>
<table><thead><tr>${headers.map(h=>`<th>${h}</th>`).join('')}</tr></thead>
<tbody>${rows.map(r=>`<tr>${r.map(c=>`<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table>
<script>window.onload=()=>{window.print();window.close();}</script>
</body></html>`;
    const win = window.open('','_blank');
    if (!win) { toast.error('Pop-up blocked. Allow pop-ups and try again.'); return; }
    win.document.write(html);
    win.document.close();
  } catch { toast.error('Print failed'); }
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

const EMPTY_FORM = { date: todayISO(), companyName: '', talkedTo: '', remarks: '' };

export default function FollowUpPage() {
  const { user } = useAuth();
  const { fiscalYear: globalFY, setFiscalYear: setGlobalFY } = useFiscalYear();
  const adminUser = isAdmin(user);
  const canCreate = hasPermission(user, 'followUp', 'create');
  const canEditPerm = hasPermission(user, 'followUp', 'edit');
  const canDeletePerm = hasPermission(user, 'followUp', 'delete');
  const canExportExcel = hasPermission(user, 'followUp', 'exportExcel');
  const canExportPdf = hasPermission(user, 'followUp', 'exportPdf');
  const canPrint = hasPermission(user, 'followUp', 'print');

  const [followUps, setFollowUps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [fiscalYear, setFiscalYear] = useState(globalFY);
  const [dateFrom, setDateFrom] = useState(() => getFiscalYearRange(globalFY).from);
  const [dateTo, setDateTo] = useState(() => getFiscalYearRange(globalFY).to);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const fetchFollowUps = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (dateFrom) params.dateFrom = dateFrom;
      if (dateTo) params.dateTo = dateTo;
      if (search) params.search = search;
      const res = await axios.get('/follow-ups', { params });
      setFollowUps(res.data.followUps || []);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load follow-ups');
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo, search]);

  useEffect(() => {
    fetchFollowUps();
  }, [fetchFollowUps]);

  const openCreate = () => {
    setEditing(null);
    setForm({ ...EMPTY_FORM, date: todayISO() });
    setModalOpen(true);
  };

  const openEdit = (fu) => {
    setEditing(fu);
    setForm({
      date: fu.date ? fu.date.slice(0, 10) : todayISO(),
      companyName: fu.companyName || '',
      talkedTo: fu.talkedTo || '',
      remarks: fu.remarks || '',
    });
    setModalOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editing) {
        const res = await axios.put(`/follow-ups/${editing._id}`, form);
        setFollowUps(prev => prev.map(f => f._id === editing._id ? res.data.followUp : f));
        toast.success('Follow-up updated');
      } else {
        const res = await axios.post('/follow-ups', form);
        setFollowUps(prev => [res.data.followUp, ...prev]);
        toast.success('Follow-up added');
      }
      setModalOpen(false);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save follow-up');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (fu) => {
    if (!window.confirm(`Delete this follow-up for "${fu.companyName || 'Unnamed'}"?`)) return;
    try {
      await axios.delete(`/follow-ups/${fu._id}`);
      setFollowUps(prev => prev.filter(f => f._id !== fu._id));
      toast.success('Deleted');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete');
    }
  };

  const isOwnerOrAdmin = (fu) => adminUser || String(fu.createdBy?._id || fu.createdBy) === String(user?._id);
  const canEdit = (fu) => canEditPerm && isOwnerOrAdmin(fu);
  const canDeleteRow = (fu) => canDeletePerm && isOwnerOrAdmin(fu);

  return (
    <div className="followup-page animate-fade">
      {}
      <div className="followup-header">
        <div>
          <h2>Follow Up</h2>
          <p>{followUps.length} record{followUps.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="followup-header-actions">
          {canExportExcel && (
          <button className="followup-export-btn" onClick={() => exportToExcel(followUps, adminUser)} title="Export to Excel/CSV" disabled={followUps.length === 0}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
              <line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="16" y2="17"/>
            </svg>
            Excel
          </button>
          )}
          {canExportPdf && (
          <button className="followup-export-btn" onClick={() => exportToPDF(followUps, adminUser)} title="Export to PDF" disabled={followUps.length === 0}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
            </svg>
            PDF
          </button>
          )}
          {canPrint && (
          <button className="followup-export-btn" onClick={() => printFollowUps(followUps, adminUser)} title="Print" disabled={followUps.length === 0}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="6 9 6 2 18 2 18 9"/>
              <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/>
              <rect x="6" y="14" width="12" height="8"/>
            </svg>
            Print
          </button>
          )}
          {canCreate && (
          <button className="followup-add-btn" onClick={openCreate}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            Add Follow Up
          </button>
          )}
        </div>
      </div>

      {}
      <div className="followup-filters">
        <div className="followup-filter-field">
          <label>Fiscal Year (B.S.)</label>
          <select
            value={fiscalYear}
            onChange={e => {
              const fy = e.target.value;
              const { from, to } = getFiscalYearRange(fy);
              setGlobalFY(fy);
              setFiscalYear(fy);
              if (fy !== 'all') { setDateFrom(from); setDateTo(to); }
              else { setDateFrom(''); setDateTo(''); }
            }}
            style={{ padding: '6px 8px', borderRadius: 6, border: '1px solid var(--border)', fontSize: '0.875rem', width: '100%' }}
          >
            <option value="all">All</option>
            {FISCAL_YEARS.map(fy => (
              <option key={fy.label} value={fy.label}>{fy.label}</option>
            ))}
          </select>
        </div>
        <div className="followup-filter-field">
          <label>From Date</label>
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
        </div>
        <div className="followup-filter-field">
          <label>To Date</label>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} />
        </div>
        <div className="followup-filter-field followup-search">
          <label>Search</label>
          <input
            type="text"
            placeholder="Company, person, remarks…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && fetchFollowUps()}
          />
        </div>
        <button className="followup-search-btn" onClick={fetchFollowUps} style={{ alignSelf: 'flex-end' }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
          </svg>
          Search
        </button>
        {(dateFrom || dateTo || search) && (
          <button
            onClick={() => {
              const { from, to } = getFiscalYearRange(globalFY);
              setFiscalYear(globalFY); setDateFrom(from); setDateTo(to); setSearch('');
            }}
            className="followup-clear-btn"
            style={{ alignSelf: 'flex-end' }}
          >
            Clear
          </button>
        )}
      </div>

      {}
      <div className="followup-table-card">
        {loading ? (
          <div className="followup-empty">
            <div className="reports-spinner" style={{ margin: '0 auto 12px' }} />
            <p>Loading…</p>
          </div>
        ) : followUps.length === 0 ? (
          <div className="followup-empty">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 9.71a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.6a16 16 0 0 0 5.47 5.47l.95-.95a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
            </svg>
            <p>No follow-ups yet</p>
            <span>Click "Add Follow Up" to create one.</span>
          </div>
        ) : (
          <table className="followup-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Company Name</th>
                <th>Talked To</th>
                <th>Remarks</th>
                {adminUser && <th>Added By</th>}
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {followUps.map(fu => (
                <tr key={fu._id}>
                  <td className="followup-date-cell">
                    {fu.date ? format(new Date(fu.date), 'MMM d, yyyy') : '—'}
                  </td>
                  <td style={{ fontWeight: 600 }}>{fu.companyName || <span style={{ color: 'var(--text-secondary)', fontStyle: 'italic', fontWeight: 400 }}>—</span>}</td>
                  <td>{fu.talkedTo || <span style={{ color: 'var(--text-secondary)' }}>—</span>}</td>
                  <td className="followup-remarks-cell">{fu.remarks || <span style={{ color: 'var(--text-secondary)' }}>—</span>}</td>
                  {adminUser && (
                    <td>
                      <span className="followup-created-by">
                        {fu.createdBy?.name || fu.createdBy?.username || '—'}
                      </span>
                    </td>
                  )}
                  <td>
                    {(canEdit(fu) || canDeleteRow(fu)) ? (
                      <div className="followup-actions">
                        {canEdit(fu) && (
                          <button className="followup-action-btn" onClick={() => openEdit(fu)} title="Edit">
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                            </svg>
                            Edit
                          </button>
                        )}
                        {canDeleteRow(fu) && (
                          <button className="followup-action-btn delete" onClick={() => handleDelete(fu)} title="Delete">
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <polyline points="3 6 5 6 21 6"/>
                              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                            </svg>
                            Delete
                          </button>
                        )}
                      </div>
                    ) : (
                      <span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {}
      {modalOpen && (
        <div className="followup-modal-overlay" onClick={e => e.target === e.currentTarget && setModalOpen(false)}>
          <div className="followup-modal">
            <div className="followup-modal-header">
              <h3>{editing ? 'Edit Follow Up' : 'Add Follow Up'}</h3>
              <button className="followup-modal-close" onClick={() => setModalOpen(false)}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
            <form onSubmit={handleSave}>
              <div className="followup-modal-body">
                <div className="followup-field">
                  <label>Date *</label>
                  <input
                    type="date"
                    required
                    value={form.date}
                    onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                  />
                </div>
                <div className="followup-field">
                  <label>Company Name</label>
                  <input
                    type="text"
                    placeholder="e.g. ABC Consultancy"
                    value={form.companyName}
                    onChange={e => setForm(f => ({ ...f, companyName: e.target.value }))}
                  />
                </div>
                <div className="followup-field">
                  <label>Talked To</label>
                  <input
                    type="text"
                    placeholder="Contact person name"
                    value={form.talkedTo}
                    onChange={e => setForm(f => ({ ...f, talkedTo: e.target.value }))}
                  />
                </div>
                <div className="followup-field">
                  <label>Remarks</label>
                  <textarea
                    placeholder="Notes about this follow-up…"
                    value={form.remarks}
                    onChange={e => setForm(f => ({ ...f, remarks: e.target.value }))}
                    rows={4}
                  />
                </div>
              </div>
              <div className="followup-modal-footer">
                <button type="button" className="followup-btn-cancel" onClick={() => setModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="followup-btn-save" disabled={saving}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v14a2 2 0 0 1-2 2z"/>
                    <polyline points="17 21 17 13 7 13 7 21"/>
                    <polyline points="7 3 7 8 15 8"/>
                  </svg>
                  {saving ? 'Saving…' : editing ? 'Save Changes' : 'Add Follow Up'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
