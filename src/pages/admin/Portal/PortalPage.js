import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { format } from 'date-fns';
import { useAuth } from '../../../context/AuthContext';
import { hasPermission } from '../../../utils/rbac';
import PortalForm from './PortalForm';
import PortalBulkEditModal from './PortalBulkEditModal';
import BulkImportModal from '../../../components/shared/BulkImportModal';
import SelectColumnsModal from '../../../components/shared/SelectColumnsModal';
import { toastExcel, toastPDF, IconDownload, IconFile, IconPrint, IconSearch } from '../../../utils/exportHelpers';
import './Portal.css';

const IMPORT_FIELDS = [
  { key: 'name', label: 'Portal Name', aliases: ['portal', 'portalname', 'sitename'] },
  { key: 'username', label: 'Username', aliases: ['user', 'login', 'email'] },
  { key: 'password', label: 'Password', aliases: ['pass', 'pwd'] },
  { key: 'url', label: 'Site Link', aliases: ['site', 'sites', 'link', 'website', 'url'] },
  { key: 'category', label: 'Category', aliases: ['type'] },
  { key: 'notes', label: 'Notes', aliases: ['remark', 'remarks', 'note'] },
  { key: 'status', label: 'Status', aliases: ['active'] },
  { key: 'departments', label: 'Departments (comma-separated, or "All")', aliases: ['department', 'dept'] },
];

const EXPORT_COLUMNS = [
  { key: 'name', label: 'Portal Name', required: true },
  { key: 'category', label: 'Category' },
  { key: 'username', label: 'Username' },
  { key: 'url', label: 'Site Link' },
  { key: 'departments', label: 'Departments' },
  { key: 'status', label: 'Status' },
  { key: 'hasPassword', label: 'Credential Saved' },
];

