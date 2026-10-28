import { useEffect, useState } from 'react';
import axios from 'axios';
import { INTAKE_VALUES, MONTHS } from '../utils/intakeOptions';

let cache = null;
let inflight = null;
const listeners = new Set();

function order(values) {
  const key = (v) => {
    const m = /^([A-Za-z]{3})\s+(\d{4})$/.exec(v);
    if (!m) return null;
    const mi = MONTHS.findIndex((x) => x.toLowerCase() === m[1].toLowerCase());
    return mi < 0 ? null : Number(m[2]) * 12 + mi;
  };
  return [...values].sort((a, b) => {
    const ka = key(a);
    const kb = key(b);
    if (ka !== null && kb !== null) return ka - kb;
    if (ka !== null) return -1;
    if (kb !== null) return 1;
    return a.localeCompare(b);
  });
}

function merge(extra) {
  return order([...new Set([...INTAKE_VALUES, ...(extra || [])])]);
}

function load(force) {
  if (cache && !force) return Promise.resolve(cache);
  if (inflight) return inflight;
  inflight = axios
    .get('/applications/intakes/all')
    .then((res) => {
      cache = merge(res.data.intakes);
      listeners.forEach((fn) => fn(cache));
      return cache;
    })
    .catch(() => cache || merge([]))
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

export function refreshIntakeOptions() {
  return load(true);
}

export default function useIntakeOptions(extra) {
  const [list, setList] = useState(cache || merge([]));

  useEffect(() => {
    const fn = (v) => setList(v);
    listeners.add(fn);
    load();
    return () => {
      listeners.delete(fn);
    };
  }, []);

  if (extra && extra.length) {
    const missing = extra.filter((v) => v && !list.includes(v));
    if (missing.length) return order([...list, ...missing]);
  }
  return list;
}
