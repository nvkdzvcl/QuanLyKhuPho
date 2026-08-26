'use client';

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
  useCallback,
} from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  ApiResponseEnvelope,
  CurrentUserResponseDto,
  UserDto,
} from '@quanlykhupho/shared-types';
import { apiClient } from './api-client';

interface AuthContextType {
  user: UserDto | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  setUser: (user: UserDto | null) => void;
  refreshUser: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [user, setUserState] = useState<UserDto | null>(null);
  const userIdRef = useRef<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const setUser = useCallback(
    (nextUser: UserDto | null) => {
      const nextUserId = nextUser?.id ?? null;

      if (userIdRef.current !== nextUserId) {
        queryClient.clear();
      }

      userIdRef.current = nextUserId;
      setUserState(nextUser);
    },
    [queryClient],
  );

  const refreshUser = useCallback(async () => {
    try {
      const res = await apiClient.get<ApiResponseEnvelope<CurrentUserResponseDto>>(
        '/auth/me',
      );
      if (res.data?.data?.user) {
        setUser(res.data.data.user);
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, [setUser]);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  const logout = async () => {
    try {
      await apiClient.post('/auth/logout');
    } catch {
      // ignore
    } finally {
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: Boolean(user),
        setUser,
        refreshUser,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
