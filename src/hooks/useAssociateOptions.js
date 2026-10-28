import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { buildStatusMap, normKey, statusColor } from '../utils/associateStatus';

let cache = { at: 0, list: [], map: new Map(), inflight: null };
const listeners = new Set();
const TTL = 8000;

function load(force) {
  if (!force && Date.now() - cache.at < TTL) return Promise.resolve(cache.list);
  if (cache.inflight) return cache.inflight;
  cache.inflight = axios.get('/associate-details/options')
    .then(res => {
      cache.list = (res.data.associates || []).map(a => ({
        id: a._id,
        name: a.name,
        location: a.location || '',
        status: a.status || 'Associate',
        aliases: a.aliases || [],
      }));
      cache.map = buildStatusMap(cache.list);
      cache.at = Date.now();
      listeners.forEach(fn => fn());
      return cache.list;
    })
    .catch(() => cache.list)
    .finally(() => { cache.inflight = null; });
  return cache.inflight;
}

export function invalidateAssociateOptions() { cache.at = 0; }

export function associateStatusSync(name) {
  return cache.map.get(normKey(name));
}

export function associateColorSync(name) {
  return statusColor(associateStatusSync(name));
}

export function useAssociateStatus() {
  const [, setTick] = useState(0);
  useEffect(() => {
    let alive = true;
    const fn = () => { if (alive) setTick(n => n + 1); };
    listeners.add(fn);
    load(false);
    return () => { alive = false; listeners.delete(fn); };
  }, []);
  return useCallback((name) => cache.map.get(normKey(name)), []);
}

export default function useAssociateOptions() {
  const [options, setOptions] = useState(cache.list);
  useEffect(() => {
    let alive = true;
    load(false).then(list => { if (alive) setOptions(list); });
    return () => { alive = false; };
  }, []);
  return options;
}
