import React, { useMemo, useState } from 'react';
import { MODULES, ACTIONS, PRESETS, normalizePerms } from '../../utils/rbac';
import './PermissionMatrix.css';

const LOCKED_DELETE = {
  hallBooking: 'Hall Booking deletion is always Super Admin only',
  trainingSchedule: 'Training Schedule deletion is always Super Admin only',
};

const isLocked = (moduleKey, actionKey) => (
  actionKey === 'delete' && LOCKED_DELETE[moduleKey] ? LOCKED_DELETE[moduleKey] : null
);

function presetMatches(modulePerm, preset, moduleKey) {
  const want = new Set(preset.actions);
  return ACTIONS.every(({ key }) => {
    if (isLocked(moduleKey, key) && preset.key === 'full') return true;
    return !!modulePerm[key] === want.has(key);
  });
}

export default function PermissionMatrix({ value, onChange, base, initial, baseLabel = 'department', disabled = false }) {
  const perms = useMemo(() => normalizePerms(value), [value]);
  const basePerms = useMemo(() => (base ? normalizePerms(base) : null), [base]);
  const [showChanges, setShowChanges] = useState(false);

  const setModule = (moduleKey, next) => {
    const cleaned = { ...next };
    if (!cleaned.access) ACTIONS.forEach(({ key }) => { cleaned[key] = false; });
    ACTIONS.forEach(({ key }) => { if (isLocked(moduleKey, key)) cleaned[key] = false; });
    onChange({ ...perms, [moduleKey]: cleaned });
  };

  const applyPreset = (moduleKey, preset) => {
    const next = {};
    ACTIONS.forEach(({ key }) => { next[key] = preset.actions.includes(key); });
    setModule(moduleKey, next);
  };

  const toggleCell = (moduleKey, actionKey, checked) => {
    const current = { ...perms[moduleKey], [actionKey]: checked };
    if (actionKey === 'access' && !checked) ACTIONS.forEach(({ key }) => { current[key] = false; });
    if (actionKey === 'access' && checked && !ACTIONS.some(({ key }) => key !== 'access' && current[key])) current.view = true;
    setModule(moduleKey, current);
  };

  const toggleColumn = (actionKey) => {
    const eligible = MODULES.filter(({ key }) => !isLocked(key, actionKey) && (actionKey === 'access' || perms[key].access));
    if (eligible.length === 0) return;
    const allOn = eligible.every(({ key }) => perms[key][actionKey]);
    const next = { ...perms };
    eligible.forEach(({ key }) => {
      const cur = { ...next[key], [actionKey]: !allOn };
      if (actionKey === 'access' && allOn) ACTIONS.forEach(({ key: a }) => { cur[a] = false; });
      if (actionKey === 'access' && !allOn && !ACTIONS.some(({ key: a }) => a !== 'access' && cur[a])) cur.view = true;
      next[key] = cur;
    });
    onChange(next);
  };

  const counts = useMemo(() => {
    if (!basePerms) return null;
    let extra = 0; let removed = 0;
    MODULES.forEach(({ key: m }) => ACTIONS.forEach(({ key: a }) => {
      if (perms[m][a] && !basePerms[m][a]) extra += 1;
      if (!perms[m][a] && basePerms[m][a]) removed += 1;
    }));
    return { extra, removed };
  }, [perms, basePerms]);

  const changes = useMemo(() => {
    if (!initial) return [];
    const init = normalizePerms(initial);
    const list = [];
    MODULES.forEach(({ key: m, label }) => ACTIONS.forEach(({ key: a, label: aLabel }) => {
      if (init[m][a] !== perms[m][a]) list.push({ id: `${m}.${a}`, text: `${label} — ${aLabel}`, on: perms[m][a] });
    }));
    return list;
  }, [perms, initial]);

  return (
    <div className="pm-root">
      {(counts || changes.length > 0) && (
        <div className="pm-summary">
          {counts && (
            <span>
              {counts.extra === 0 && counts.removed === 0
                ? `Matches the ${baseLabel} exactly.`
                : `${counts.extra} extra, ${counts.removed} removed compared with the ${baseLabel}.`}
            </span>
          )}
          {counts && (counts.extra > 0 || counts.removed > 0) && !disabled && (
            <button type="button" className="pm-link" onClick={() => onChange(basePerms)}>Reset to {baseLabel}</button>
          )}
          {changes.length > 0 && (
            <button type="button" className="pm-link" onClick={() => setShowChanges(v => !v)}>
              {showChanges ? 'Hide' : 'Review'} unsaved changes ({changes.length})
            </button>
          )}
        </div>
      )}
      {showChanges && changes.length > 0 && (
        <ul className="pm-changes">
          {changes.map(c => (
            <li key={c.id} className={c.on ? 'on' : 'off'}>{c.on ? '+ Granted' : '− Removed'}: {c.text}</li>
          ))}
        </ul>
      )}
      <div className="pm-legend">
        <span className="pm-dot inherited" /> from {baseLabel}
        <span className="pm-dot extra" /> added for this person
        <span className="pm-dot removed" /> removed for this person
      </div>
      <div className="pm-scroll">
        <table className="pm-table">
          <thead>
            <tr>
              <th className="pm-module-col">Module</th>
              <th className="pm-preset-col">Quick set</th>
              {ACTIONS.map(a => (
                <th key={a.key} title={disabled ? undefined : `Toggle "${a.label}" for every module`}>
                  <button type="button" className="pm-col-btn" disabled={disabled} onClick={() => toggleColumn(a.key)}>{a.label}</button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {MODULES.map(({ key: moduleKey, label }) => {
              const mp = perms[moduleKey];
              return (
                <tr key={moduleKey}>
                  <td className="pm-module-col">{label}</td>
                  <td className="pm-preset-col">
                    {PRESETS.map(p => (
                      <button
                        key={p.key}
                        type="button"
                        disabled={disabled}
                        className={`pm-preset ${presetMatches(mp, p, moduleKey) ? 'active' : ''}`}
                        onClick={() => applyPreset(moduleKey, p)}
                      >
                        {p.label}
                      </button>
                    ))}
                  </td>
                  {ACTIONS.map(({ key: actionKey }) => {
                    const lockedReason = isLocked(moduleKey, actionKey);
                    const on = lockedReason ? false : !!mp[actionKey];
                    let state = '';
                    if (basePerms) {
                      const inBase = basePerms[moduleKey][actionKey];
                      if (on && !inBase) state = 'extra';
                      else if (!on && inBase) state = 'removed';
                      else if (on && inBase) state = 'inherited';
                    }
                    return (
                      <td key={actionKey} className={`pm-cell ${state}`} title={lockedReason || (state === 'extra' ? 'Added for this person' : state === 'removed' ? `Removed (the ${baseLabel} grants this)` : undefined)}>
                        <input
                          type="checkbox"
                          checked={on}
                          disabled={disabled || !!lockedReason || (actionKey !== 'access' && !mp.access)}
                          onChange={e => toggleCell(moduleKey, actionKey, e.target.checked)}
                        />
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
