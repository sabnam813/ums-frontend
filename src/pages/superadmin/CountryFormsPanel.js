import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { useConfig } from '../../context/ConfigContext';
import {
  PROFILE_IDS, PROFILE_NAMES, FIELD_DEFS, resolveLayout, resolveProfileId, baseLabel,
} from '../../utils/countryLayouts';

const errMsg = (err, fallback) => err.response?.data?.message || fallback;
const note = { fontSize: '0.78rem', color: 'var(--sa-text-dim)' };
const chip = { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '3px 8px', border: '1px solid var(--sa-border)', borderRadius: 6, fontSize: '0.8rem', marginRight: 6, marginBottom: 6 };

function OptionsEditor({ list, isCustom, onChange, onReset }) {
  const [text, setText] = useState('');
  const add = () => {
    const t = text.trim();
    if (!t) return;
    if (list.some(v => v.toLowerCase() === t.toLowerCase())) { setText(''); return; }
    onChange([...list, t]);
    setText('');
  };
  return (
    <div>
      <div>
        {list.map(v => (
          <span key={v} style={chip}>
            {v}
            <button type="button" className="sa-btn" style={{ padding: '0 6px' }} disabled={list.length <= 1} onClick={() => onChange(list.filter(x => x !== v))}>x</button>
          </span>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
        <input className="sa-input" value={text} maxLength={60} placeholder="New option" onChange={e => setText(e.target.value)} onKeyDown={e => e.key === 'Enter' && add()} />
        <button type="button" className="sa-btn" onClick={add}>Add</button>
        {isCustom && <button type="button" className="sa-btn" onClick={onReset}>Use global list</button>}
      </div>
    </div>
  );
}

function AssignPanel({ countries, groups, onChanged }) {
  const { config } = useConfig();
  const [draft, setDraft] = useState({ countries: {}, groups: {} });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const a = config.profileAssign || {};
    setDraft({ countries: { ...(a.countries || {}) }, groups: { ...(a.groups || {}) } });
  }, [config.profileAssign]);

  const setVal = (kind, id, v) => setDraft(d => {
    const next = { ...d[kind] };
    if (v) next[id] = v; else delete next[id];
    return { ...d, [kind]: next };
  });

  const save = async () => {
    setSaving(true);
    try {
      await axios.put('/config/profile-assign', draft);
      toast.success('Saved');
      await onChanged();
    } catch (err) {
      toast.error(errMsg(err, 'Failed to save'));
    } finally {
      setSaving(false);
    }
  };

  const options = (
    <>
      <option value="">Automatic</option>
      {PROFILE_IDS.map(p => <option key={p} value={p}>{PROFILE_NAMES[p]}</option>)}
    </>
  );

  return (
    <div className="sa-card" style={{ marginTop: 16 }}>
      <div style={{ fontWeight: 700 }}>Which form each country uses</div>
      <div style={note}>Automatic follows the country name, then its region group. Pick a form to override.</div>
      <div className="sa-table-wrap" style={{ marginTop: 12 }}>
        <table className="sa-table">
          <thead><tr><th>Region group</th><th>Form</th></tr></thead>
          <tbody>
            {groups.map(g => (
              <tr key={g._id}>
                <td>{g.name}</td>
                <td><select className="sa-input" value={draft.groups[g._id] || ''} onChange={e => setVal('groups', g._id, e.target.value)}>{options}</select></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="sa-table-wrap" style={{ marginTop: 12 }}>
        <table className="sa-table">
          <thead><tr><th>Country</th><th>Current form</th><th>Form</th></tr></thead>
          <tbody>
            {countries.map(c => (
              <tr key={c._id}>
                <td>{c.name}</td>
                <td>{PROFILE_NAMES[resolveProfileId(c, config.profileAssign)]}</td>
                <td><select className="sa-input" value={draft.countries[c._id] || ''} onChange={e => setVal('countries', c._id, e.target.value)}>{options}</select></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ marginTop: 12 }}>
        <button className="sa-btn sa-btn-primary" disabled={saving} onClick={save}>{saving ? 'Saving…' : 'Save'}</button>
      </div>
    </div>
  );
}

export default function CountryFormsPanel({ optionsByField, onChanged }) {
  const { config } = useConfig();
  const [pid, setPid] = useState('uk');
  const [draft, setDraft] = useState({ fields: {}, order: {}, options: {} });
  const [saving, setSaving] = useState(false);
  const [countries, setCountries] = useState([]);
  const [groups, setGroups] = useState([]);

  useEffect(() => {
    const p = (config.profiles && config.profiles[pid]) || {};
    setDraft({ fields: { ...(p.fields || {}) }, order: { ...(p.order || {}) }, options: { ...(p.options || {}) } });
  }, [pid, config.profiles]);

  useEffect(() => {
    let alive = true;
    Promise.all([axios.get('/countries'), axios.get('/country-groups')]).then(([c, g]) => {
      if (!alive) return;
      setCountries((c.data.countries || []).slice().sort((a, b) => a.name.localeCompare(b.name)));
      setGroups(g.data.groups || []);
    }).catch(() => {});
    return () => { alive = false; };
  }, []);

  const layout = useMemo(() => resolveLayout(pid, draft, optionsByField), [pid, draft, optionsByField]);

  const setField = (key, patch) => setDraft(d => ({ ...d, fields: { ...d.fields, [key]: { ...(d.fields[key] || {}), ...patch } } }));

  const move = (section, key, dir) => {
    const keys = layout.sections.find(s => s.title === section).keys.slice();
    const i = keys.indexOf(key);
    const j = i + dir;
    if (j < 0 || j >= keys.length) return;
    [keys[i], keys[j]] = [keys[j], keys[i]];
    setDraft(d => ({ ...d, order: { ...d.order, [section]: keys } }));
  };

  const setOptions = (key, list) => setDraft(d => ({ ...d, options: { ...d.options, [key]: list } }));
  const resetOptions = (key) => setDraft(d => {
    const next = { ...d.options };
    delete next[key];
    return { ...d, options: next };
  });

  const save = async () => {
    setSaving(true);
    try {
      await axios.put(`/config/profiles/${pid}`, draft);
      toast.success('Saved');
      await onChanged();
    } catch (err) {
      toast.error(errMsg(err, 'Failed to save'));
    } finally {
      setSaving(false);
    }
  };

  const reset = async () => {
    if (!window.confirm(`Reset the ${PROFILE_NAMES[pid]} form to its standard layout?`)) return;
    setSaving(true);
    try {
      await axios.delete(`/config/profiles/${pid}`);
      toast.success('Reset');
      await onChanged();
    } catch (err) {
      toast.error(errMsg(err, 'Failed to reset'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="sa-card">
        <div style={{ fontWeight: 700 }}>Country Forms</div>
        <div style={note}>Each form controls the application form, table, filters, bulk edit, bulk import, Excel, PDF and print for its countries.</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
          {PROFILE_IDS.map(p => (
            <button key={p} className={`sa-btn ${pid === p ? 'sa-btn-primary' : ''}`} onClick={() => setPid(p)}>{PROFILE_NAMES[p]}</button>
          ))}
        </div>
      </div>

      {layout.sections.map(sec => (
        <div className="sa-card" key={sec.title} style={{ marginTop: 16 }}>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>{sec.title}</div>
          <div className="sa-table-wrap">
            <table className="sa-table">
              <thead><tr><th>Field</th><th>Label</th><th>Show</th><th>Order</th><th>Options</th></tr></thead>
              <tbody>
                {sec.keys.map(key => {
                  const def = FIELD_DEFS[key] || {};
                  const isSelect = def.kind === 'select';
                  const list = isSelect ? layout.optionsFor(key) : [];
                  return (
                    <tr key={key}>
                      <td>{baseLabel(pid, key)}</td>
                      <td>
                        <input
                          className="sa-input"
                          value={(draft.fields[key] && draft.fields[key].label) || ''}
                          maxLength={60}
                          placeholder={baseLabel(pid, key)}
                          onChange={e => setField(key, { label: e.target.value })}
                        />
                      </td>
                      <td><input type="checkbox" checked={!layout.isHidden(key)} onChange={e => setField(key, { hidden: !e.target.checked })} /></td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        <button className="sa-btn" onClick={() => move(sec.title, key, -1)}>Up</button>{' '}
                        <button className="sa-btn" onClick={() => move(sec.title, key, 1)}>Down</button>
                      </td>
                      <td style={{ minWidth: 260 }}>
                        {isSelect && (
                          <OptionsEditor
                            list={list}
                            isCustom={!!(draft.options[key] && draft.options[key].length)}
                            onChange={l => setOptions(key, l)}
                            onReset={() => resetOptions(key)}
                          />
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ))}

      <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
        <button className="sa-btn sa-btn-primary" disabled={saving} onClick={save}>{saving ? 'Saving…' : 'Save'}</button>
        <button className="sa-btn" disabled={saving} onClick={reset}>Reset to standard</button>
      </div>

      <AssignPanel countries={countries} groups={groups} onChanged={onChanged} />
    </div>
  );
}

