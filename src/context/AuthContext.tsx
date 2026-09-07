import React, { createContext, useContext, useState, useEffect } from 'react';
import { User } from '../types/index.js';
import { api } from '../services/api.js';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<User>;
  logout: () => void;
  refreshUser: () => Promise<void>;
  isAdmin: boolean;
  isKasir: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('kkts_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('kkts_token'));
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    const handleUnauthorized = () => {
      setUser(null);
      setToken(null);
    };

    window.addEventListener('auth:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('auth:unauthorized', handleUnauthorized);
  }, []);

  useEffect(() => {
    if (token) {
      api.auth.me()
        .then(res => {
          setUser(res.user);
          localStorage.setItem('kkts_user', JSON.stringify(res.user));
        })
        .catch(() => {
          logout();
        })
        .finally(() => setIsLoading(false));
    } else {
      setIsLoading(false);
    }
  }, [token]);

  const login = async (username: string, password: string): Promise<User> => {
    const res = await api.auth.login({ username, password });
    setUser(res.user);
    setToken(res.token);
    localStorage.setItem('kkts_token', res.token);
    localStorage.setItem('kkts_user', JSON.stringify(res.user));
    return res.user;
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('kkts_token');
    localStorage.removeItem('kkts_user');
  };

  const refreshUser = async () => {
    if (token) {
      try {
        const res = await api.auth.me();
        setUser(res.user);
        localStorage.setItem('kkts_user', JSON.stringify(res.user));
      } catch (err) {
        // ignore
      }
    }
  };

  const isAdmin = user?.role === 'ADMIN';
  const isKasir = user?.role === 'KASIR';

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, logout, refreshUser, isAdmin, isKasir }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
};
