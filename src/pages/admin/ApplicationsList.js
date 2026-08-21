import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';
import CountryModal from '../../components/admin/CountryModal';
import CountryGroupModal from '../../components/admin/CountryGroupModal';
import CountryFlag from '../../components/shared/CountryFlag';
import './ApplicationsList.css';

export default function ApplicationsList() {
  const outletCtx = useOutletContext() || {};

  const [countries, setCountries] = useState([]);
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editCountry, setEditCountry] = useState(null);
  const [addToGroupId, setAddToGroupId] = useState(null);
  const [saving, setSaving] = useState(false);

  const [showGroupModal, setShowGroupModal] = useState(false);
  const [editGroup, setEditGroup] = useState(null);
  const [collapsed, setCollapsed] = useState({});
  const [countrySearch, setCountrySearch] = useState('');

  const fetchCountries = useCallback(async () => {
    try {
      const res = await axios.get('/countries');
      setCountries(res.data.countries || []);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load countries');
      setCountries([]);
    }
  }, []);

  const fetchGroups = useCallback(async () => {
    try {
      const res = await axios.get('/country-groups');
      setGroups(res.data.groups || []);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load country groups');
      setGroups([]);
    }
  }, []);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    await Promise.all([fetchCountries(), fetchGroups()]);
    setLoading(false);
  }, [fetchCountries, fetchGroups]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const sortedGroups = useMemo(
    () => [...groups].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
    [groups]
  );

  const countriesByGroup = useMemo(() => {
    const map = new Map();
    sortedGroups.forEach(g => map.set(String(g._id), []));
    countries.forEach(c => {
      const gid = c.group ? String(c.group) : null;
      if (gid && map.has(gid)) {
        map.get(gid).push(c);
      } else {

        if (!map.has('__orphan__')) map.set('__orphan__', []);
        map.get('__orphan__').push(c);
      }
    });
    map.forEach(list => list.sort((a, b) => (a.order ?? 0) - (b.order ?? 0)));
    return map;
  }, [sortedGroups, countries]);

  const toggleCollapsed = (groupId) => {
    setCollapsed(prev => ({ ...prev, [groupId]: !prev[groupId] }));
  };

  const handleSave = async (data) => {
    setSaving(true);
    try {
      if (editCountry) {
        await axios.put(`/countries/${editCountry._id}`, data);
        toast.success('Country updated');
      } else {
        await axios.post('/countries', { ...data, group: data.group || addToGroupId || undefined });
        toast.success('Country added');
      }
      setShowModal(false);
      setEditCountry(null);
      setAddToGroupId(null);
      await fetchAll();
      outletCtx.refetchCountries?.();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save country');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Move this country to trash? Its applications will also be moved to trash. Everything can be restored later from the Trash page.')) return;
    try {
      await axios.delete(`/countries/${id}`);
      setCountries(prev => prev.filter(c => c._id !== id));
      toast.success('Country moved to trash');
      outletCtx.refetchCountries?.();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete country');
    }
  };

  const handleMoveCountryToGroup = async (country, groupId) => {
    if (!groupId || groupId === String(country.group)) return;
    try {
      await axios.put(`/countries/${country._id}/move`, { groupId });
      toast.success(`Moved ${country.name}`);
      await fetchAll();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to move country');
    }
  };

  const handleReorderCountry = async (groupId, list, index, direction) => {
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= list.length) return;
    const reordered = [...list];
    [reordered[index], reordered[newIndex]] = [reordered[newIndex], reordered[index]];
    try {
      await axios.put(`/countries/group/${groupId}/reorder`, {
        orderedCountryIds: reordered.map(c => c._id),
      });
      await fetchCountries();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to reorder countries');
    }
  };

  const handleSaveGroup = async (data) => {
    try {
      if (editGroup) {
        await axios.put(`/country-groups/${editGroup._id}`, data);
        toast.success('Group renamed');
      } else {
        await axios.post('/country-groups', data);
        toast.success('Group created');
      }
      setShowGroupModal(false);
      setEditGroup(null);
      await fetchGroups();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save group');
    }
  };

  const handleDeleteGroup = async (group) => {
    if (!window.confirm(`Delete "${group.name}"? Any countries inside will be moved to Unassigned. None will be deleted.`)) return;
    try {
      await axios.delete(`/country-groups/${group._id}`);
      toast.success('Group deleted');
      await fetchAll();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete group');
    }
  };

  const handleReorderGroup = async (index, direction) => {
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= sortedGroups.length) return;
    const reordered = [...sortedGroups];
    [reordered[index], reordered[newIndex]] = [reordered[newIndex], reordered[index]];
    try {
      await axios.put('/country-groups/reorder/bulk', {
        orderedGroupIds: reordered.map(g => g._id),
      });
      await fetchGroups();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to reorder groups');
    }
  };

  if (loading) {
    return (
      <div className="dt-loading">
        <div className="dt-spinner" />
        <p>Loading countries…</p>
      </div>
    );
  }

  const orphaned = countriesByGroup.get('__orphan__') || [];
  const allGroupsForSelect = sortedGroups;
  const searchActive = countrySearch.trim().length > 0;
  const matchesSearch = (c) => c.name.toLowerCase().includes(countrySearch.trim().toLowerCase());
  const totalMatching = searchActive ? countries.filter(matchesSearch).length : countries.length;

  return (
    <div className="apps-list animate-fade">
      <div className="page-header">
        <div>
          <h2>Applications</h2>
          <p>Manage country applications, grouped by region. Assign users from the Users page.</p>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button
            className="btn-add"
            style={{ background: 'white', color: 'var(--uca-blue)', border: '1px solid var(--uca-blue)' }}
            onClick={() => { setEditGroup(null); setShowGroupModal(true); }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M12 5v14M5 12h14"/>
            </svg>
            Add Group
          </button>
          <button
            className="btn-add"
            onClick={() => { setEditCountry(null); setAddToGroupId(null); setShowModal(true); }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M12 5v14M5 12h14"/>
            </svg>
            Add Country
          </button>
        </div>
      </div>

      <div className="apps-search-bar">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
        </svg>
        <input
          type="text"
          placeholder="Search countries…"
          value={countrySearch}
          onChange={e => setCountrySearch(e.target.value)}
        />
        {countrySearch && (
          <button className="apps-search-clear" onClick={() => setCountrySearch('')} aria-label="Clear search">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        )}
        {searchActive && (
          <span className="apps-search-count">{totalMatching} match{totalMatching === 1 ? '' : 'es'}</span>
        )}
      </div>

      {searchActive && totalMatching === 0 && (
        <div className="apps-empty-hint">No countries match "{countrySearch}".</div>
      )}

      {sortedGroups.map((group, gIdx) => {
        const fullList = countriesByGroup.get(String(group._id)) || [];
        const list = searchActive ? fullList.filter(matchesSearch) : fullList;
        if (searchActive && list.length === 0) return null;
        const isCollapsed = searchActive ? false : !!collapsed[group._id];
        return (
          <div className="cg-section" key={group._id}>
            <div className="cg-section-header">
              <div className="cg-section-title-wrap" onClick={() => toggleCollapsed(group._id)}>
                <svg className={`cg-chevron ${isCollapsed ? '' : 'open'}`} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M9 18l6-6-6-6"/>
                </svg>
                <span className="cg-section-title">{group.name}</span>
                <span className="cg-section-count">{list.length} {list.length === 1 ? 'country' : 'countries'}</span>
              </div>
              <div className="cg-section-actions">
                <div className="cg-reorder-btns">
                  <button className="cg-icon-btn-sm" title="Move group up" disabled={gIdx === 0} onClick={() => handleReorderGroup(gIdx, -1)}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 15l-6-6-6 6"/></svg>
                  </button>
                  <button className="cg-icon-btn-sm" title="Move group down" disabled={gIdx === sortedGroups.length - 1} onClick={() => handleReorderGroup(gIdx, 1)}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M6 9l6 6 6-6"/></svg>
                  </button>
                </div>
                <button className="icon-btn" title="Add country to this group" onClick={() => { setEditCountry(null); setAddToGroupId(group._id); setShowModal(true); }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14"/></svg>
                </button>
                <button className="icon-btn edit" title="Rename group" onClick={() => { setEditGroup(group); setShowGroupModal(true); }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                  </svg>
                </button>
                {!group.isDefault && (
                  <button className="icon-btn danger" title="Delete group" onClick={() => handleDeleteGroup(group)}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                      <path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/>
                    </svg>
                  </button>
                )}
              </div>
            </div>

            {!isCollapsed && (
              <div className="cg-section-body">
                {list.length === 0 ? (
                  <div className="cg-section-empty">No countries in this group yet.</div>
                ) : (
                  <div className="countries-grid">
                    {list.map((c, cIdx) => (
                      <div className="country-card" key={c._id}>
                        <div className="cc-header">
                          <span className="cc-flag"><CountryFlag country={c} size={34} rounded={6} /></span>
                          <div className="cc-actions">
                            <button className="icon-btn edit" onClick={() => { setEditCountry(c); setShowModal(true); }} title="Edit">
                              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                              </svg>
                            </button>
                            <button className="icon-btn danger" onClick={() => handleDelete(c._id)} title="Delete">
                              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                                <path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/>
                              </svg>
                            </button>
                          </div>
                        </div>

                        <h3 className="cc-name">{c.name}</h3>

                        <div className="cc-stats">
                          <div className="cc-stat">
                            <span className="ccs-val">{c.total ?? c.count ?? 0}</span>
                            <span className="ccs-lbl">Applications</span>
                          </div>
                          <div className="cc-stat">
                            <span className="ccs-val">{c.offered ?? 0}</span>
                            <span className="ccs-lbl">Received</span>
                          </div>
                          <div className="cc-stat">
                            <span className="ccs-val">{c.paid ?? 0}</span>
                            <span className="ccs-lbl">Paid</span>
                          </div>
                          <div className="cc-stat">
                            <span className="ccs-val" style={{ color: 'var(--green)' }}>{c.visaGranted ?? 0}</span>
                            <span className="ccs-lbl">Visa Granted</span>
                          </div>
                        </div>

                        <Link to={`/admin/applications/${c._id}`} className="cc-open-btn">
                          Open Applications
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <path d="M5 12h14M12 5l7 7-7 7"/>
                          </svg>
                        </Link>

                        <div className="cg-country-card-footer">
                          <div className="cg-reorder-btns">
                            <button className="cg-icon-btn-sm" title="Move up" disabled={cIdx === 0} onClick={() => handleReorderCountry(group._id, list, cIdx, -1)}>
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 15l-6-6-6 6"/></svg>
                            </button>
                            <button className="cg-icon-btn-sm" title="Move down" disabled={cIdx === list.length - 1} onClick={() => handleReorderCountry(group._id, list, cIdx, 1)}>
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M6 9l6 6 6-6"/></svg>
                            </button>
                          </div>
                          <select
                            className="cg-move-select"
                            value={String(c.group || '')}
                            onChange={e => handleMoveCountryToGroup(c, e.target.value)}
                            title="Move to a different group"
                          >
                            {allGroupsForSelect.map(g => (
                              <option key={g._id} value={g._id}>{g.name}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}

      {orphaned.length > 0 && (
        <div className="apps-empty-hint">
          {orphaned.length} countr{orphaned.length === 1 ? 'y is' : 'ies are'} not yet assigned to a group. Refresh the page to assign them automatically.
        </div>
      )}

      {countries.length === 0 && groups.length === 0 && (
        <div className="apps-empty-hint">No countries yet. Click "Add New Country" to get started.</div>
      )}

      {showModal && (
        <CountryModal
          country={editCountry}
          groups={allGroupsForSelect}
          defaultGroupId={addToGroupId}
          onSave={handleSave}
          onClose={() => {
            if (!saving) {
              setShowModal(false);
              setEditCountry(null);
              setAddToGroupId(null);
            }
          }}
        />
      )}

      {showGroupModal && (
        <CountryGroupModal
          group={editGroup}
          onSave={handleSaveGroup}
          onClose={() => { setShowGroupModal(false); setEditGroup(null); }}
        />
      )}
    </div>
  );
}
