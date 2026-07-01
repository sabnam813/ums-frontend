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

axios.interceptors.request.use(
  (config) => {
    if (accessToken) {
      config.headers.Authorization = `Bearer ${accessToken}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

let isRefreshing = false;
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
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          refreshQueue.push({ resolve, reject });
        }).then((token) => {
          original.headers.Authorization = `Bearer ${token}`;
          return axios(original);
        });
      }

      original._retry = true;
      isRefreshing = true;

      try {
        const res = await axios.post(
          '/auth/refresh',
          {},
          { withCredentials: true }
        );

        const newToken = res.data.accessToken;
        setAccessToken(newToken);
        original.headers.Authorization = `Bearer ${newToken}`;
        processQueue(null, newToken);

        return axios(original);
      } catch (refreshError) {
        processQueue(refreshError, null);
        setAccessToken(null);

        if (window.location.pathname !== '/login') {
          window.location.href = '/login';
        }

        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
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
          try {
            const res = await axios.post(
              '/auth/refresh',
              {},
              { withCredentials: true }
            );

            setAccessToken(res.data.accessToken);
            scheduleRefresh(res.data.accessToken);
          } catch (err) {
            setAccessToken(null);
            setUser(null);
            window.location.href = '/login';
          }
        }, expiresIn);
      }
    } catch (err) {
      // Ignore malformed token
    }
  }, []);

  useEffect(() => {
    const restoreSession = async () => {
      try {
        const res = await axios.post(
          '/auth/refresh',
          {},
          { withCredentials: true }
        );

        setAccessToken(res.data.accessToken);
        setUser(res.data.user);
        scheduleRefresh(res.data.accessToken);
      } catch (err) {
        setAccessToken(null);
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    restoreSession();

    return () => {
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
      }
    };
  }, [scheduleRefresh]);

  const login = useCallback(
    async (username, password) => {
      const res = await axios.post('/auth/login', {
        username,
        password,
      });

      setAccessToken(res.data.accessToken);
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
      await axios.post('/auth/logout');
    } catch (err) {
      // Ignore logout errors
    }

    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current);
    }

    setAccessToken(null);
    setUser(null);
    toast.success('Logged out successfully');
    window.location.href = '/login';
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
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