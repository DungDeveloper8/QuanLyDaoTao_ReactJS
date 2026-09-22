import { createContext, useEffect, useMemo, useState } from 'react';
import {
  clearAuthSession,
  currentUserRequest,
  getStoredUser,
  loginRequest,
  setAuthSession,
} from '../api/apiClient.js';

export const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => getStoredUser());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function restore() {
      try {
        const response = await currentUserRequest();
        if (!cancelled) {
          setUser(response.data.user);
          setAuthSession({
            token: localStorage.getItem('training_auth_token') || '',
            user: response.data.user,
          });
        }
      } catch {
        clearAuthSession();
        if (!cancelled) setUser(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    if (localStorage.getItem('training_auth_token')) restore();
    else {
      clearAuthSession();
      setUser(null);
      setLoading(false);
    }

    function handleExpired() {
      clearAuthSession();
      setUser(null);
      setLoading(false);
    }

    window.addEventListener('training-auth-expired', handleExpired);
    return () => {
      cancelled = true;
      window.removeEventListener('training-auth-expired', handleExpired);
    };
  }, []);

  async function login(username, password) {
    const response = await loginRequest(username, password);
    const session = response.data;
    setAuthSession(session);
    setUser(session.user);
    return session.user;
  }

  function logout() {
    clearAuthSession();
    setUser(null);
  }

  const value = useMemo(
    () => ({ user, loading, login, logout, isAuthenticated: Boolean(user) }),
    [user, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
