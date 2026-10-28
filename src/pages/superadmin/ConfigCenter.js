import React, { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { PageHeader, Loading } from '../../components/superadmin/SuperAdminUI';
import FormFieldsManager from '../../components/admin/FormFieldsManager';
import { useFieldConfig } from '../../hooks/useFieldConfig';
import { useConfig } from '../../context/ConfigContext';
import { DEFAULT_FISCAL_YEARS } from '../../utils/fiscalYear';

const TABS = [
  { key: 'lists', label: 'Dropdown Lists' },
  { key: 'levels', label: 'Levels' },
  { key: 'fields', label: 'Application Fields' },
  { key: 'modules', label: 'Sidebar Modules' },
  { key: 'fiscal', label: 'Fiscal Years' },
  { key: 'pin', label: 'Commission PIN' },
];

const errMsg = (err, fallback) => err.response?.data?.message || fallback;

const row = { display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', borderBottom: '1px solid var(--sa-border)' };
const note = { fontSize: '0.78rem', color: 'var(--sa-text-dim)' };

function ValueRows({ values, usage, onRename, onRemove, onMove, locked }) {
  const [editing, setEditing] = useState(null);
  const [text, setText] = useState('');

  const submit = async () => {
    const to = text.trim();
    if (!to || to === editing) { setEditing(null); return; }
    const done = await onRename(editing, to);
    if (done) setEditing(null);
  };

  return (
    <div>
      {values.map((v, i) => (
        <div key={v} style={row}>
          {editing === v ? (
            <>
              <input className="sa-input" style={{ flex: 1 }} value={text} autoFocus onChange={e => setText(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') submit(); if (e.key === 'Escape') setEditing(null); }} />
              <button className="sa-btn sa-btn-primary" onClick={submit}>Apply</button>
              <button className="sa-btn" onClick={() => setEditing(null)}>Cancel</button>
            </>
          ) : (
            <>
              <span style={{ flex: 1, fontWeight: 600 }}>{v}</span>
              <span style={note}>{usage?.[v] ? `${usage[v]} record${usage[v] === 1 ? '' : 's'}` : 'unused'}</span>
              {onMove && <button className="sa-btn" disabled={i === 0} onClick={() => onMove(i, -1)} title="Move up">&#8593;</button>}
              {onMove && <button className="sa-btn" disabled={i === values.length - 1} onClick={() => onMove(i, 1)} title="Move down">&#8595;</button>}
              <button className="sa-btn" disabled={locked} onClick={() => { setEditing(v); setText(v); }}>Rename</button>
              <button className="sa-btn" onClick={() => onRemove(v)}>Remove</button>
            </>
          )}
        </div>
      ))}
    </div>
  );
}

function ListCard({ def, onChanged }) {
  const [values, setValues] = useState(def.values);
  const [adding, setAdding] = useState('');
  const [saving, setSaving] = useState(false);
  const dirty = JSON.stringify(values) !== JSON.stringify(def.values);

  useEffect(() => { setValues(def.values); }, [def.values]);

  const add = () => {
    let t = adding.trim().slice(0, def.maxLen);
    if (def.key === 'currency') t = t.toUpperCase();
    if (!t) return;
    if (values.some(v => v.toLowerCase() === t.toLowerCase())) { toast.error('Already in list'); return; }
    setValues(v => [...v, t]);
    setAdding('');
  };

  const move = (i, d) => setValues(v => {
    const n = [...v];
    const j = i + d;
    [n[i], n[j]] = [n[j], n[i]];
    return n;
  });

  const save = async () => {
    setSaving(true);
    try {
      await axios.put(`/config/lists/${def.key}`, { values });
      toast.success('Saved');
      await onChanged();
    } catch (err) {
      toast.error(errMsg(err, 'Failed to save'));
    } finally {
      setSaving(false);
    }
  };

  const rename = async (from, to) => {
    if (dirty) { toast.error('Save or discard changes first'); return false; }
    try {
      const res = await axios.post(`/config/lists/${def.key}/rename`, { from, to });
      toast.success(`Renamed, ${res.data.updated} record(s) updated`);
      await onChanged();
      return true;
    } catch (err) {
      toast.error(errMsg(err, 'Failed to rename'));
      return false;
    }
  };

  const reset = async () => {
    if (!window.confirm(`Reset "${def.label}" to default values?`)) return;
    try {
      await axios.post(`/config/lists/${def.key}/reset`);
      toast.success('Reset');
      await onChanged();
    } catch (err) {
      toast.error(errMsg(err, 'Failed to reset'));
    }
  };

  return (
    <div className="sa-card" style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontWeight: 700 }}>{def.label}</div>
          <div style={note}>{def.note}</div>
        </div>
        {def.custom && <button className="sa-btn" onClick={reset}>Reset to default</button>}
      </div>
      <ValueRows
        values={values}
        usage={def.usage}
        onRename={rename}
        onRemove={v => setValues(vs => vs.filter(x => x !== v))}
        onMove={move}
        locked={dirty}
      />
      <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
        <input className="sa-input" style={{ flex: 1, minWidth: 160 }} placeholder="New value" value={adding} maxLength={def.maxLen} onChange={e => setAdding(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') add(); }} />
        <button className="sa-btn" onClick={add}>Add</button>
        <button className="sa-btn sa-btn-primary" disabled={!dirty || saving} onClick={save}>{saving ? 'Saving…' : 'Save changes'}</button>
        {dirty && <button className="sa-btn" onClick={() => setValues(def.values)}>Discard</button>}
      </div>
      <div style={{ ...note, marginTop: 8 }}>Rename updates every existing record. Remove only hides the value from dropdowns; old records keep it.</div>
    </div>
  );
}

function LevelsPanel({ level, onChanged, fieldConfig }) {
  const [adding, setAdding] = useState('');

  const after = async () => {
    await fieldConfig.refetch();
    fieldConfig.broadcastChange();
    await onChanged();
  };

  const add = async () => {
    const t = adding.trim();
    if (!t) return;
    try {
      await axios.post('/fields/options', { fieldKey: 'level', option: t });
      setAdding('');
      toast.success('Level added');
      await after();
    } catch (err) {
      toast.error(errMsg(err, 'Failed to add'));
    }
  };

  const remove = async v => {
    if (!window.confirm(`Remove "${v}" from the level dropdown? Existing records keep it.`)) return;
    try {
      await axios.delete('/fields/options', { data: { fieldKey: 'level', option: v } });
      toast.success('Level removed');
      await after();
    } catch (err) {
      toast.error(errMsg(err, 'Failed to remove'));
    }
  };

  const rename = async (from, to) => {
    try {
      const res = await axios.post('/config/level/rename', { from, to });
      toast.success(`Renamed, ${res.data.updated} record(s) updated`);
      await after();
      return true;
    } catch (err) {
      toast.error(errMsg(err, 'Failed to rename'));
      return false;
    }
  };

  return (
    <div className="sa-card">
      <div style={{ fontWeight: 700 }}>Levels (UG, PG, PGD …)</div>
      <div style={note}>One list shared by Applications, Inquiries and Unicommission, including every filter and form.</div>
      <ValueRows values={level.values} usage={level.usage} onRename={rename} onRemove={remove} />
      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <input className="sa-input" style={{ flex: 1 }} placeholder="New level" value={adding} onChange={e => setAdding(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') add(); }} />
        <button className="sa-btn sa-btn-primary" onClick={add}>Add</button>
      </div>
      <div style={{ ...note, marginTop: 8 }}>Rename updates Applications (including extra universities), Inquiries and Unicommission.</div>
    </div>
  );
}

function ModulesPanel({ modules, onChanged }) {
  const [draft, setDraft] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const d = {};
    modules.forEach(m => { d[m.key] = { label: m.label, hidden: m.hidden }; });
    setDraft(d);
  }, [modules]);

  const set = (k, patch) => setDraft(d => ({ ...d, [k]: { ...d[k], ...patch } }));

  const save = async () => {
    setSaving(true);
    try {
      await axios.put('/config/modules', { modules: draft });
      toast.success('Saved');
      await onChanged();
    } catch (err) {
      toast.error(errMsg(err, 'Failed to save'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="sa-card">
      <div style={{ fontWeight: 700 }}>Sidebar Modules</div>
      <div style={note}>Rename a module or hide it from the sidebar for everyone except Super Admin. Hiding does not remove access or permissions.</div>
      <div className="sa-table-wrap" style={{ marginTop: 12 }}>
        <table className="sa-table">
          <thead>
            <tr><th>Module</th><th>Custom label</th><th>Hide in sidebar</th></tr>
          </thead>
          <tbody>
            {modules.map(m => (
              <tr key={m.key}>
                <td>{m.defaultLabel}</td>
                <td><input className="sa-input" value={draft[m.key]?.label || ''} maxLength={40} placeholder={m.defaultLabel} onChange={e => set(m.key, { label: e.target.value })} /></td>
                <td><input type="checkbox" checked={!!draft[m.key]?.hidden} onChange={e => set(m.key, { hidden: e.target.checked })} /></td>
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

function FiscalPanel({ fiscalYears, onChanged }) {
  const [rows, setRows] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setRows((fiscalYears && fiscalYears.length ? fiscalYears : DEFAULT_FISCAL_YEARS).map(f => ({ ...f })));
  }, [fiscalYears]);

  const set = (i, patch) => setRows(r => r.map((x, j) => (j === i ? { ...x, ...patch } : x)));

  const save = async () => {
    setSaving(true);
    try {
      await axios.put('/config/fiscal-years', { fiscalYears: rows });
      toast.success('Saved');
      await onChanged();
    } catch (err) {
      toast.error(errMsg(err, 'Failed to save'));
    } finally {
      setSaving(false);
    }
  };

  const reset = async () => {
    if (!window.confirm('Reset fiscal years to the built-in list?')) return;
    try {
      await axios.put('/config/fiscal-years', { fiscalYears: [] });
      toast.success('Reset');
      await onChanged();
    } catch (err) {
      toast.error(errMsg(err, 'Failed to reset'));
    }
  };

  return (
    <div className="sa-card">
      <div style={{ fontWeight: 700 }}>Fiscal Years</div>
      <div style={note}>Used by the fiscal year selector, Inquiries, Follow Up and Achievements.</div>
      <div style={{ marginTop: 10 }}>
        {rows.map((f, i) => (
          <div key={i} style={row}>
            <input className="sa-input" style={{ width: 110 }} value={f.label} placeholder="2085/86" onChange={e => set(i, { label: e.target.value })} />
            <input className="sa-input" type="date" value={f.from} onChange={e => set(i, { from: e.target.value })} />
            <span style={note}>to</span>
            <input className="sa-input" type="date" value={f.to} onChange={e => set(i, { to: e.target.value })} />
            <button className="sa-btn" onClick={() => setRows(r => r.filter((_, j) => j !== i))}>Remove</button>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
        <button className="sa-btn" onClick={() => setRows(r => [...r, { label: '', from: '', to: '' }])}>Add fiscal year</button>
        <button className="sa-btn sa-btn-primary" disabled={saving} onClick={save}>{saving ? 'Saving…' : 'Save'}</button>
        <button className="sa-btn" onClick={reset}>Reset to default</button>
      </div>
    </div>
  );
}

function PinPanel() {
  const [status, setStatus] = useState(null);
  const [pin, setPin] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await axios.get('/config/commission-pin');
      setStatus(res.data);
    } catch (err) {
      toast.error(errMsg(err, 'Failed to load PIN status'));
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    if (!/^\d{4,8}$/.test(pin)) { toast.error('PIN must be 4 to 8 digits'); return; }
    if (pin !== confirm) { toast.error('PINs do not match'); return; }
    setSaving(true);
    try {
      await axios.put('/config/commission-pin', { pin });
      toast.success(status?.isSet ? 'PIN updated' : 'PIN set');
      setPin('');
      setConfirm('');
      load();
    } catch (err) {
      toast.error(errMsg(err, 'Failed to save PIN'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="sa-card" style={{ maxWidth: 420 }}>
      <div style={{ fontWeight: 700, marginBottom: 4 }}>Commission PIN</div>
      <div style={{ ...note, marginBottom: 12 }}>
        {status ? (status.isSet ? 'PIN is set' : 'PIN is not set') : 'Loading'}
      </div>
      <input className="sa-input" type="password" inputMode="numeric" maxLength={8} placeholder="New PIN" value={pin}
        onChange={e => setPin(e.target.value.replace(/\D/g, ''))} style={{ marginBottom: 8, width: '100%' }} />
      <input className="sa-input" type="password" inputMode="numeric" maxLength={8} placeholder="Confirm PIN" value={confirm}
        onChange={e => setConfirm(e.target.value.replace(/\D/g, ''))} style={{ marginBottom: 12, width: '100%' }} />
      <button className="sa-btn sa-btn-primary" disabled={saving} onClick={save}>{status?.isSet ? 'Update PIN' : 'Set PIN'}</button>
    </div>
  );
}

export default function ConfigCenter() {
  const [tab, setTab] = useState('lists');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const fieldConfig = useFieldConfig();
  const { refresh } = useConfig();

  const load = useCallback(async () => {
    try {
      const res = await axios.get('/config/admin');
      setData(res.data);
    } catch (err) {
      toast.error(errMsg(err, 'Failed to load configuration'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const changed = useCallback(async () => {
    await load();
    await refresh();
  }, [load, refresh]);

  return (
    <div>
      <PageHeader title="Configuration Center" subtitle="Change dropdown lists, levels, fiscal years and sidebar modules without a deploy" />
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
        {TABS.map(t => (
          <button key={t.key} className={`sa-btn ${tab === t.key ? 'sa-btn-primary' : ''}`} onClick={() => setTab(t.key)}>{t.label}</button>
        ))}
      </div>
      {loading && <Loading label="Loading configuration…" />}
      {!loading && data && tab === 'lists' && data.lists.map(def => <ListCard key={def.key} def={def} onChanged={changed} />)}
      {!loading && data && tab === 'levels' && <LevelsPanel level={data.level} onChanged={changed} fieldConfig={fieldConfig} />}
      {!loading && tab === 'fields' && (
        <div className="sa-card" style={{ background: '#fff', color: '#1a1a1a' }}>
          <FormFieldsManager fieldConfig={fieldConfig} refetchFields={fieldConfig.refetch} />
        </div>
      )}
      {!loading && data && tab === 'modules' && <ModulesPanel modules={data.modules} onChanged={changed} />}
      {!loading && tab === 'pin' && <PinPanel />}
      {!loading && data && tab === 'fiscal' && <FiscalPanel fiscalYears={data.fiscalYears} onChanged={changed} />}
    </div>
  );
}
