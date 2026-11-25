import React, { useMemo } from 'react';
import Select from 'react-select';
import CreatableSelect from 'react-select/creatable';
import useAssociateOptions, { associateStatusSync } from '../../hooks/useAssociateOptions';
import { statusColor, normKey } from '../../utils/associateStatus';

const portalProps = {
  menuPortalTarget: typeof document !== 'undefined' ? document.body : null,
  menuPosition: 'fixed',
};

export default function AssociateSelect({ value, onChange, placeholder = 'Select associate…', clearable = true, className = '', allowCustom = false }) {
  const Picker = allowCustom ? CreatableSelect : Select;
  const customProps = allowCustom ? {
    allowCreateWhileLoading: true,
    createOptionPosition: 'first',
    formatCreateLabel: input => `Use "${input}" (not in Associate Details)`,
    isValidNewOption: input => !!String(input || '').trim(),
    noOptionsMessage: () => 'Type a name to use it, or add it in Associate Details',
  } : {};
  const list = useAssociateOptions();

  const options = useMemo(() => {
    const opts = list.map(a => ({ value: a.name, label: a.name, location: a.location, status: a.status }));
    const v = (value || '').trim();
    if (v && !opts.some(o => o.value.trim().toLowerCase() === v.toLowerCase())) {
      opts.unshift({ value, label: value, legacy: true });
    }
    return opts;
  }, [list, value]);

  const selected = useMemo(() => {
    const v = (value || '').trim();
    if (!v) return null;
    return options.find(o => o.value.trim().toLowerCase() === v.toLowerCase()) || { value, label: value, legacy: true };
  }, [options, value]);

  const known = useMemo(() => {
    const v = (value || '').trim();
    if (!v) return true;
    const k = normKey(v);
    return list.some(a => normKey(a.name) === k || (a.aliases || []).some(x => normKey(x) === k)) || !!associateStatusSync(v);
  }, [list, value]);

  return (
    <div>
      <Picker
        className={`custom-select ${className}`}
        classNamePrefix="react-select"
        options={options}
        value={selected}
        onChange={opt => onChange(opt ? opt.value : '')}
        placeholder={placeholder}
        isClearable={clearable}
        isSearchable
        {...customProps}
        formatOptionLabel={(o, ctx) => {
          const color = statusColor(o.status);
          const label = <span style={color ? { color, fontWeight: 600 } : undefined}>{o.label}</span>;
          return ctx.context === 'menu' && o.location
            ? <span>{label} <span style={{ color: 'var(--gray-400)', fontSize: '0.75rem' }}>· {o.location}</span></span>
            : label;
        }}
        {...portalProps}
        styles={{ menuPortal: base => ({ ...base, zIndex: 9999 }) }}
      />
      {!known && (
        <div style={{ marginTop: 4, fontSize: '0.72rem', color: '#b45309' }}>Not present in Associate Details</div>
      )}
    </div>
  );
}