function isSafeUrlClient(raw) {
  if (!raw) return false;
  try {
    const u = new URL(raw.trim());
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

function departmentsLabel(p) {
  if (p.allDepartments) return 'All Departments';
  return (p.departments || []).join(', ') || '—';
}

function getExportValue(row, key) {
  if (key === 'departments') return departmentsLabel(row);
  if (key === 'hasPassword') return row.hasPassword ? 'Yes' : 'No';
  return row[key] || '';
}

export default function PortalPage() {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === 'super_admin';
  const canCreate = isSuperAdmin;
  const canEdit = isSuperAdmin;
  const canDelete = isSuperAdmin;
  const canImport = isSuperAdmin;
  const canBulkEdit = isSuperAdmin;
  const canExportExcel = hasPermission(user, 'portal', 'exportExcel');
  const canExportPdf = hasPermission(user, 'portal', 'exportPdf');
  const canPrint = hasPermission(user, 'portal', 'print');
  const canView = hasPermission(user, 'portal', 'view');

  const [portals, setPortals] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [showForm, setShowForm] = useState(false);
  const [editPortal, setEditPortal] = useState(null);
  const [showBulkEdit, setShowBulkEdit] = useState(false);
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [bulkImporting, setBulkImporting] = useState(false);
  const [columnPickerFor, setColumnPickerFor] = useState(null);
  const [revealed, setRevealed] = useState({}); // id -> { username, password }
  const [revealingId, setRevealingId] = useState(null);
  const searchDebounce = useRef(null);

  const fetchDepartments = useCallback(async () => {
    try {
      const res = await axios.get('/departments');
      setDepartments(res.data.departments || []);
    } catch {
      setDepartments([]);
    }
  }, []);

  const fetchPortals = useCallback(async (params = {}) => {
    setLoading(true);
    try {
      const res = await axios.get('/portals', { params });
      setPortals(res.data.portals || []);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load portals');
      setPortals([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchDepartments(); }, [fetchDepartments]);

  useEffect(() => {
    if (searchDebounce.current) clearTimeout(searchDebounce.current);
    searchDebounce.current = setTimeout(() => {
      fetchPortals({
        q: search || undefined,
        department: deptFilter || undefined,
        status: statusFilter || undefined,
      });
    }, 300);
    return () => clearTimeout(searchDebounce.current);
  }, [search, deptFilter, statusFilter, fetchPortals]);

  const toggleSelect = (id) => {
    setSelectedIds(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });
  };
  const toggleAll = () => {
    if (selectedIds.size === portals.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(portals.map(p => p._id)));
  };

  const handleSave = async (payload) => {
    if (editPortal) {
      const res = await axios.put(`/portals/${editPortal._id}`, payload);
      setPortals(prev => prev.map(p => p._id === editPortal._id ? res.data.portal : p));
      toast.success('Portal updated');
    } else {
      const res = await axios.post('/portals', payload);
      setPortals(prev => [res.data.portal, ...prev]);
      toast.success('Portal added');
    }
    setShowForm(false);
    setEditPortal(null);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Move this portal to trash? You can restore it later from the Trash page.')) return;
    try {
      await axios.delete(`/portals/${id}`);
      setPortals(prev => prev.filter(p => p._id !== id));
      setSelectedIds(prev => { const next = new Set(prev); next.delete(id); return next; });
      toast.success('Moved to trash');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete portal');
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!window.confirm(`Move ${selectedIds.size} selected portal(s) to trash?`)) return;
    const ids = Array.from(selectedIds);
    try {
      await Promise.all(ids.map(id => axios.delete(`/portals/${id}`)));
      setPortals(prev => prev.filter(p => !selectedIds.has(p._id)));
      setSelectedIds(new Set());
      toast.success(`${ids.length} portal(s) moved to trash`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Bulk delete failed');
      fetchPortals({ q: search || undefined, department: deptFilter || undefined, status: statusFilter || undefined });
    }
  };

  const handleBulkSave = async (updates) => {
    try {
      const ids = Array.from(selectedIds);
      await axios.post('/portals/bulk-edit', { ids, updates });
      toast.success(`${ids.length} portal(s) updated`);
      setSelectedIds(new Set());
      setShowBulkEdit(false);
      fetchPortals({ q: search || undefined, department: deptFilter || undefined, status: statusFilter || undefined });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Bulk update failed');
    }
  };

  const handleBulkImport = async (rows) => {
    if (!rows || rows.length === 0) {
      toast.error('No valid data to import');
      return { total: 0, created: 0, failed: 0, failures: [] };
    }
    setBulkImporting(true);
    try {
      const prepared = rows.map(r => {
        const deptRaw = (r.departments || '').toString().trim();
        const allDepartments = /^all$/i.test(deptRaw) || /all departments/i.test(deptRaw);
        const departmentsList = allDepartments ? [] : deptRaw ? deptRaw.split(',').map(d => d.trim()).filter(Boolean) : [];
        const statusRaw = (r.status || '').toString().trim().toLowerCase();
        return {
          name: r.name || '',
          username: r.username || '',
          password: r.password || '',
          url: r.url || '',
          category: r.category || '',
          notes: r.notes || '',
          status: statusRaw === 'inactive' ? 'inactive' : 'active',
          allDepartments,
          departments: departmentsList,
        };
      });
      const res = await axios.post('/portals/bulk-import', { rows: prepared });
      const summary = {
        total: res.data.total ?? rows.length,
        created: res.data.created,
        failed: res.data.failed ?? 0,
        failures: res.data.failures || [],
      };
      if (summary.failed > 0) {
        toast(`${summary.created} imported, ${summary.failed} skipped`);
      } else {
        toast.success(`${summary.created} portal(s) imported`);
      }
      fetchPortals({ q: search || undefined, department: deptFilter || undefined, status: statusFilter || undefined });
      return summary;
    } catch (err) {
      toast.error(err.response?.data?.message || 'Bulk import failed');
      throw err;
    } finally {
      setBulkImporting(false);
    }
  };

  const handleReveal = async (portal) => {
    if (revealed[portal._id]) {
      setRevealed(prev => { const next = { ...prev }; delete next[portal._id]; return next; });
      return;
    }
    setRevealingId(portal._id);
    try {
      const res = await axios.post(`/portals/${portal._id}/reveal`);
      setRevealed(prev => ({ ...prev, [portal._id]: res.data }));
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to reveal credentials');
    } finally {
      setRevealingId(null);
    }
  };

  const handleCopy = async (text, label) => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${label} copied`);
    } catch {
      toast.error('Could not copy to clipboard');
    }
  };

  const handleOpenLink = (url) => {
    if (!isSafeUrlClient(url)) {
      toast.error('This link is not a valid http(s) address and was blocked for safety.');
      return;
    }
    const win = window.open(url, '_blank', 'noopener,noreferrer');
    if (win) win.opener = null;
  };

  const openColumnPicker = (target) => setColumnPickerFor(target);

  const handleColumnsConfirm = (columnKeys) => {
    const target = columnPickerFor;
    setColumnPickerFor(null);
    if (target === 'excel') exportExcel(columnKeys);
    else if (target === 'pdf') exportPDF(columnKeys);
    else if (target === 'print') handlePrint(columnKeys);
  };

  const exportExcel = (columnKeys) => {
    const columns = columnKeys.map(k => EXPORT_COLUMNS.find(c => c.key === k)).filter(Boolean);
    const source = selectedIds.size > 0 ? portals.filter(p => selectedIds.has(p._id)) : portals;
    const rows = source.map(p => {
      const row = {};
      columns.forEach(col => { row[col.label] = getExportValue(p, col.key); });
      return row;
    });
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Portals');
    XLSX.writeFile(wb, `Portals_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
    toastExcel();
  };

  const exportPDF = (columnKeys) => {
    const columns = columnKeys.map(k => EXPORT_COLUMNS.find(c => c.key === k)).filter(Boolean);
    const source = selectedIds.size > 0 ? portals.filter(p => selectedIds.has(p._id)) : portals;
    const doc = new jsPDF({ orientation: 'landscape' });
    doc.setFontSize(14);
    doc.text('Portal Directory', 14, 16);
    doc.setFontSize(9);
    doc.text(`Generated: ${format(new Date(), 'PPP')}  |  Total: ${source.length} portal(s)`, 14, 22);
    doc.autoTable({
      startY: 26,
      head: [columns.map(c => c.label)],
      body: source.map(p => columns.map(c => getExportValue(p, c.key) || '—')),
      styles: { fontSize: 8, cellPadding: 1.5, overflow: 'linebreak' },
      headStyles: { fillColor: [46, 79, 143], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [245, 248, 255] },
      margin: { left: 8, right: 8 },
    });
    doc.save(`Portals_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
    toastPDF();
  };

  const handlePrint = (columnKeys) => {
    const columns = columnKeys.map(k => EXPORT_COLUMNS.find(c => c.key === k)).filter(Boolean);
    const source = selectedIds.size > 0 ? portals.filter(p => selectedIds.has(p._id)) : portals;
    const headers = columns.map(c => `<th>${escapeHtml(c.label)}</th>`).join('');
    const rows = source.map(p => {
      const cells = columns.map(c => `<td>${escapeHtml(getExportValue(p, c.key) || '—')}</td>`).join('');
      return `<tr>${cells}</tr>`;
    }).join('');

    const printHtml = `<!DOCTYPE html>
<html>
<head>
  <title>Portal Directory</title>
  <style>
    @page { size: A4 landscape; margin: 10mm; }
    * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    body { font-family: Arial, sans-serif; font-size: 10px; margin: 0; color: #000; }
    h2 { margin: 0 0 6px; font-size: 15px; }
    p { margin: 0 0 8px; color: #555; font-size: 9px; }
    table { border-collapse: collapse; width: 100%; table-layout: fixed; }
    th, td { border: 1px solid #ccc; padding: 4px 6px; text-align: left; word-wrap: break-word; overflow-wrap: break-word; }
    th { background: #f0f0f0; font-weight: 600; }
    tr:nth-child(even) { background: #fafafa; }
    tr { page-break-inside: avoid; }
    thead { display: table-header-group; }
  </style>
</head>
<body>
  <h2>Portal Directory</h2>
  <p>Printed ${escapeHtml(new Date().toLocaleDateString())} &middot; ${source.length} portal(s) &middot; Credentials are never included in printouts</p>
  <table>
    <thead><tr>${headers}</tr></thead>
    <tbody>${rows}</tbody>
  </table>
</body>
</html>`;

    const win = window.open('', '_blank');
    if (!win) { toast.error('Pop-up blocked. Please allow pop-ups to print.'); return; }
    win.document.write(printHtml);
    win.document.close();
    win.onload = () => { win.focus(); win.print(); };
    win.onafterprint = () => win.close();
  };

  const columnPickerInitialSelected = useMemo(() => EXPORT_COLUMNS.map(c => c.key), []);

  if (!canView) {
    return <div className="pt-page"><div className="pt-empty-hint">You do not have permission to view the Portal module.</div></div>;
  }

  return (
    <div className="pt-page">
      <div className="pt-page-header">
        <div>
          <h2>Portal</h2>
          <p className="pt-page-sub">Credential directory for partner &amp; university portals — visibility is controlled per portal.</p>
        </div>
        <div className="pt-header-actions">
          {canImport && (
            <button className="pt-btn-outline" onClick={() => setShowBulkImport(true)}>
              <IconFile /> Import
            </button>
          )}
          {canExportExcel && (
            <button className="pt-btn-outline" onClick={() => openColumnPicker('excel')}>
              <IconDownload /> Excel
            </button>
          )}
          {canExportPdf && (
            <button className="pt-btn-outline" onClick={() => openColumnPicker('pdf')}>
              <IconDownload /> PDF
            </button>
          )}
          {canPrint && (
            <button className="pt-btn-outline" onClick={() => openColumnPicker('print')}>
              <IconPrint /> Print
            </button>
          )}
          {canCreate && (
            <button className="pt-btn-primary" onClick={() => { setEditPortal(null); setShowForm(true); }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14"/></svg>
              Add Portal
            </button>
          )}
        </div>
      </div>

      <div className="pt-toolbar">
        <div className="pt-search-box">
          <IconSearch />
          <input type="text" placeholder="Search portal, username, or link…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="pt-filter-select" value={deptFilter} onChange={e => setDeptFilter(e.target.value)}>
          <option value="">All Departments (visible to me)</option>
          {departments.map(d => <option key={d._id} value={d.name}>{d.name}</option>)}
        </select>
        <select className="pt-filter-select" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="">Any Status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>

      {selectedIds.size > 0 && (
        <div className="pt-bulk-bar">
          <span>{selectedIds.size} selected</span>
          {canBulkEdit && <button onClick={() => setShowBulkEdit(true)}>Bulk Edit</button>}
          {canDelete && <button className="pt-danger" onClick={handleBulkDelete}>Delete Selected</button>}
          <button className="pt-link-btn" onClick={() => setSelectedIds(new Set())}>Clear selection</button>
        </div>
      )}

      <div className="pt-table-wrap">
        <table className="pt-table">
          <thead>
            <tr>
              <th className="pt-th-check">
                <input type="checkbox" checked={portals.length > 0 && selectedIds.size === portals.length} onChange={toggleAll} />
              </th>
              <th>Portal</th>
              <th>Category</th>
              <th>Username</th>
              <th>Password</th>
              <th>Site Link</th>
              <th>Visible To</th>
              <th>Status</th>
              <th className="pt-th-actions">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={9} className="pt-empty-hint">Loading…</td></tr>
            )}
            {!loading && portals.length === 0 && (
              <tr><td colSpan={9} className="pt-empty-hint">No portals found.</td></tr>
            )}
            {!loading && portals.map(p => {
              const rev = revealed[p._id];
              return (
                <tr key={p._id}>
                  <td><input type="checkbox" checked={selectedIds.has(p._id)} onChange={() => toggleSelect(p._id)} /></td>
                  <td className="pt-td-name">{p.name}</td>
                  <td>{p.category || <span className="pt-td-empty">—</span>}</td>
                  <td>{p.username || <span className="pt-td-empty">—</span>}</td>
                  <td>
                    {!p.hasPassword ? (
                      <span className="pt-td-empty">—</span>
                    ) : (
                      <div className="pt-pw-cell">
                        <span className="pt-pw-value">{rev ? rev.password : '••••••••'}</span>
                        <button className="pt-icon-sm" title={rev ? 'Hide' : 'Reveal'} onClick={() => handleReveal(p)} disabled={revealingId === p._id}>
                          {revealingId === p._id ? (
                            '…'
                          ) : rev ? (
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-11-8-11-8a18.5 18.5 0 0 1 5.06-5.94M9.9 4.24A10.94 10.94 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                              <line x1="1" y1="1" x2="23" y2="23"/>
                            </svg>
                          ) : (
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                              <circle cx="12" cy="12" r="3"/>
                            </svg>
                          )}
                        </button>
                        {rev && (
                          <button className="pt-icon-sm" title="Copy password" onClick={() => handleCopy(rev.password, 'Password')}>
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <rect x="9" y="9" width="13" height="13" rx="2"/>
                              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                            </svg>
                          </button>
                        )}
                      </div>
                    )}
                  </td>
                  <td>
                    {p.url ? (
                      <button className="pt-link-open" onClick={() => handleOpenLink(p.url)} title={p.url}>
                        Open <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M7 17L17 7M7 7h10v10"/></svg>
                      </button>
                    ) : <span className="pt-td-empty">—</span>}
                  </td>
                  <td className="pt-td-depts">
                    {p.allDepartments ? (
                      <span className="pt-badge pt-badge-all">All Departments</span>
                    ) : (
                      (p.departments || []).slice(0, 2).map(d => <span key={d} className="pt-badge">{d}</span>)
                    )}
                    {!p.allDepartments && (p.departments || []).length > 2 && (
                      <span className="pt-badge pt-badge-more">+{p.departments.length - 2}</span>
                    )}
                  </td>
                  <td><span className={`pt-status-badge ${p.status}`}>{p.status === 'active' ? 'Active' : 'Inactive'}</span></td>
                  <td className="pt-td-actions">
                    {canEdit && (
                      <button className="pt-icon-sm" title="Edit" onClick={() => { setEditPortal(p); setShowForm(true); }}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                      </button>
                    )}
                    {canDelete && (
                      <button className="pt-icon-sm pt-danger" title="Delete" onClick={() => handleDelete(p._id)}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="pt-footer">
        <span>{portals.length} portal{portals.length !== 1 ? 's' : ''}</span>
      </div>

      {showForm && (
        <PortalForm
          portal={editPortal}
          departments={departments}
          onSave={handleSave}
          onClose={() => { setShowForm(false); setEditPortal(null); }}
        />
      )}

      {showBulkEdit && (
        <PortalBulkEditModal
          count={selectedIds.size}
          departments={departments}
          onSave={handleBulkSave}
          onClose={() => setShowBulkEdit(false)}
        />
      )}

      {showBulkImport && (
        <BulkImportModal
          isOpen={showBulkImport}
          onClose={() => setShowBulkImport(false)}
          onImport={handleBulkImport}
          loading={bulkImporting}
          title="Bulk Import Portals"
          fields={IMPORT_FIELDS}
          requiredField={{ key: 'name', label: 'Portal Name' }}
          dateFields={[]}
          optionsByField={{}}
        />
      )}

      {columnPickerFor && (
        <SelectColumnsModal
          columns={EXPORT_COLUMNS}
          initialSelected={columnPickerInitialSelected}
          title={columnPickerFor === 'excel' ? 'Export to Excel' : columnPickerFor === 'pdf' ? 'Export to PDF' : 'Print Portals'}
          actionLabel={columnPickerFor === 'print' ? 'Print' : 'Export'}
          onConfirm={handleColumnsConfirm}
          onClose={() => setColumnPickerFor(null)}
        />
      )}
    </div>
  );
}
