import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';

const STORE_KEY = 'commissionPinToken';
const HEADER = 'x-commission-pin';

function applyToken(token) {
  if (token) {
    sessionStorage.setItem(STORE_KEY, token);
    axios.defaults.headers.common[HEADER] = token;
  } else {
    sessionStorage.removeItem(STORE_KEY);
    delete axios.defaults.headers.common[HEADER];
  }
}

const saved = sessionStorage.getItem(STORE_KEY);
if (saved) axios.defaults.headers.common[HEADER] = saved;

const overlay = {
  position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', display: 'flex',
  alignItems: 'center', justifyContent: 'center', zIndex: 3000, padding: 16
};
const card = {
  background: '#fff', borderRadius: 14, padding: '28px 26px', width: '100%', maxWidth: 340,
  boxShadow: '0 20px 50px rgba(0,0,0,0.3)', textAlign: 'center'
};

export default function CommissionPinGate({ section, children }) {
  const { user } = useAuth();
  const required = section === 'associate' || section === 'shareholder' ? user?.role !== 'super_admin' : false;
  const [state, setState] = useState(required ? 'checking' : 'open');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [notSet, setNotSet] = useState(false);

  const check = useCallback(async () => {
    if (!required) { setState('open'); return; }
    try {
      const res = await axios.get('/commission/pin/status', { params: { section } });
      setNotSet(!res.data.isSet);
      setState(res.data.unlocked ? 'open' : 'locked');
    } catch {
      setState('locked');
    }
  }, [required, section]);

  useEffect(() => { check(); }, [check]);

  useEffect(() => {
    if (!required) return undefined;
    const id = axios.interceptors.response.use(r => r, err => {
      if (err.response?.data?.code === 'PIN_REQUIRED') {
        applyToken(null);
        setPin('');
        setState('locked');
      }
      return Promise.reject(err);
    });
    return () => axios.interceptors.response.eject(id);
  }, [required]);

  const submit = async (e) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const res = await axios.post('/commission/pin/verify', { pin });
      applyToken(res.data.token);
      setPin('');
      setState('open');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed');
      setPin('');
    } finally {
      setBusy(false);
    }
  };

  if (state === 'open') return children;
  if (state === 'checking') return null;

  return (
    <div style={overlay}>
      <form style={card} onSubmit={submit}>
        <div style={{ fontSize: '1.05rem', fontWeight: 700, color: '#0f172a', marginBottom: 14 }}>Enter PIN</div>
        <input
          type="password"
          inputMode="numeric"
          autoComplete="off"
          autoFocus
          maxLength={8}
          value={pin}
          onChange={e => setPin(e.target.value.replace(/\D/g, ''))}
          disabled={notSet}
          style={{
            width: '100%', boxSizing: 'border-box', textAlign: 'center', letterSpacing: '0.5em',
            fontSize: '1.4rem', padding: '10px 12px', border: '1.5px solid #cbd5e1', borderRadius: 10, outline: 'none'
          }}
        />
        {notSet && <div style={{ color: '#b91c1c', fontSize: '0.82rem', marginTop: 10 }}>PIN not set</div>}
        {error && <div style={{ color: '#b91c1c', fontSize: '0.82rem', marginTop: 10 }}>{error}</div>}
        <button
          type="submit"
          disabled={busy || notSet || pin.length < 4}
          style={{
            marginTop: 16, width: '100%', padding: '10px 14px', border: 'none', borderRadius: 10,
            background: '#1565c0', color: '#fff', fontWeight: 600, fontSize: '0.95rem',
            cursor: busy || pin.length < 4 ? 'not-allowed' : 'pointer', opacity: busy || pin.length < 4 ? 0.6 : 1
          }}
        >
          Unlock
        </button>
      </form>
    </div>
  );
}
