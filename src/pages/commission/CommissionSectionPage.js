import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { format } from 'date-fns';
import { useAuth } from '../../context/AuthContext';
import { isAdmin as checkIsAdmin } from '../../utils/permissions';
import { hasPermission } from '../../utils/rbac';
import { SECTION_META, sectionLabel } from '../../utils/commission';
import CountryFlag from '../../components/shared/CountryFlag';
import BulkImportModal from '../../components/shared/BulkImportModal';
import SelectColumnsModal from '../../components/shared/SelectColumnsModal';
import CommissionRowFormModal from './CommissionRowFormModal';
import CommissionBulkEditModal from './CommissionBulkEditModal';
import CommissionNoteModal from './CommissionNoteModal';
import CommissionPinGate from '../../components/shared/CommissionPinGate';
import { toastExcel, toastPDF, IconDownload, IconFile, IconPrint, IconSearch } from '../../utils/exportHelpers';
import './Commission.css';

function fieldsFor(section) {
  if (section === 'department') {
    return {
      importFields: [
        { key: 'university', label: 'Name', aliases: ['name', 'university', 'universitycollege', 'college', 'school', 'institution', 'institutionname', 'agent', 'agentname', 'consultancy', 'company', 'organization', 'organisation', 'provider', 'particulars', 'title'] },
        { key: 'channelPartner', label: 'Channel Partner', aliases: ['channelpartner', 'partner', 'channel'] },
        { key: 'directIndirect', label: 'Direct/Indirect', aliases: ['directindirect', 'direct', 'indirect', 'type'] },
      ],
      exportColumns: [
        { key: 'sno', label: 'S.No' },
        { key: 'university', label: 'Name', required: true },
        { key: 'channelPartner', label: 'Channel Partner' },
        { key: 'directIndirect', label: 'Direct/Indirect' },
      ],
      optionsByField: { directIndirect: ['Direct', 'Indirect'] },
    };
  }
  const isShareholder = section === 'shareholder';
  const nameAliases = ['name', 'university', 'universitycollege', 'college', 'school', 'institution', 'institutionname', 'agent', 'agentname', 'consultancy', 'company', 'organization', 'organisation', 'provider', 'particulars', 'title'];
  if (!isShareholder) nameAliases.push('partner', 'channel');
  return {
    importFields: [
      { key: 'university', label: 'Name', aliases: nameAliases },
      { key: 'undergraduate', label: 'Undergraduate', aliases: ['undergraduate', 'ug', 'undergrad'] },
      { key: 'postgraduate', label: 'Postgraduate', aliases: ['postgraduate', 'pg', 'postgrad', 'graduate'] },
      ...(isShareholder ? [{ key: 'partner', label: 'Admission Partner', aliases: ['admissionpartner', 'admissionpartners', 'partner', 'partnername', 'partners', 'channelpartner', 'channel'] }] : []),
      { key: 'remarks', label: 'Remarks', aliases: ['remarks', 'notes', 'netgross', 'note'] },
    ],
    exportColumns: [
      { key: 'sno', label: 'S.No' },
      { key: 'university', label: 'Name', required: true },
      { key: 'undergraduate', label: 'Undergraduate' },
      { key: 'postgraduate', label: 'Postgraduate' },
      ...(isShareholder ? [{ key: 'partner', label: 'Admission Partner' }] : []),
      { key: 'remarks', label: 'Remarks' },
    ],
    optionsByField: {},
  };
}

function getExportValue(row, key) {
  const v = row[key];
  return v === undefined || v === null ? '' : String(v);
}

