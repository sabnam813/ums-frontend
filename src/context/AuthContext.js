import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
} from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';

const AuthContext = createContext(null);

axios.defaults.baseURL =
  process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

axios.defaults.withCredentials = true;

let accessToken = null;

export const setAccessToken = (token) => {
  accessToken = token;
};

export const getAccessToken = () => accessToken;
const REMEMBER_KEY = 'ums_refresh_token';
const REMEMBER_FLAG_KEY = 'ums_remember_me';

const safeStorage = (storage, fn, fallback) => {
  try {
    return fn(storage);
  } catch {
    return fallback;
  }
};

export const getRememberMe = () =>
  safeStorage(localStorage, (s) => s.getItem(REMEMBER_FLAG_KEY) === '1', false);

const clearStoredAuth = () => {
  safeStorage(localStorage, (s) => s.removeItem(REMEMBER_KEY));
  safeStorage(sessionStorage, (s) => s.removeItem(REMEMBER_KEY));
  safeStorage(localStorage, (s) => s.removeItem(REMEMBER_FLAG_KEY));
};

const persistRefreshToken = (token, rememberMe) => {
  clearStoredAuth();
  if (!token) return;
  const target = rememberMe ? localStorage : sessionStorage;
  safeStorage(target, (s) => s.setItem(REMEMBER_KEY, token));
  safeStorage(localStorage, (s) => s.setItem(REMEMBER_FLAG_KEY, rememberMe ? '1' : '0'));
};

const rotateStoredRefreshToken = (token) => {
  if (!token) return;
  persistRefreshToken(token, getRememberMe());
};

const getStoredRefreshToken = () =>
  safeStorage(localStorage, (s) => s.getItem(REMEMBER_KEY), null) ||
  safeStorage(sessionStorage, (s) => s.getItem(REMEMBER_KEY), null);

const buildRefreshBody = () => {
  const stored = getStoredRefreshToken();
  return stored ? { refreshToken: stored } : {};
};

let _refreshPromise = null;

function sharedRefresh() {
  if (_refreshPromise) return _refreshPromise;

  _refreshPromise = axios
    .post('/auth/refresh', buildRefreshBody(), { withCredentials: true })
    .then((res) => {
      setAccessToken(res.data.accessToken);
      rotateStoredRefreshToken(res.data.refreshToken);
      return res.data;
    })
    .finally(() => {
      _refreshPromise = null;
    });

  return _refreshPromise;
}

function tokenSecondsLeft() {
  if (!accessToken) return -1;
  try {
    const payload = JSON.parse(atob(accessToken.split('.')[1]));
    return Math.floor(payload.exp - Date.now() / 1000);
  } catch {
    return -1;
  }
}

export async function ensureFreshToken() {
  if (tokenSecondsLeft() < 90) {
    try {
      await sharedRefresh();
    } catch {
    }
  }
}

export const refreshSession = async () => {
  const data = await sharedRefresh();
  return data;
};

axios.interceptors.request.use(
  (config) => {
    if (accessToken) {
      config.headers.Authorization = `Bearer ${accessToken}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

let refreshQueue = [];

function processQueue(error, token) {
  refreshQueue.forEach(({ resolve, reject }) => {
    if (error) reject(error);
    else resolve(token);
  });
  refreshQueue = [];
}

axios.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;

    if (original?.url?.includes('/auth/refresh')) {
      return Promise.reject(error);
    }

    if (error.response?.status === 401 && original && !original._retry) {
      original._retry = true;

      if (_refreshPromise) {
        return _refreshPromise
          .then((data) => {
            original.headers.Authorization = `Bearer ${data.accessToken}`;
            return axios(original);
          })
          .catch(() => Promise.reject(error));
      }

      try {
        const data = await sharedRefresh();
        original.headers.Authorization = `Bearer ${data.accessToken}`;
        processQueue(null, data.accessToken);
        return axios(original);
      } catch (refreshError) {
        processQueue(refreshError, null);
        setAccessToken(null);
        clearStoredAuth();

        if (window.location.pathname !== '/login') {
          window.location.href = '/login';
        }

        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [wakingUp, setWakingUp] = useState(false);
  const refreshTimerRef = useRef(null);

  const scheduleRefresh = useCallback((token) => {
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current);
    }

    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const expiresIn = payload.exp * 1000 - Date.now() - 60000;

      if (expiresIn > 0) {
        refreshTimerRef.current = setTimeout(async () => {
          const delays = [1000, 3000, 6000];
          let hardExpiry = false;
          for (let i = 0; i <= delays.length; i++) {
            try {
              const data = await sharedRefresh();
              setAccessToken(data.accessToken);
              rotateStoredRefreshToken(data.refreshToken);
              scheduleRefresh(data.accessToken);
              return;
            } catch (err) {
              if (err.response?.status === 401) { hardExpiry = true; break; }
              if (i < delays.length) await new Promise(r => setTimeout(r, delays[i]));
            }
          }
          setAccessToken(null);
          setUser(null);
          clearStoredAuth();
          if (hardExpiry) {
            window.location.href = '/login';
          } else {
            if (window.location.pathname !== '/login') {
              import('react-hot-toast').then(({ default: toast }) =>
                toast.error('Session could not be refreshed. Please log in again.')
              );
              setTimeout(() => { window.location.href = '/login'; }, 3000);
            }
          }
        }, expiresIn);
      }
    } catch (err) {
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    const attemptRefresh = () =>
      axios.post('/auth/refresh', buildRefreshBody(), { withCredentials: true, timeout: 20000 });

    const RETRY_DELAYS_MS = [1000, 3000, 6000, 10000, 15000];

    const restoreSession = async () => {
      let lastErr;
      for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
        if (cancelled) return;
        try {
          const res = await attemptRefresh();
          if (cancelled) return;
          setAccessToken(res.data.accessToken);
          rotateStoredRefreshToken(res.data.refreshToken);
          setUser(res.data.user);
          scheduleRefresh(res.data.accessToken);
          setWakingUp(false);
          setLoading(false);
          return;
        } catch (err) {
          lastErr = err;
          if (err.response?.status === 401) break;
          if (attempt < RETRY_DELAYS_MS.length) {
            if (!cancelled) setWakingUp(true);
            await new Promise(r => setTimeout(r, RETRY_DELAYS_MS[attempt]));
          }
        }
      }

      if (cancelled) return;
      setAccessToken(null);
      setUser(null);
      if (lastErr?.response?.status === 401) clearStoredAuth();
      setWakingUp(false);
      setLoading(false);
      if (lastErr && lastErr.response?.status !== 401) {
        toast.error('Could not reach the server. Please check your connection and log in again.');
      }
    };

    restoreSession();

    return () => {
      cancelled = true;
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
      }
    };
  }, [scheduleRefresh]);

  const login = useCallback(
    async (username, password, rememberMe = false) => {
      const res = await axios.post('/auth/login', {
        username,
        password,
        rememberMe,
      });

      setAccessToken(res.data.accessToken);
      persistRefreshToken(res.data.refreshToken, rememberMe);
      setUser(res.data.user);
      scheduleRefresh(res.data.accessToken);

      if (res.data.user.mustChangePassword) {
        window.location.href = '/change-password';
      }

      return res.data.user;
    },
    [scheduleRefresh]
  );

  const logout = useCallback(async () => {
    try {
      await axios.post('/auth/logout', buildRefreshBody());
    } catch (err) {
    }

    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current);
    }

    setAccessToken(null);
    clearStoredAuth();
    setUser(null);
    toast.success('Logged out successfully');
    window.location.href = '/login';
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        wakingUp,
        login,
        logout,
        setUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }

  return context;
};
