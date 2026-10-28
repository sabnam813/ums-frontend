import React, { useMemo } from 'react';
import Select from 'react-select';
import useAssociateOptions from '../../hooks/useAssociateOptions';
import { statusColor } from '../../utils/associateStatus';

const portalProps = {
  menuPortalTarget: typeof document !== 'undefined' ? document.body : null,
  menuPosition: 'fixed',
};

export default function AssociateSelect({ value, onChange, placeholder = 'Select associate…', clearable = true, className = '' }) {
  const list = useAssociateOptions();

  const options = useMemo(() => {
    const opts = list.map(a => ({ value: a.name, label: a.name, location: a.location, status: a.status }));
    const v = (value || '').trim();
    if (v && !opts.some(o => o.value.trim().toLowerCase() === v.toLowerCase())) {
      opts.unshift({ value, label: `${value} (not in Associate Details)`, legacy: true });
    }
    return opts;
  }, [list, value]);

  const selected = useMemo(() => {
    const v = (value || '').trim();
    if (!v) return null;
    return options.find(o => o.value.trim().toLowerCase() === v.toLowerCase()) || { value, label: value };
  }, [options, value]);

  return (
    <Select
      className={`custom-select ${className}`}
      classNamePrefix="react-select"
      options={options}
      value={selected}
      onChange={opt => onChange(opt ? opt.value : '')}
      placeholder={placeholder}
      isClearable={clearable}
      isSearchable
      noOptionsMessage={() => 'No associate found — add it in Associate Details'}
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
  );
}
