import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from 'react';
import { getMe, getStoredToken, login as loginRequest, register as registerRequest, setStoredToken } from '@/lib/api';
import { AuthResponse, User } from '@/types';

type AuthContextValue = {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (payload: { email: string; password: string }) => Promise<void>;
  register: (payload: {
    fullName: string;
    company: string;
    position: string;
    ruc?: string;
    phone?: string;
    sector?: string;
    location?: string;
    description?: string;
    role?: 'buyer' | 'supplier';
    email: string;
    password: string;
  }) => Promise<AuthResponse>;
  logout: () => void;
  refreshMe: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => getStoredToken());
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(Boolean(getStoredToken()));

  const refreshMe = async () => {
    if (!getStoredToken()) {
      setUser(null);
      return;
    }

    const me = await getMe();
    setUser(me);
  };

  useEffect(() => {
    if (!token) {
      setUser(null);
      setIsLoading(false);
      return;
    }

    let isMounted = true;

    getMe()
      .then((me) => {
        if (isMounted) {
          setUser(me);
        }
      })
      .catch(() => {
        if (isMounted) {
          setStoredToken(null);
          setToken(null);
          setUser(null);
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [token]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      token,
      isAuthenticated: Boolean(token && user),
      isLoading,
      login: async (payload) => {
        const response = await loginRequest(payload);
        setStoredToken(response.accessToken);
        setToken(response.accessToken);
        setUser(response.user);
      },
      register: async (payload) => {
        const response = await registerRequest(payload);
        setStoredToken(response.accessToken);
        setToken(response.accessToken);
        setUser(response.user);
        return response;
      },
      logout: () => {
        setStoredToken(null);
        setToken(null);
        setUser(null);
      },
      refreshMe,
    }),
    [isLoading, token, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }

  return context;
}
