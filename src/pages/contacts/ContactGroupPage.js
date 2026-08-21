import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useOutletContext } from 'react-router-dom';
import axios from 'axios';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import ContactFormModal from '../../components/contacts/ContactFormModal';
import { toastExcel, toastPDF } from '../../utils/exportHelpers';
import '../country/DataTable.css';
import './Contacts.css';

export default function ContactGroupPage() {
  const { slug } = useParams();
  const outletCtx = useOutletContext() || {};
  const isAdmin = outletCtx.isAdmin;
  const contactGroupsCtx = outletCtx.contactGroups;

  const [group, setGroup] = useState(null);
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editContact, setEditContact] = useState(null);

  const groupMeta = useMemo(
    () => (contactGroupsCtx || []).find(g => g.slug === slug),
    [contactGroupsCtx, slug]
  );

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const groupId = groupMeta?._id;
      let resolvedGroup = groupMeta;
      if (groupId) {
        const gRes = await axios.get(`/contact-groups/${groupId}`);
        resolvedGroup = gRes.data.group;
      }
      setGroup(resolvedGroup || null);

      if (resolvedGroup?._id) {
        const cRes = await axios.get(`/contacts/group/${resolvedGroup._id}`);
        setContacts(cRes.data.contacts || []);
      } else {
        setContacts([]);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load contacts');
      setContacts([]);
    } finally {
      setLoading(false);
    }
  }, [groupMeta]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const fields = useMemo(
    () => [...(group?.fields || [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
    [group]
  );

  const filteredContacts = useMemo(() => {
    if (!search.trim()) return contacts;
    const q = search.trim().toLowerCase();
    return contacts.filter(c =>
      Object.values(c.data || {}).some(v => String(v).toLowerCase().includes(q))
    );
  }, [contacts, search]);

  const handleSaveContact = async (values) => {
    try {
      if (editContact) {
        await axios.put(`/contacts/${editContact._id}`, { data: values });
        toast.success('Contact updated');
      } else {
        await axios.post('/contacts', { group: group._id, data: values });
        toast.success('Contact added');
      }
      setShowForm(false);
      setEditContact(null);
      await fetchAll();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save contact');
      throw err;
    }
  };

  const handleDeleteContact = async (id) => {
    if (!window.confirm('Move this contact to trash? It can be restored later from the Trash page.')) return;
    try {
      await axios.delete(`/contacts/${id}`);
      setContacts(prev => prev.filter(c => c._id !== id));
      toast.success('Contact moved to trash');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete contact');
    }
  };

  const exportRows = () => filteredContacts.map((c, i) => {
    const row = { 'S.N': i + 1 };
    fields.forEach(f => { row[f.label] = c.data?.[f.key] || ''; });
    return row;
  });

  const groupName = group?.name || slug;

  const exportExcel = () => {
    const ws = XLSX.utils.json_to_sheet(exportRows());
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, groupName.slice(0, 31));
    XLSX.writeFile(wb, `UMS_Contacts_${groupName}_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
    toastExcel();
  };

  const exportPDF = () => {
    const doc = new jsPDF({ orientation: 'landscape' });
    doc.setFontSize(14);
    doc.text(`UCA Management System – ${groupName} Contacts`, 14, 16);
    doc.setFontSize(9);
    doc.text(`Generated: ${format(new Date(), 'PPP')}  |  Total: ${filteredContacts.length} contact(s)`, 14, 22);
    const cols = ['S.N', ...fields.map(f => f.label)];
    const rows = filteredContacts.map((c, i) => [i + 1, ...fields.map(f => c.data?.[f.key] || '—')]);
    doc.autoTable({
      startY: 26, head: [cols], body: rows,
      styles: { fontSize: 7, cellPadding: 1.5, overflow: 'linebreak' },
      headStyles: { fillColor: [21, 101, 192], textColor: 255, fontStyle: 'bold', fontSize: 7.5 },
      alternateRowStyles: { fillColor: [245, 248, 255] },
      margin: { left: 8, right: 8 },
      tableWidth: 'auto',
    });
    doc.save(`UMS_Contacts_${groupName}_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
    toastPDF();
  };

  const exportCSV = () => {
    const ws = XLSX.utils.json_to_sheet(exportRows());
    const csv = XLSX.utils.sheet_to_csv(ws);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `UMS_Contacts_${groupName}_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click(); URL.revokeObjectURL(url);
    toast.success('Downloaded as CSV');
  };

  const handlePrint = () => {
    const headers = ['S.N', ...fields.map(f => f.label)].map(h => `<th>${h}</th>`).join('');
    const rowsHtml = filteredContacts.map((c, i) => {
      const cells = [i + 1, ...fields.map(f => c.data?.[f.key] || '—')]
        .map(v => `<td>${v}</td>`).join('');
      return `<tr>${cells}</tr>`;
    }).join('');

    const printHtml = `<!DOCTYPE html><html><head><title>${groupName} Contacts</title>
<style>
@page { size: A4 landscape; margin: 10mm; }
* { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
body { font-family: Arial, sans-serif; font-size: 10px; margin: 0; color: #000; }
h2 { margin: 0 0 6px; font-size: 15px; }
p { margin: 0 0 8px; color: #555; font-size: 9px; }
table { border-collapse: collapse; width: 100%; }
th, td { border: 1px solid #ccc; padding: 4px 6px; text-align: left; word-wrap: break-word; }
th { background: #f0f0f0; font-weight: 600; }
tr:nth-child(even) { background: #fafafa; }
</style></head><body>
<h2>${groupName} Contacts</h2>
<p>Printed ${new Date().toLocaleDateString()} · ${filteredContacts.length} contact(s)</p>
<table><thead><tr>${headers}</tr></thead><tbody>${rowsHtml}</tbody></table>
</body></html>`;

    const win = window.open('', '_blank');
    win.document.write(printHtml);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 300);
  };

  if (loading) {
    return (
      <div className="dt-loading"><div className="dt-spinner" /><p>Loading contacts…</p></div>
    );
  }

  if (!group) {
    return <div className="apps-empty-hint">Contact group not found.</div>;
  }

  return (
    <div className="dt-root animate-fade">
      <div className="dt-header">
        <div className="dt-title-row">
          <span className="cc-flag tt-card-icon contact-page-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
              <circle cx="9" cy="7" r="4"/>
              <path d="M23 21v-1a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
          </span>
          <div>
            <h2>{group.name}</h2>
            <p>{filteredContacts.length} of {contacts.length} contacts</p>
          </div>
        </div>

        <div className="dt-actions">
          <div className="cg-search-wrap">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input
              type="text"
              placeholder="Search contacts…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="cg-search-input"
            />
          </div>

          <div className="export-group">
            <button className="export-btn" onClick={exportExcel} title="Export to Excel">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
              Excel
            </button>
            <button className="export-btn" onClick={exportCSV} title="Download as CSV">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              Download
            </button>
            <button className="export-btn" onClick={exportPDF} title="Export to PDF">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
              PDF
            </button>
            <button className="export-btn" onClick={handlePrint} title="Print">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
              Print
            </button>
          </div>

          {isAdmin && (
            <button className="add-record-btn" onClick={() => { setEditContact(null); setShowForm(true); }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14"/></svg>
              Add Contact
            </button>
          )}
        </div>
      </div>

      {fields.length === 0 && (
        <div className="apps-empty-hint">
          This group has no fields configured yet.{isAdmin ? ' Go back to Contacts and click "Manage Fields" on this group to add some.' : ''}
        </div>
      )}

      <div className="contact-cards-grid">
        {filteredContacts.map(c => (
          <div className="contact-card" key={c._id}>
            {isAdmin && (
              <div className="contact-card-actions">
                <button className="icon-btn edit" onClick={() => { setEditContact(c); setShowForm(true); }} title="Edit">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                  </svg>
                </button>
                <button className="icon-btn danger" onClick={() => handleDeleteContact(c._id)} title="Delete">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                    <path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/>
                  </svg>
                </button>
              </div>
            )}

            {fields.map((f, idx) => (
              <div className={`contact-card-field ${idx === 0 ? 'primary' : ''}`} key={f._id || f.key}>
                {idx === 0 ? (
                  <span className="contact-card-name">{c.data?.[f.key] || '—'}</span>
                ) : (
                  <>
                    <span className="contact-card-field-label">{f.label}:</span>
                    <span className="contact-card-field-value">{c.data?.[f.key] || '—'}</span>
                  </>
                )}
              </div>
            ))}
          </div>
        ))}
      </div>

      {filteredContacts.length === 0 && fields.length > 0 && (
        <div className="apps-empty-hint">
          {contacts.length === 0
            ? `No contacts in ${group.name} yet${isAdmin ? '. Click "Add Contact" to get started.' : '.'}`
            : 'No contacts match your search.'}
        </div>
      )}

      {showForm && (
        <ContactFormModal
          group={group}
          contact={editContact}
          onSave={handleSaveContact}
          onClose={() => { setShowForm(false); setEditContact(null); }}
        />
      )}
    </div>
  );
}
