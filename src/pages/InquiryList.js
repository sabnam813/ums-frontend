import React, { useState, useEffect, useCallback, useMemo } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import Select from 'react-select';
import BulkImportModal from '../components/shared/BulkImportModal';
import InquiryBulkEditModal from '../components/shared/InquiryBulkEditModal';
import './InquiryList.css';

const STAGE_OPTIONS = ['New', 'Follow-up', 'Converted', 'Closed'];

const INQUIRY_IMPORT_FIELDS = [
  { key: 'date', label: 'Date', aliases: ['inquirydate'] },
  { key: 'referredBy', label: 'Referred By', aliases: ['referral', 'referrer'] },
  { key: 'applicantName', label: 'Name of Applicants', aliases: ['name', 'applicant', 'studentname'] },
  { key: 'country', label: 'Country', aliases: [] },
  { key: 'level', label: 'Level', aliases: ['programlevel'] },
  { key: 'stage', label: 'Stage', aliases: ['status'] },
  { key: 'mode', label: 'Mode / Channel', aliases: ['channel', 'mode'] },
  { key: 'respondedBy', label: 'Responded By', aliases: ['respondent'] },
  { key: 'emailType', label: 'Email Type', aliases: [] },
  { key: 'remarks', label: 'Remarks', aliases: ['notes', 'comments'] },
];

const menuPortalProps = {
  menuPortalTarget: typeof document !== 'undefined' ? document.body : null,
  menuPosition: 'fixed',
  styles: { menuPortal: (base) => ({ ...base, zIndex: 9999 }) },
};

const stageClass = (stage) => {
  const s = (stage || '').toLowerCase();
  if (s === 'new') return 'new';
  if (s === 'closed' || s === 'lost') return 'closed';
  if (s === 'converted' || s === 'enrolled') return 'converted';
  if (s.includes('follow') || s.includes('suggest') || s.includes('pending')) return 'followup';
  return 'neutral';
};

const emptyForm = {
  date: new Date().toISOString().slice(0, 10),
  referredBy: '',
  applicantName: '',
  country: '',
  level: '',
  stage: 'New',
  mode: '',
  respondedBy: '',
  emailType: '',
  remarks: '',
};

const toOpts = (arr) => arr.map(v => ({ value: v, label: v }));

