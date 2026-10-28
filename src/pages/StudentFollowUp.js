import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { useStudentFollowUp } from '../context/StudentFollowUpContext';
import { hasPermission } from '../utils/rbac';
import { toastExcel, IconDownload, IconFile, IconPrint, IconSearch } from '../utils/exportHelpers';
import StudentFollowUpEntries from '../components/shared/StudentFollowUpEntries';
import StudentFollowUpAdminSummary from './StudentFollowUpAdminSummary';
import {
  METHOD_OPTIONS,
  STATUS_OPTIONS,
  methodLabel,
  statusLabel,
  formatDateTime,
  formatDateOnly,
  isOverdue,
  isDueTodayPending,
} from '../utils/studentFollowUp';
import './StudentFollowUp.css';
import AssociateName from '../components/shared/AssociateName';

const TABS = [
  { key: 'today', label: 'Today', statKey: 'today' },
  { key: 'overdue', label: 'Overdue', statKey: 'overdue' },
  { key: 'upcoming', label: 'Upcoming', statKey: 'upcoming' },
  { key: 'all', label: 'All', statKey: 'total' },
  { key: 'completed', label: 'Completed', statKey: 'completed' },
];

const EMPTY_FILTERS = { search: '', country: '', status: '', method: '', dateFrom: '', dateTo: '' };

function rowsForExport(rows) {
  return rows.map(r => [
    formatDateTime(r.scheduledAt),
    r.studentName || '',
    r.country?.name || '',
    r.referredBy || '',
    r.providerName || '',
    methodLabel(r.method),
    r.notes || r.plannedNotes || '',
    isOverdue(r) ? 'Overdue' : isDueTodayPending(r) ? 'Today' : statusLabel(r.status),
  ]);
}

const EXPORT_HEADERS = [
  'Date & Time', 'Student', 'Country', 'Referred By', 'Provider', 'Method', 'Notes', 'Status',
];

