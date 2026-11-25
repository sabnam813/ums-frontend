import React, { useState, useEffect, useCallback } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';
import ContactGroupModal from '../../components/contacts/ContactGroupModal';
import ContactFieldsModal from '../../components/contacts/ContactFieldsModal';
import '../admin/ApplicationsList.css';
import './Contacts.css';

export default function ContactsHome() {
  const outletCtx = useOutletContext() || {};
  const isAdmin = outletCtx.isAdmin;

  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [editGroup, setEditGroup] = useState(null);
  const [fieldsGroup, setFieldsGroup] = useState(null);

  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState(null);
  const [searching, setSearching] = useState(false);

  const fetchGroups = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get('/contact-groups');
      setGroups(res.data.groups || []);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load contact groups');
      setGroups([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchGroups(); }, [fetchGroups]);

  useEffect(() => {
    const q = search.trim();
    if (!q) { setSearchResults(null); setSearching(false); return; }

    setSearching(true);
    const handle = setTimeout(async () => {
      try {
        const res = await axios.get('/contacts/search', { params: { q } });
        setSearchResults(res.data.results || []);
      } catch (err) {
        toast.error(err.response?.data?.message || 'Search failed');
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 250);

    return () => clearTimeout(handle);
  }, [search]);

  const handleSaveGroup = async (data) => {
    try {
      if (editGroup) {
        await axios.put(`/contact-groups/${editGroup._id}`, data);
        toast.success('Contact group updated');
      } else {
        await axios.post('/contact-groups', data);
        toast.success('Contact group created');
      }
      setShowGroupModal(false);
      setEditGroup(null);
      await fetchGroups();
      outletCtx.refetchContactGroups?.();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save contact group');
    }
  };

  const handleDeleteGroup = async (id) => {
    if (!window.confirm('Move this contact group to trash? Its contacts will also be moved to trash. Everything can be restored later from the Trash page.')) return;
    try {
      await axios.delete(`/contact-groups/${id}`);
      setGroups(prev => prev.filter(g => g._id !== id));
      toast.success('Contact group moved to trash');
      outletCtx.refetchContactGroups?.();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete contact group');
    }
  };

  const handleFieldsChanged = (updatedGroup) => {
    setGroups(prev => prev.map(g => g._id === updatedGroup._id ? { ...g, fields: updatedGroup.fields } : g));
    outletCtx.refetchContactGroups?.();
  };

  const basePath = isAdmin ? '/admin/contacts' : '/contacts';

  if (loading) {
    return (
      <div className="dt-loading">
        <div className="dt-spinner" />
        <p>Loading contact groups…</p>
      </div>
    );
  }

  return (
    <div className="apps-list animate-fade">
      <div className="page-header">
        <div>
          <h2>Contacts</h2>
          <p>Organize contacts into groups.</p>
        </div>

        {isAdmin && (
          <button className="btn-add" onClick={() => { setEditGroup(null); setShowGroupModal(true); }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M12 5v14M5 12h14"/>
            </svg>
            Add Contact Group
          </button>
        )}
      </div>

      <div className="cg-search-wrap" style={{ maxWidth: 420, marginBottom: 18 }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        <input
          type="text"
          placeholder="Search all contacts by title, phone, email…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="cg-search-input"
        />
      </div>

      {searchResults !== null ? (
        <div className="contact-cards-grid">
          {searchResults.map(({ contact, group }) => {
            const fields = [...(group.fields || [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
            const basePath = isAdmin ? '/admin/contacts' : '/contacts';
            return (
              <Link
                to={`${basePath}/${group.slug}`}
                className="contact-card"
                key={contact._id}
                style={{ textDecoration: 'none', color: 'inherit' }}
              >
                <div className="contact-card-field primary">
                  <span className="contact-card-name">{contact.data?.[fields[0]?.key] || '—'}</span>
                </div>
                {fields.slice(1).map(f => (
                  <div className="contact-card-field" key={f._id || f.key}>
                    <span className="contact-card-field-label">{f.label}:</span>
                    <span className="contact-card-field-value">{contact.data?.[f.key] || '—'}</span>
                  </div>
                ))}
                <div className="contact-card-field" style={{ marginTop: 6 }}>
                  <span className="contact-card-field-label" style={{ color: 'var(--uca-blue)' }}>{group.name}</span>
                </div>
              </Link>
            );
          })}

          {!searching && searchResults.length === 0 && (
            <div className="apps-empty-hint">No contacts match "{search.trim()}" in any group.</div>
          )}
        </div>
      ) : (
      <div className="countries-grid">
        {groups.map(g => (
          <div className="country-card" key={g._id}>
            <div className="cc-header">
              <span className="cc-flag tt-card-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                  <circle cx="9" cy="7" r="4"/>
                  <path d="M23 21v-1a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                </svg>
              </span>
              {isAdmin && (
                <div className="cc-actions">
                  <button className="icon-btn" onClick={() => setFieldsGroup(g)} title="Manage Fields">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/>
                      <line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>
                    </svg>
                  </button>
                  <button className="icon-btn edit" onClick={() => { setEditGroup(g); setShowGroupModal(true); }} title="Edit">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                    </svg>
                  </button>
                  <button className="icon-btn danger" onClick={() => handleDeleteGroup(g._id)} title="Delete">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                      <path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/>
                    </svg>
                  </button>
                </div>
              )}
            </div>

            <h3 className="cc-name">{g.name}</h3>
            {g.description && <p className="cc-desc">{g.description}</p>}

            <div className="cc-stats">
              <div className="cc-stat">
                <span className="ccs-val">{g.total ?? 0}</span>
                <span className="ccs-lbl">Contacts</span>
              </div>
              <div className="cc-stat">
                <span className="ccs-val" style={{ color: 'var(--purple)' }}>{g.fields?.length ?? 0}</span>
                <span className="ccs-lbl">Fields</span>
              </div>
            </div>

            <Link to={`${basePath}/${g.slug}`} className="cc-open-btn">
              Open Contacts
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M5 12h14M12 5l7 7-7 7"/>
              </svg>
            </Link>
          </div>
        ))}

        {isAdmin && (
          <button className="country-card add-card" onClick={() => { setEditGroup(null); setShowGroupModal(true); }}>
            <div className="add-icon">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 5v14M5 12h14"/>
              </svg>
            </div>
            <span>Add New Contact Group</span>
          </button>
        )}

        {groups.length === 0 && (
          <div className="apps-empty-hint">No contact groups yet{isAdmin ? '. Click "Add New Contact Group" to get started.' : '.'}</div>
        )}
      </div>
      )}

      {showGroupModal && (
        <ContactGroupModal
          group={editGroup}
          onSave={handleSaveGroup}
          onClose={() => { setShowGroupModal(false); setEditGroup(null); }}
        />
      )}

      {fieldsGroup && (
        <ContactFieldsModal
          group={fieldsGroup}
          onChange={handleFieldsChanged}
          onClose={() => setFieldsGroup(null)}
        />
      )}
    </div>
  );
}