export default function InquiryList() {
  const [inquiries, setInquiries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [importing, setImporting] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [showBulkEdit, setShowBulkEdit] = useState(false);

  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({ stage: [], country: [], level: [], dateFrom: '', dateTo: '' });

  const fetchInquiries = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get('/inquiries');
      setInquiries(res.data.inquiries || []);
    } catch (err) {
      toast.error('Failed to load inquiries');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchInquiries(); }, [fetchInquiries]);

  const countryOptions = useMemo(() => toOpts([...new Set(inquiries.map(i => i.country).filter(Boolean))].sort()), [inquiries]);
  const levelOptions = useMemo(() => toOpts([...new Set(inquiries.map(i => i.level).filter(Boolean))].sort()), [inquiries]);
  const stageOptions = useMemo(() => {
    const fromData = inquiries.map(i => i.stage).filter(Boolean);
    return toOpts([...new Set([...STAGE_OPTIONS, ...fromData])].sort());
  }, [inquiries]);

  const activeFilterCount = filters.stage.length + filters.country.length + filters.level.length
    + (filters.dateFrom ? 1 : 0) + (filters.dateTo ? 1 : 0);

  const filtered = useMemo(() => {
    let d = inquiries;
    if (search.trim()) {
      const q = search.toLowerCase();
      d = d.filter(i =>
        (i.applicantName || '').toLowerCase().includes(q) ||
        (i.referredBy || '').toLowerCase().includes(q) ||
        (i.country || '').toLowerCase().includes(q) ||
        (i.remarks || '').toLowerCase().includes(q)
      );
    }
    if (filters.stage.length) d = d.filter(i => filters.stage.includes(i.stage));
    if (filters.country.length) d = d.filter(i => filters.country.includes(i.country));
    if (filters.level.length) d = d.filter(i => filters.level.includes(i.level));
    if (filters.dateFrom) d = d.filter(i => i.date && new Date(i.date) >= new Date(filters.dateFrom));
    if (filters.dateTo) d = d.filter(i => i.date && new Date(i.date) <= new Date(filters.dateTo));
    return d;
  }, [inquiries, search, filters]);

  const clearFilters = () => setFilters({ stage: [], country: [], level: [], dateFrom: '', dateTo: '' });

  const openAdd = () => {
    setEditing(null);
    setForm(emptyForm);
    setShowModal(true);
  };

  const openEdit = (inquiry) => {
    setEditing(inquiry);
    setForm({
      date: inquiry.date ? inquiry.date.slice(0, 10) : '',
      referredBy: inquiry.referredBy || '',
      applicantName: inquiry.applicantName || '',
      country: inquiry.country || '',
      level: inquiry.level || '',
      stage: inquiry.stage || 'New',
      mode: inquiry.mode || '',
      respondedBy: inquiry.respondedBy || '',
      emailType: inquiry.emailType || '',
      remarks: inquiry.remarks || '',
    });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditing(null);
  };

  const setField = (key, val) => setForm(f => ({ ...f, [key]: val }));

  const handleSave = async () => {
    if (!form.applicantName.trim()) {
      toast.error('Applicant name is required');
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        const res = await axios.put(`/inquiries/${editing._id}`, form);
        setInquiries(prev => prev.map(i => i._id === editing._id ? res.data.inquiry : i));
        toast.success('Inquiry updated');
      } else {
        const res = await axios.post('/inquiries', form);
        setInquiries(prev => [res.data.inquiry, ...prev]);
        toast.success('Inquiry added');
      }
      closeModal();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save inquiry');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this inquiry? This cannot be undone.')) return;
    try {
      await axios.delete(`/inquiries/${id}`);
      setInquiries(prev => prev.filter(i => i._id !== id));
      toast.success('Inquiry deleted');
    } catch (err) {
      toast.error('Failed to delete inquiry');
    }
  };

  const handleBulkImport = async (rows) => {
    if (!rows || rows.length === 0) {
      toast.error('No valid data to import');
      return;
    }
    setImporting(true);
    try {
      const res = await axios.post('/inquiries/bulk/create', { inquiries: rows });
      setInquiries(prev => [...res.data.inquiries, ...prev]);
      toast.success(`${res.data.created} inquir${res.data.created > 1 ? 'ies' : 'y'} imported`);
      setShowBulkImport(false);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Bulk import failed');
    } finally {
      setImporting(false);
    }
  };

  const toggleSelect = (id) => {
    setSelectedIds(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });
  };
  const toggleAll = () => {
    if (selectedIds.size === filtered.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(filtered.map(i => i._id)));
  };

  const handleBulkSave = async (updates) => {
    try {
      const ids = Array.from(selectedIds);
      await axios.put('/inquiries/bulk/update', { ids, updates });
      setInquiries(prev => prev.map(i =>
        selectedIds.has(i._id) ? { ...i, ...updates } : i
      ));
      toast.success(`${ids.length} inquir${ids.length > 1 ? 'ies' : 'y'} updated`);
      setSelectedIds(new Set());
      setShowBulkEdit(false);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Bulk update failed');
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!window.confirm(`Delete ${selectedIds.size} selected inquir${selectedIds.size > 1 ? 'ies' : 'y'}? This cannot be undone.`)) return;
    try {
      const ids = Array.from(selectedIds);
      await axios.delete('/inquiries/bulk/delete', { data: { ids } });
      setInquiries(prev => prev.filter(i => !selectedIds.has(i._id)));
      toast.success(`${ids.length} inquir${ids.length > 1 ? 'ies' : 'y'} deleted`);
      setSelectedIds(new Set());
    } catch (err) {
      toast.error(err.response?.data?.message || 'Bulk delete failed');
    }
  };

  if (loading) return (
    <div className="dt-loading"><div className="dt-spinner" /><p>Loading inquiries…</p></div>
  );

  return (
    <div className="inquiry-list animate-fade">
      <div className="page-header">
        <div>
          <h2>Inquiries</h2>
          <p>Track and respond to incoming applicant inquiries</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            className="btn-add"
            style={{ background: 'var(--gray-100)', color: 'var(--gray-700)', border: '1.5px solid var(--gray-200)' }}
            onClick={() => setShowBulkImport(true)}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            Bulk Import
          </button>
          <button className="btn-add" onClick={openAdd}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            New Inquiry
          </button>
        </div>
      </div>

      <div className="inquiry-toolbar">
        <div className="inquiry-search">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            placeholder="Search by name, referrer, country, or remarks…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        {selectedIds.size > 0 && (
          <div className="bulk-bar">
            <span>{selectedIds.size} selected</span>
            <button className="bulk-btn edit" onClick={() => setShowBulkEdit(true)}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
              Bulk Edit
            </button>
            <button className="bulk-btn danger" onClick={handleBulkDelete}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
              Delete
            </button>
          </div>
        )}
        <button
          className={`inquiry-filter-toggle ${showFilters ? 'active' : ''}`}
          onClick={() => setShowFilters(v => !v)}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
          </svg>
          Filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
        </button>
      </div>

      {showFilters && (
        <div className="inquiry-filter-panel">
          <div className="inquiry-filter-field">
            <label>Stage</label>
            <Select isMulti className="custom-select" classNamePrefix="react-select" {...menuPortalProps}
              options={stageOptions}
              value={stageOptions.filter(o => filters.stage.includes(o.value))}
              onChange={opts => setFilters(f => ({ ...f, stage: opts.map(o => o.value) }))}
              placeholder="All…" />
          </div>
          <div className="inquiry-filter-field">
            <label>Country</label>
            <Select isMulti className="custom-select" classNamePrefix="react-select" {...menuPortalProps}
              options={countryOptions}
              value={countryOptions.filter(o => filters.country.includes(o.value))}
              onChange={opts => setFilters(f => ({ ...f, country: opts.map(o => o.value) }))}
              placeholder="All…" />
          </div>
          <div className="inquiry-filter-field">
            <label>Level</label>
            <Select isMulti className="custom-select" classNamePrefix="react-select" {...menuPortalProps}
              options={levelOptions}
              value={levelOptions.filter(o => filters.level.includes(o.value))}
              onChange={opts => setFilters(f => ({ ...f, level: opts.map(o => o.value) }))}
              placeholder="All…" />
          </div>
          <div className="inquiry-filter-field">
            <label>From</label>
            <input type="date" value={filters.dateFrom} onChange={e => setFilters(f => ({ ...f, dateFrom: e.target.value }))} />
          </div>
          <div className="inquiry-filter-field">
            <label>To</label>
            <input type="date" value={filters.dateTo} onChange={e => setFilters(f => ({ ...f, dateTo: e.target.value }))} />
          </div>
          {activeFilterCount > 0 && (
            <button className="inquiry-clear-filters" onClick={clearFilters}>Clear all</button>
          )}
        </div>
      )}

      <div className="inquiry-table-wrap">
        <table className="inquiry-table">
          <thead>
            <tr>
              <th className="th-check">
                <input type="checkbox"
                  checked={selectedIds.size === filtered.length && filtered.length > 0}
                  onChange={toggleAll} title="Select all" />
              </th>
              <th>Date</th>
              <th>Referred By</th>
              <th>Name of Applicant</th>
              <th>Country</th>
              <th>Level</th>
              <th>Stage</th>
              <th>Mode / Channel</th>
              <th>Responded By</th>
              <th>Email Type</th>
              <th>Remarks</th>
              <th className="th-actions"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(i => (
              <tr key={i._id} className={selectedIds.has(i._id) ? 'selected' : ''}>
                <td className="td-check">
                  <input type="checkbox" checked={selectedIds.has(i._id)}
                    onChange={() => toggleSelect(i._id)} onClick={e => e.stopPropagation()} />
                </td>
                <td>{i.date ? new Date(i.date).toLocaleDateString() : <span className="td-empty">—</span>}</td>
                <td>{i.referredBy || <span className="td-empty">—</span>}</td>
                <td className="td-name">{i.applicantName}</td>
                <td>{i.country || <span className="td-empty">—</span>}</td>
                <td>{i.level || <span className="td-empty">—</span>}</td>
                <td>
                  <span className={`stage-badge ${stageClass(i.stage)}`}>{i.stage || 'New'}</span>
                </td>
                <td>{i.mode || <span className="td-empty">—</span>}</td>
                <td>{i.respondedBy || <span className="td-empty">—</span>}</td>
                <td>{i.emailType || <span className="td-empty">—</span>}</td>
                <td className="td-remarks">{i.remarks || <span className="td-empty">—</span>}</td>
                <td className="td-actions">
                  <div className="inquiry-row-actions">
                    <button className="inquiry-row-btn edit" title="Edit" onClick={() => openEdit(i)}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                      </svg>
                    </button>
                    <button className="inquiry-row-btn delete" title="Delete" onClick={() => handleDelete(i._id)}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                        <path d="M10 11v6" /><path d="M14 11v6" />
                        <path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
                      </svg>
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {filtered.length === 0 && (
          <div className="inquiry-empty">
            <p>{search || activeFilterCount > 0 ? 'No inquiries match your search or filters.' : 'No inquiries yet. Click "New Inquiry" to add one.'}</p>
          </div>
        )}
      </div>

      {showModal && (
        <div className="inquiry-modal-overlay" onClick={closeModal}>
          <div className="inquiry-modal" onClick={e => e.stopPropagation()}>
            <div className="inquiry-modal-header">
              <h3>{editing ? 'Edit Inquiry' : 'New Inquiry'}</h3>
              <button className="inquiry-modal-close" onClick={closeModal}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <div className="inquiry-modal-body">
              <div className="inquiry-field">
                <label>Date</label>
                <input type="date" value={form.date} onChange={e => setField('date', e.target.value)} />
              </div>
              <div className="inquiry-field">
                <label>Referred By</label>
                <input type="text" value={form.referredBy} onChange={e => setField('referredBy', e.target.value)} />
              </div>
              <div className="inquiry-field full">
                <label>Name of Applicant *</label>
                <input type="text" value={form.applicantName} onChange={e => setField('applicantName', e.target.value)} />
              </div>
              <div className="inquiry-field">
                <label>Country</label>
                <input type="text" value={form.country} onChange={e => setField('country', e.target.value)} />
              </div>
              <div className="inquiry-field">
                <label>Level</label>
                <input type="text" value={form.level} onChange={e => setField('level', e.target.value)} />
              </div>
              <div className="inquiry-field">
                <label>Stage</label>
                <input
                  type="text"
                  list="stage-suggestions"
                  value={form.stage}
                  onChange={e => setField('stage', e.target.value)}
                  placeholder="New, Follow-up, Course Suggested…"
                />
                <datalist id="stage-suggestions">
                  {stageOptions.map(opt => <option key={opt.value} value={opt.value} />)}
                </datalist>
              </div>
              <div className="inquiry-field">
                <label>Mode / Channel</label>
                <input type="text" value={form.mode} onChange={e => setField('mode', e.target.value)} placeholder="Phone, Email, Walk-in…" />
              </div>
              <div className="inquiry-field">
                <label>Responded By</label>
                <input type="text" value={form.respondedBy} onChange={e => setField('respondedBy', e.target.value)} />
              </div>
              <div className="inquiry-field">
                <label>Email Type</label>
                <input type="text" value={form.emailType} onChange={e => setField('emailType', e.target.value)} />
              </div>
              <div className="inquiry-field full">
                <label>Remarks</label>
                <textarea value={form.remarks} onChange={e => setField('remarks', e.target.value)} />
              </div>
            </div>

            <div className="inquiry-modal-footer">
              <button className="inquiry-btn-cancel" onClick={closeModal}>Cancel</button>
              <button className="inquiry-btn-save" onClick={handleSave} disabled={saving}>
                {saving ? 'Saving…' : editing ? 'Save Changes' : 'Add Inquiry'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showBulkEdit && (
        <InquiryBulkEditModal
          count={selectedIds.size}
          stageOptions={stageOptions.map(o => o.value)}
          countryOptions={countryOptions.map(o => o.value)}
          levelOptions={levelOptions.map(o => o.value)}
          onSave={handleBulkSave}
          onClose={() => setShowBulkEdit(false)}
        />
      )}

      <BulkImportModal
        isOpen={showBulkImport}
        onClose={() => setShowBulkImport(false)}
        onImport={handleBulkImport}
        loading={importing}
        title="Bulk Import Inquiries"
        fields={INQUIRY_IMPORT_FIELDS}
        requiredField={{ key: 'applicantName', label: 'Name of Applicants' }}
        dateFields={['date']}
      />
    </div>
  );
}