function exportToExcel(rows) {
  try {
    const csv = [EXPORT_HEADERS, ...rowsForExport(rows)]
      .map(r => r.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `student-follow-ups-${formatDateOnly(new Date()).replace(/ /g, '-')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toastExcel();
  } catch {
    toast.error('Export failed');
  }
}

function buildReportHtml(rows, { compact = false } = {}) {
  const body = rowsForExport(rows)
    .map(r => `<tr>${r.map(c => `<td>${String(c || '—').replace(/</g, '&lt;')}</td>`).join('')}</tr>`)
    .join('');
  return `<!DOCTYPE html><html><head><meta charset="utf-8">
<title>Student Follow-Up Records</title>
<style>
  body{font-family:Arial,sans-serif;font-size:${compact ? 11 : 12}px;color:#111;margin:${compact ? 20 : 32}px}
  h1{font-size:${compact ? 16 : 18}px;margin:0 0 4px}
  .meta{color:#666;font-size:${compact ? 10 : 11}px;margin-bottom:${compact ? 16 : 20}px}
  table{width:100%;border-collapse:collapse}
  th{background:${compact ? '#333' : '#1565c0'};color:#fff;padding:${compact ? '6px 8px' : '8px 10px'};text-align:left;font-size:${compact ? 10 : 11}px}
  td{padding:${compact ? '5px 8px' : '7px 10px'};border-bottom:1px solid #e5e7eb;vertical-align:top}
  ${compact ? '' : 'tr:nth-child(even) td{background:#f8faff}'}
  @media print{@page{margin:10mm}}
</style></head><body>
<h1>Student Follow-Up Records</h1>
<p class="meta">Generated: ${formatDateOnly(new Date())} &nbsp;|&nbsp; Total: ${rows.length} records</p>
<table><thead><tr>${EXPORT_HEADERS.map(h => `<th>${h}</th>`).join('')}</tr></thead>
<tbody>${body}</tbody></table>
</body></html>`;
}

function exportToPDF(rows) {
  try {
    const win = window.open('', '_blank');
    if (!win) { toast.error('Pop-up blocked. Allow pop-ups and try again.'); return; }
    win.document.write(buildReportHtml(rows));
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); win.close(); }, 500);
    toast.success('PDF ready to print/save');
  } catch {
    toast.error('PDF export failed');
  }
}

function printRows(rows) {
  try {
    const win = window.open('', '_blank');
    if (!win) { toast.error('Pop-up blocked. Allow pop-ups and try again.'); return; }
    const closeTag = String.fromCharCode(60) + '/script>';
    win.document.write(
      buildReportHtml(rows, { compact: true })
        .replace('</body>', `<script>window.onload=()=>{window.print();window.close();}${closeTag}</body>`)
    );
    win.document.close();
  } catch {
    toast.error('Print failed');
  }
}

function StudentSummary({ student }) {
  if (student.overdueCount > 0) {
    return <span className="sfu-summary sfu-summary-overdue">{student.overdueCount} overdue</span>;
  }
  if (student.pendingCount > 0) {
    return <span className="sfu-summary sfu-summary-pending">{student.pendingCount} scheduled</span>;
  }
  return <span className="sfu-summary sfu-summary-none">No pending</span>;
}

export default function StudentFollowUpPage() {
  const { user } = useAuth();
  const { stats, refreshStats } = useStudentFollowUp();
  const [searchParams, setSearchParams] = useSearchParams();

  const [tab, setTab] = useState('today');
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [students, setStudents] = useState([]);
  const [countries, setCountries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [expanded, setExpanded] = useState(() => new Set());

  const canExportExcel = hasPermission(user, 'studentFollowUp', 'exportExcel');
  const canExportPdf = hasPermission(user, 'studentFollowUp', 'exportPdf');
  const canPrint = hasPermission(user, 'studentFollowUp', 'print');

  const fetchStudents = useCallback(async () => {
    setLoading(true);
    try {
      const params = { tab };
      Object.entries(filters).forEach(([k, v]) => { if (v) params[k] = v; });
      const res = await axios.get('/student-follow-ups/grouped', { params });
      setStudents(res.data.students || []);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load follow-ups');
      setStudents([]);
    } finally {
      setLoading(false);
    }
  }, [tab, filters]);

  useEffect(() => { fetchStudents(); }, [fetchStudents]);

  useEffect(() => {
    let cancelled = false;
    axios.get('/countries')
      .then(res => { if (!cancelled) setCountries(res.data.countries || []); })
      .catch(() => { if (!cancelled) setCountries([]); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const focusId = searchParams.get('focus');
    if (!focusId || loading) return;
    const match = students.find(s => s.entries.some(e => String(e._id) === focusId));
    if (match) {
      setExpanded(prev => new Set(prev).add(match.groupKey));
      const next = new URLSearchParams(searchParams);
      next.delete('focus');
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, students, loading, setSearchParams]);

  const activeFilterCount = useMemo(
    () => Object.values(filters).filter(Boolean).length,
    [filters]
  );

  const setFilter = (key, value) => setFilters(f => ({ ...f, [key]: value }));

  const toggleExpand = (groupKey) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(groupKey)) next.delete(groupKey);
      else next.add(groupKey);
      return next;
    });
  };

  const flatRows = useMemo(() => students.flatMap(s => s.entries), [students]);

  const afterChange = useCallback(() => {
    fetchStudents();
    refreshStats();
  }, [fetchStudents, refreshStats]);

  const canCreate = hasPermission(user, 'studentFollowUp', 'create');
  const [showNewModal, setShowNewModal] = useState(false);

  return (
    <div className="sfu-page">
      {user?.role === 'super_admin' && <StudentFollowUpAdminSummary />}
      <div className="sfu-page-head">
        <div>
          <h2>Student Followup</h2>
          <p className="sfu-page-sub">
            {stats.overdue > 0
              ? `${stats.overdue} overdue · ${stats.today} due today`
              : `${stats.today} due today · ${stats.upcoming} upcoming`}
          </p>
        </div>
        <div className="sfu-page-actions">
          {canCreate && (
            <button className="sfu-toolbar-btn sfu-btn-primary" onClick={() => setShowNewModal(true)}>
              + New Follow-up
            </button>
          )}
          <button
            className={`sfu-toolbar-btn ${activeFilterCount ? 'active' : ''}`}
            onClick={() => setFiltersOpen(o => !o)}
          >
            Filters{activeFilterCount ? ` (${activeFilterCount})` : ''}
          </button>
          {canExportExcel && (
            <button className="sfu-toolbar-btn" onClick={() => exportToExcel(flatRows)} disabled={!flatRows.length} title="Export to Excel/CSV">
              <IconDownload /> Excel
            </button>
          )}
          {canExportPdf && (
            <button className="sfu-toolbar-btn" onClick={() => exportToPDF(flatRows)} disabled={!flatRows.length} title="Export to PDF">
              <IconFile /> PDF
            </button>
          )}
          {canPrint && (
            <button className="sfu-toolbar-btn" onClick={() => printRows(flatRows)} disabled={!flatRows.length} title="Print">
              <IconPrint /> Print
            </button>
          )}
        </div>
      </div>

      <div className="sfu-tabs">
        {TABS.map(t => (
          <button
            key={t.key}
            className={`sfu-tab ${tab === t.key ? 'active' : ''} ${t.key === 'overdue' && stats.overdue > 0 ? 'danger' : ''}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
            <span className="sfu-tab-count">{stats[t.statKey] ?? 0}</span>
          </button>
        ))}
      </div>

      <div className="sfu-searchbar">
        <span className="sfu-search-icon"><IconSearch size={15} /></span>
        <input
          type="text"
          placeholder="Search student, referred by, provider or notes…"
          value={filters.search}
          onChange={e => setFilter('search', e.target.value)}
        />
        {filters.search && (
          <button className="sfu-search-clear" onClick={() => setFilter('search', '')}>×</button>
        )}
      </div>

      {filtersOpen && (
        <div className="sfu-filters">
          <label>
            <span>Country</span>
            <select value={filters.country} onChange={e => setFilter('country', e.target.value)}>
              <option value="">All countries</option>
              {countries.map(c => (
                <option key={c._id} value={c._id}>{c.flag ? `${c.flag} ` : ''}{c.name}</option>
              ))}
            </select>
          </label>
          <label>
            <span>Status</span>
            <select value={filters.status} onChange={e => setFilter('status', e.target.value)}>
              <option value="">Any status</option>
              {STATUS_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </label>
          <label>
            <span>Method</span>
            <select value={filters.method} onChange={e => setFilter('method', e.target.value)}>
              <option value="">Any method</option>
              {METHOD_OPTIONS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </label>
          <label>
            <span>From date</span>
            <input type="date" value={filters.dateFrom} onChange={e => setFilter('dateFrom', e.target.value)} />
          </label>
          <label>
            <span>To date</span>
            <input type="date" value={filters.dateTo} onChange={e => setFilter('dateTo', e.target.value)} />
          </label>
          <button className="sfu-toolbar-btn" onClick={() => setFilters(EMPTY_FILTERS)}>Clear all</button>
        </div>
      )}

      <div className="sfu-list-wrap">
        {loading ? (
          <p className="sfu-empty">Loading follow-ups…</p>
        ) : students.length === 0 ? (
          <p className="sfu-empty">No students in this view.</p>
        ) : (
          <div className="sfu-nested-scroll">
            <table className="sfu-list">
              <thead>
                <tr>
                  <th className="sfu-chevron-col" />
                  <th>Student</th>
                  <th>Country</th>
                  <th>Referred By</th>
                  <th>Provider</th>
                  <th>Next follow-up</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {students.map(s => {
                  const isOpen = expanded.has(s.groupKey);
                  return (
                    <React.Fragment key={s.groupKey}>
                      <tr
                        className={`sfu-student-row ${s.overdueCount > 0 ? 'sfu-row-overdue' : ''}`}
                        onClick={() => toggleExpand(s.groupKey)}
                      >
                        <td className="sfu-chevron-col">
                          <span className={`sfu-chevron ${isOpen ? 'open' : ''}`}>▶</span>
                        </td>
                        <td className="sfu-strong">
                          {s.studentName || '—'}
                          {s.isStandalone && <span className="sfu-manual-badge" title="Not linked to an application">Manual</span>}
                        </td>
                        <td className="sfu-nowrap">{s.country?.flag ? `${s.country.flag} ` : ''}{s.country?.name || '—'}</td>
                        <td><AssociateName name={s.referredBy} empty="—" /></td>
                        <td>{s.providerName || '—'}</td>
                        <td className="sfu-nowrap">{s.nextScheduledAt ? formatDateTime(s.nextScheduledAt) : '—'}</td>
                        <td><StudentSummary student={s} /></td>
                      </tr>
                      {isOpen && (
                        <tr className="sfu-expand-row">
                          <td colSpan={7}>
                            <StudentFollowUpEntries
                              applicationId={s.applicationId}
                              standaloneInfo={s.isStandalone ? {
                                studentName: s.studentName,
                                country: s.country?._id || s.country,
                                referredBy: s.referredBy,
                                providerName: s.providerName,
                                chainRoot: s.groupKey.split(':')[1]
                              } : null}
                              initialEntries={s.entries}
                              initialMeta={{ referredBy: s.referredBy, providerName: s.providerName }}
                              compact
                              onChanged={afterChange}
                            />
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showNewModal && (
        <NewFollowUpModal
          countries={countries}
          onClose={() => setShowNewModal(false)}
          onCreated={() => { setShowNewModal(false); afterChange(); }}
        />
      )}
    </div>
  );
}

function NewFollowUpModal({ countries, onClose, onCreated }) {
  const [form, setForm] = useState({
    studentName: '',
    country: '',
    referredBy: '',
    providerName: '',
    scheduledAt: '',
    method: 'call',
    notes: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const set = (key, val) => setForm(f => ({ ...f, [key]: val }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.studentName.trim()) { setError('Student name is required'); return; }
    if (!form.country) { setError('Country is required'); return; }
    if (!form.scheduledAt) { setError('Follow-up date and time are required'); return; }
    setSaving(true);
    try {
      await axios.post('/student-follow-ups', {
        studentName: form.studentName.trim(),
        country: form.country,
        referredBy: form.referredBy,
        providerName: form.providerName,
        scheduledAt: form.scheduledAt,
        method: form.method,
        plannedNotes: form.notes,
      });
      toast.success('Follow-up created');
      onCreated();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create follow-up');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="sfu-modal-overlay" onClick={e => e.target === e.currentTarget && !saving && onClose()}>
      <div className="sfu-modal">
        <div className="sfu-modal-header">
          <h3>New Follow-up</h3>
          <p>For a student who isn't in the application pipeline yet</p>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="sfu-modal-body">
            {error && <div className="sfu-modal-error">{error}</div>}
            <label>
              <span>Student Name *</span>
              <input type="text" value={form.studentName} onChange={e => set('studentName', e.target.value)} placeholder="e.g. Sita Sharma" required />
            </label>
            <label>
              <span>Country *</span>
              <select value={form.country} onChange={e => set('country', e.target.value)} required>
                <option value="">Select country…</option>
                {countries.map(c => (
                  <option key={c._id} value={c._id}>{c.flag ? `${c.flag} ` : ''}{c.name}</option>
                ))}
              </select>
            </label>
            <div className="sfu-modal-row">
              <label>
                <span>Referred By</span>
                <input type="text" value={form.referredBy} onChange={e => set('referredBy', e.target.value)} />
              </label>
              <label>
                <span>Provider</span>
                <input type="text" value={form.providerName} onChange={e => set('providerName', e.target.value)} />
              </label>
            </div>
            <div className="sfu-modal-row">
              <label>
                <span>Date &amp; Time *</span>
                <input type="datetime-local" value={form.scheduledAt} onChange={e => set('scheduledAt', e.target.value)} required />
              </label>
              <label>
                <span>Method</span>
                <select value={form.method} onChange={e => set('method', e.target.value)}>
                  {METHOD_OPTIONS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
              </label>
            </div>
            <label>
              <span>Notes</span>
              <textarea rows={3} value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="What's this follow-up about?" />
            </label>
          </div>
          <div className="sfu-modal-footer">
            <button type="button" className="sfu-toolbar-btn" onClick={onClose} disabled={saving}>Cancel</button>
            <button type="submit" className="sfu-toolbar-btn sfu-btn-primary" disabled={saving}>
              {saving ? 'Creating…' : 'Create Follow-up'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