function CommissionSectionContent() {
  const { user } = useAuth();
  const { intakeId, countryId, section } = useParams();
  const admin = checkIsAdmin(user);
  const base = admin ? '/admin/commission' : '/commission';

  const meta = SECTION_META[section];
  const permKey = meta?.permKey;

  const canView = permKey ? hasPermission(user, permKey, 'view') : false;
  const canCreate = permKey ? hasPermission(user, permKey, 'create') : false;
  const canEdit = permKey ? hasPermission(user, permKey, 'edit') : false;
  const canDelete = permKey ? hasPermission(user, permKey, 'delete') : false;
  const canImport = permKey ? hasPermission(user, permKey, 'import') : false;
  const canExportExcel = permKey ? hasPermission(user, permKey, 'exportExcel') : false;
  const canExportPdf = permKey ? hasPermission(user, permKey, 'exportPdf') : false;
  const canPrint = permKey ? hasPermission(user, permKey, 'print') : false;
  const canBulkEdit = permKey ? hasPermission(user, permKey, 'bulkEdit') : false;

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [countryInfo, setCountryInfo] = useState(null);
  const [intakeName, setIntakeName] = useState('');
  const [note, setNote] = useState({ headerNote: '', footerNote: '' });
  const [selectedIds, setSelectedIds] = useState(new Set());

  const [showForm, setShowForm] = useState(false);
  const [editRow, setEditRow] = useState(null);
  const [showBulkEdit, setShowBulkEdit] = useState(false);
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [bulkImporting, setBulkImporting] = useState(false);
  const [showNoteEditor, setShowNoteEditor] = useState(false);
  const [columnPickerFor, setColumnPickerFor] = useState(null);
  const [sortConfig, setSortConfig] = useState({ key: '', dir: 'asc' });
  const searchDebounce = useRef(null);

  const { importFields, exportColumns, optionsByField } = useMemo(() => fieldsFor(section), [section]);

  const fetchRows = useCallback(async (params = {}) => {
    if (!meta) return;
    setLoading(true);
    try {
      const res = await axios.get('/commission/rows', {
        params: { intake: intakeId, country: countryId, section, ...params }
      });
      setRows(res.data.rows || []);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load rows');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [intakeId, countryId, section, meta]);

  const fetchContext = useCallback(async () => {
    try {
      const [countriesRes, intakesRes] = await Promise.all([
        axios.get('/commission/countries', { params: { intake: intakeId } }),
        axios.get('/commission/intakes'),
      ]);
      const found = (countriesRes.data.countries || []).find(c => String(c._id) === String(countryId));
      setCountryInfo(found || null);
      const foundIntake = (intakesRes.data.intakes || []).find(i => i._id === intakeId);
      setIntakeName(foundIntake?.name || '');
    } catch {
    }
  }, [intakeId, countryId]);

  const fetchNote = useCallback(async () => {
    if (!meta?.hasNote) return;
    try {
      const res = await axios.get('/commission/notes', { params: { intake: intakeId, country: countryId, section } });
      setNote(res.data.note || { headerNote: '', footerNote: '' });
    } catch {
      setNote({ headerNote: '', footerNote: '' });
    }
  }, [intakeId, countryId, section, meta]);

  useEffect(() => { fetchRows(); }, [fetchRows]);
  useEffect(() => { fetchContext(); }, [fetchContext]);
  useEffect(() => { fetchNote(); }, [fetchNote]);

  useEffect(() => {
    if (searchDebounce.current) clearTimeout(searchDebounce.current);
    searchDebounce.current = setTimeout(() => {
      fetchRows({ search: search || undefined });
    }, 300);
    return () => clearTimeout(searchDebounce.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const toggleSelect = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };
  const toggleSort = (key) => setSortConfig(prev => (prev.key === key ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }));
  const sortedRows = useMemo(() => {
    if (!sortConfig.key) return rows;
    const val = r => String(r[sortConfig.key] ?? '').toLowerCase();
    return [...rows].sort((a, b) => {
      const av = val(a);
      const bv = val(b);
      const cmp = av.localeCompare(bv, undefined, { numeric: true, sensitivity: 'base' });
      return sortConfig.dir === 'asc' ? cmp : -cmp;
    });
  }, [rows, sortConfig]);
  const toggleAll = () => {
    setSelectedIds(prev => (prev.size === sortedRows.length ? new Set() : new Set(sortedRows.map(r => r._id))));
  };
  const sortTh = (key, label) => (
    <th className={`cms-sortable ${sortConfig.key === key ? 'cms-sorted' : ''}`} onClick={() => toggleSort(key)} title={`Sort by ${label}`}>
      <span className="cms-th-content">
        {label}
        <span className="cms-sort-icon">{sortConfig.key === key ? (sortConfig.dir === 'asc' ? '▲' : '▼') : '⇅'}</span>
      </span>
    </th>
  );

  const handleSave = async (payload) => {
    if (editRow && !window.confirm('Save changes to this row?')) return;
    try {
      if (editRow) {
        await axios.put(`/commission/rows/${editRow._id}`, { section, ...payload });
        toast.success('Row updated');
      } else {
        await axios.post('/commission/rows', { intake: intakeId, country: countryId, section, ...payload });
        toast.success('Row added');
      }
      setShowForm(false);
      setEditRow(null);
      fetchRows({ search: search || undefined });
      fetchContext();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save row');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Move this row to trash?')) return;
    try {
      await axios.delete(`/commission/rows/${id}`, { params: { section } });
      toast.success('Row moved to trash');
      fetchRows({ search: search || undefined });
      fetchContext();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete row');
    }
  };

  const handleBulkDelete = async () => {
    if (!window.confirm(`Move ${selectedIds.size} row(s) to trash?`)) return;
    try {
      await axios.post('/commission/rows/bulk-delete', { section, ids: Array.from(selectedIds) });
      toast.success('Rows moved to trash');
      setSelectedIds(new Set());
      fetchRows({ search: search || undefined });
      fetchContext();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Bulk delete failed');
    }
  };

  const handleBulkSave = async (updates) => {
    if (!window.confirm(`Update ${selectedIds.size} selected record${selectedIds.size > 1 ? 's' : ''}?`)) return;
    try {
      await axios.post('/commission/rows/bulk-edit', { section, ids: Array.from(selectedIds), updates });
      toast.success(`${selectedIds.size} row(s) updated`);
      setSelectedIds(new Set());
      setShowBulkEdit(false);
      fetchRows({ search: search || undefined });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Bulk update failed');
    }
  };

  const handleBulkImport = async (importedRows) => {
    if (!importedRows || importedRows.length === 0) {
      toast.error('No valid data to import');
      return { total: 0, created: 0, failed: 0, failures: [] };
    }
    setBulkImporting(true);
    try {
      const prepared = importedRows.map(r => {
        if (section === 'department') {
          return {
            _row: r._row,
            university: r.university || '',
            channelPartner: r.channelPartner || '',
            directIndirect: r.directIndirect || 'Direct',
          };
        }
        return {
          _row: r._row,
          university: r.university || '',
          undergraduate: r.undergraduate || '',
          postgraduate: r.postgraduate || '',
          ...(section === 'shareholder' ? { partner: r.partner || '' } : {}),
          remarks: r.remarks || '',
        };
      });
      const res = await axios.post('/commission/rows/bulk-import', {
        section, intake: intakeId, country: countryId, rows: prepared
      });
      const created = res.data.created || 0;
      const updated = res.data.updated || 0;
      const failed = res.data.failed || 0;
      const summary = { total: created + updated + failed, created: created + updated, failed, failures: res.data.failures || [] };
      if (failed > 0) {
        toast(`${created} added, ${updated} updated, ${failed} skipped`, { icon: '⚠️' });
      } else {
        toast.success(`${created} added, ${updated} updated`);
      }
      fetchRows({ search: search || undefined });
      fetchContext();
      return summary;
    } catch (err) {
      toast.error(err.response?.data?.message || 'Bulk import failed');
      throw err;
    } finally {
      setBulkImporting(false);
    }
  };

  const openColumnPicker = (target) => setColumnPickerFor(target);

  const handleColumnsConfirm = (columnKeys) => {
    const target = columnPickerFor;
    setColumnPickerFor(null);
    if (target === 'excel') exportExcelFile(columnKeys);
    else if (target === 'pdf') exportPDF(columnKeys);
    else if (target === 'print') handlePrint(columnKeys);
  };

  const exportSource = () => (selectedIds.size > 0 ? sortedRows.filter(r => selectedIds.has(r._id)) : sortedRows)
    .map((r, i) => ({ ...r, sno: i + 1 }));

  const exportExcelFile = (columnKeys) => {
    const columns = columnKeys.map(k => exportColumns.find(c => c.key === k)).filter(Boolean);
    const source = exportSource();
    const sheetRows = [];
    if (note.headerNote) sheetRows.push({ [columns[0].label]: note.headerNote });
    source.forEach(r => {
      const row = {};
      columns.forEach(col => { row[col.label] = getExportValue(r, col.key); });
      sheetRows.push(row);
    });
    if (note.footerNote) sheetRows.push({ [columns[0].label]: note.footerNote });
    const ws = XLSX.utils.json_to_sheet(sheetRows, { skipHeader: false });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sectionLabel(section));
    XLSX.writeFile(wb, `Commission_${sectionLabel(section)}_${countryInfo?.name || ''}_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
    toastExcel();
  };

  const exportPDF = (columnKeys) => {
    const columns = columnKeys.map(k => exportColumns.find(c => c.key === k)).filter(Boolean);
    const source = exportSource();
    const doc = new jsPDF({ orientation: 'landscape' });
    let y = 16;
    doc.setFontSize(14);
    doc.text(`${countryInfo?.name || ''} — ${sectionLabel(section)} Commission`, 14, y);
    y += 6;
    doc.setFontSize(9);
    doc.text(`${intakeName}  |  Generated: ${format(new Date(), 'PPP')}  |  Total: ${source.length} record${source.length !== 1 ? 's' : ''}`, 14, y);
    y += 6;
    if (note.headerNote) {
      doc.setFontSize(9);
      doc.setFont(undefined, 'italic');
      const lines = doc.splitTextToSize(note.headerNote, 270);
      doc.text(lines, 14, y);
      y += lines.length * 4 + 3;
      doc.setFont(undefined, 'normal');
    }
    doc.autoTable({
      startY: y,
      head: [columns.map(c => c.label)],
      body: source.map(r => columns.map(c => getExportValue(r, c.key) || '—')),
      styles: { fontSize: 8, cellPadding: 1.5, overflow: 'linebreak' },
      headStyles: { fillColor: [46, 79, 143], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [245, 248, 255] },
      margin: { left: 8, right: 8 },
      didDrawPage: () => {},
    });
    let finalY = doc.lastAutoTable.finalY + 6;
    if (note.footerNote) {
      doc.setFontSize(9);
      doc.setFont(undefined, 'italic');
      const lines = doc.splitTextToSize(note.footerNote, 270);
      if (finalY + lines.length * 4 > 200) { doc.addPage(); finalY = 16; }
      doc.text(lines, 14, finalY);
      doc.setFont(undefined, 'normal');
    }
    doc.save(`Commission_${sectionLabel(section)}_${countryInfo?.name || ''}_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
    toastPDF();
  };

  const handlePrint = (columnKeys) => {
    const columns = columnKeys.map(k => exportColumns.find(c => c.key === k)).filter(Boolean);
    const source = exportSource();
    const escapeHtml = (str) => String(str ?? '').replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
    const bodyRows = source.map(r => `<tr>${columns.map(c => `<td>${escapeHtml(getExportValue(r, c.key)) || '—'}</td>`).join('')}</tr>`).join('');
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
<title>${sectionLabel(section)} Commission — ${countryInfo?.name || ''}</title>
<style>
  body{font-family:Arial,sans-serif;font-size:11px;color:#111;margin:20px}
  h1{font-size:16px;margin:0 0 4px}
  .meta{color:#666;font-size:10px;margin-bottom:10px}
  .note{font-style:italic;font-size:10.5px;margin:8px 0;white-space:pre-wrap}
  table{width:100%;border-collapse:collapse}
  th{background:#333;color:#fff;padding:6px 8px;text-align:left;font-size:10px}
  td{padding:5px 8px;border-bottom:1px solid #e5e7eb;vertical-align:top}
  @media print{@page{margin:10mm}}
</style></head><body>
<h1>${escapeHtml(countryInfo?.name || '')} — ${sectionLabel(section)} Commission</h1>
<p class="meta">${escapeHtml(intakeName)} | Generated: ${format(new Date(), 'PPP')} | Total: ${source.length} record${source.length !== 1 ? 's' : ''}</p>
${note.headerNote ? `<p class="note">${escapeHtml(note.headerNote)}</p>` : ''}
<table><thead><tr>${columns.map(c => `<th>${c.label}</th>`).join('')}</tr></thead>
<tbody>${bodyRows}</tbody></table>
${note.footerNote ? `<p class="note">${escapeHtml(note.footerNote)}</p>` : ''}
</body></html>`;
    const win = window.open('', '_blank');
    if (!win) { toast.error('Pop-up blocked. Please allow pop-ups to print.'); return; }
    win.document.write(html);
    win.document.close();
    win.onload = () => { win.focus(); win.print(); };
    win.onafterprint = () => win.close();
  };

  const columnPickerInitialSelected = useMemo(() => exportColumns.map(c => c.key), [exportColumns]);

  if (!meta) {
    return <div className="cms-page"><p className="cms-muted">Unknown Commission section.</p></div>;
  }
  if (!canView) {
    return <div className="cms-page"><p className="cms-muted">You do not have permission to view {sectionLabel(section)} for this country.</p></div>;
  }

  return (
    <div className="cms-page">
      <div className="cms-breadcrumb">
        <Link to={base}>Commission</Link> <span>/</span>
        <Link to={`${base}/${intakeId}`}>{intakeName}</Link> <span>/</span>
        <Link to={`${base}/${intakeId}/${countryId}`}>{countryInfo?.name || '…'}</Link> <span>/</span>
        <span>{sectionLabel(section)}</span>
      </div>

      <div className="cms-page-head">
        <div>
          <h2 className="cms-heading-with-flag"><CountryFlag country={countryInfo} size={24} rounded={4} /> {countryInfo?.name} — {sectionLabel(section)}</h2>
          <p className="cms-page-sub">{intakeName}</p>
        </div>
        <div className="cms-page-actions">
          {meta.hasNote && canEdit && (
            <button className="cms-btn cms-btn-ghost" onClick={() => setShowNoteEditor(true)}>Edit Note</button>
          )}
          {canImport && (
            <button className="cms-btn cms-btn-ghost" onClick={() => setShowBulkImport(true)}><IconFile /> Import</button>
          )}
          {canExportExcel && (
            <button className="cms-btn cms-btn-ghost" onClick={() => openColumnPicker('excel')} disabled={!rows.length}><IconDownload /> Excel</button>
          )}
          {canExportPdf && (
            <button className="cms-btn cms-btn-ghost" onClick={() => openColumnPicker('pdf')} disabled={!rows.length}><IconDownload /> PDF</button>
          )}
          {canPrint && (
            <button className="cms-btn cms-btn-ghost" onClick={() => openColumnPicker('print')} disabled={!rows.length}><IconPrint /> Print</button>
          )}
          {canCreate && (
            <button className="cms-btn cms-btn-primary" onClick={() => { setEditRow(null); setShowForm(true); }}>+ Add</button>
          )}
        </div>
      </div>

      {meta.hasNote && note.headerNote && (
        <div className="cms-note cms-note-header">{note.headerNote}</div>
      )}

      <div className="cms-searchbar">
        <span className="cms-search-icon"><IconSearch size={15} /></span>
        <input
          type="text"
          placeholder={`Search ${sectionLabel(section).toLowerCase()} rows…`}
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        {search && <button className="cms-search-clear" onClick={() => setSearch('')}>×</button>}
      </div>

      {selectedIds.size > 0 && (
        <div className="cms-bulk-bar">
          <span>{selectedIds.size} selected</span>
          {canBulkEdit && <button onClick={() => setShowBulkEdit(true)}>Bulk Edit</button>}
          {canDelete && <button className="cms-danger" onClick={handleBulkDelete}>Delete Selected</button>}
          <button className="cms-link-btn" onClick={() => setSelectedIds(new Set())}>Clear selection</button>
        </div>
      )}

      <div className="cms-table-wrap">
        <table className="cms-table">
          <thead>
            <tr>
              <th className="cms-th-check">
                <input type="checkbox" checked={rows.length > 0 && selectedIds.size === rows.length} onChange={toggleAll} />
              </th>
              <th className="cms-th-sno">S.No</th>
              {sortTh('university', 'Name')}
              {section === 'department' ? (
                <>
                  {sortTh('channelPartner', 'Channel Partner')}
                  {sortTh('directIndirect', 'Direct/Indirect')}
                </>
              ) : (
                <>
                  {sortTh('undergraduate', 'Undergraduate')}
                  {sortTh('postgraduate', 'Postgraduate')}
                  {meta.hasPartner && sortTh('partner', 'Admission Partner')}
                  {sortTh('remarks', 'Remarks')}
                </>
              )}
              <th className="cms-th-actions">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={8} className="cms-empty-hint">Loading…</td></tr>
            )}
            {!loading && rows.length === 0 && (
              <tr><td colSpan={8} className="cms-empty-hint">No rows yet.</td></tr>
            )}
            {!loading && sortedRows.map((r, idx) => (
              <tr key={r._id}>
                <td><input type="checkbox" checked={selectedIds.has(r._id)} onChange={() => toggleSelect(r._id)} /></td>
                <td className="cms-td-sno">{idx + 1}</td>
                <td className="cms-td-name">{r.university}</td>
                {section === 'department' ? (
                  <>
                    <td>{r.channelPartner || <span className="cms-td-empty">—</span>}</td>
                    <td><span className={`cms-badge cms-badge-${(r.directIndirect || '').toLowerCase()}`}>{r.directIndirect}</span></td>
                  </>
                ) : (
                  <>
                    <td className="cms-td-wrap">{r.undergraduate || <span className="cms-td-empty">—</span>}</td>
                    <td className="cms-td-wrap">{r.postgraduate || <span className="cms-td-empty">—</span>}</td>
                    {meta.hasPartner && <td className="cms-td-wrap">{r.partner || <span className="cms-td-empty">—</span>}</td>}
                    <td className="cms-td-wrap">{r.remarks || <span className="cms-td-empty">—</span>}</td>
                  </>
                )}
                <td className="cms-td-actions">
                  {canEdit && (
                    <button className="cms-icon-sm" title="Edit" onClick={() => { setEditRow(r); setShowForm(true); }}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                    </button>
                  )}
                  {canDelete && (
                    <button className="cms-icon-sm cms-danger" title="Delete" onClick={() => handleDelete(r._id)}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" /></svg>
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {meta.hasNote && note.footerNote && (
        <div className="cms-note cms-note-footer">{note.footerNote}</div>
      )}

      <div className="cms-footer">
        <span>{rows.length} record{rows.length !== 1 ? 's' : ''}</span>
      </div>

      {showForm && (
        <CommissionRowFormModal
          section={section}
          row={editRow}
          onSave={handleSave}
          onClose={() => { setShowForm(false); setEditRow(null); }}
        />
      )}

      {showBulkEdit && (
        <CommissionBulkEditModal
          section={section}
          count={selectedIds.size}
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
          title={`Bulk Import — ${sectionLabel(section)}`}
          fields={importFields}
          requiredField={{ key: 'university', label: 'Name' }}
          dateFields={[]}
          textMode
          optionsByField={optionsByField}
        />
      )}

      {showNoteEditor && (
        <CommissionNoteModal
          initialNote={note}
          onSave={async (updated) => {
            try {
              const res = await axios.put('/commission/notes', {
                intake: intakeId, country: countryId, section, ...updated
              });
              setNote(res.data.note);
              setShowNoteEditor(false);
              toast.success('Note updated');
            } catch (err) {
              toast.error(err.response?.data?.message || 'Failed to update note');
            }
          }}
          onClose={() => setShowNoteEditor(false)}
        />
      )}

      {columnPickerFor && (
        <SelectColumnsModal
          columns={exportColumns}
          initialSelected={columnPickerInitialSelected}
          title={columnPickerFor === 'excel' ? 'Export to Excel' : columnPickerFor === 'pdf' ? 'Export to PDF' : `Print ${sectionLabel(section)}`}
          actionLabel={columnPickerFor === 'print' ? 'Print' : 'Export'}
          onConfirm={handleColumnsConfirm}
          onClose={() => setColumnPickerFor(null)}
        />
      )}
    </div>
  );
}

export default function CommissionSectionPage() {
  const { section } = useParams();
  return (
    <CommissionPinGate key={section} section={section}>
      <CommissionSectionContent />
    </CommissionPinGate>
  );
}
