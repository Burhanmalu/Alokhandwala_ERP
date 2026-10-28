'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { UserProfile, UserRole } from '../schema';
import { initialUsers } from '../db/seed-data';
import { hasPermission, PermissionKey } from './index';

interface AuthContextType {
  currentUser: UserProfile;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password?: string) => Promise<{ success: boolean; error?: string }>;
  loginAsUser: (userId: string) => void;
  logout: () => void;
  switchUser: (userId: string) => void;
  can: (permission: PermissionKey) => boolean;
  availableUsers: UserProfile[];
  updateUserRole: (userId: string, newRole: UserRole) => Promise<boolean>;
  refreshUsers: () => Promise<UserProfile[]>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<UserProfile>(initialUsers[0]);
  const [availableUsers, setAvailableUsers] = useState<UserProfile[]>(initialUsers);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Synchronize users and current user session directly from live database
  const refreshUsers = useCallback(async (): Promise<UserProfile[]> => {
    try {
      const res = await fetch('/api/users', { 
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache' }
      });
      const json = await res.json();
      if (json.success && Array.isArray(json.data) && json.data.length > 0) {
        const liveUsers: UserProfile[] = json.data;
        setAvailableUsers(liveUsers);

        const savedUserId = localStorage.getItem('alokhandwala_active_user');
        if (savedUserId) {
          const matched = liveUsers.find(u => u.id === savedUserId);
          if (matched) {
            setCurrentUser(matched);
            localStorage.setItem('alokhandwala_user_profile', JSON.stringify(matched));
          }
        }
        return liveUsers;
      }
    } catch (err) {
      console.error('[Auth] Error querying database for user roles:', err);
    }
    return availableUsers;
  }, [availableUsers]);

  // Initial session hydration
  useEffect(() => {
    let isMounted = true;

    const initAuth = async () => {
      try {
        const loggedIn = localStorage.getItem('alokhandwala_logged_in');
        const savedUserId = localStorage.getItem('alokhandwala_active_user');
        const cachedUserJson = localStorage.getItem('alokhandwala_user_profile');

        // Step 1: Immediately hydrate from cached profile to avoid role reversion or UI flicker
        if (loggedIn === 'true' && savedUserId) {
          if (cachedUserJson) {
            try {
              const cached = JSON.parse(cachedUserJson);
              if (cached && cached.id === savedUserId) {
                if (isMounted) {
                  setCurrentUser(cached);
                  setIsAuthenticated(true);
                }
                document.cookie = `alokhandwala_session=${cached.id}; path=/; max-age=86400; SameSite=Lax`;
              }
            } catch (e) {}
          } else {
            const fallback = initialUsers.find(u => u.id === savedUserId);
            if (fallback && isMounted) {
              setCurrentUser(fallback);
              setIsAuthenticated(true);
            }
          }
        } else {
          if (isMounted) {
            setIsAuthenticated(false);
          }
          document.cookie = 'alokhandwala_session=; path=/; max-age=0; SameSite=Lax';
        }

        // Step 2: Fetch live state from persistent database
        const res = await fetch('/api/users', { 
          cache: 'no-store',
          headers: { 'Cache-Control': 'no-cache' }
        });
        const json = await res.json();
        if (json.success && Array.isArray(json.data) && json.data.length > 0) {
          if (!isMounted) return;
          const liveUsers: UserProfile[] = json.data;
          setAvailableUsers(liveUsers);

          if (loggedIn === 'true' && savedUserId) {
            const matched = liveUsers.find(u => u.id === savedUserId);
            if (matched) {
              setCurrentUser(matched);
              setIsAuthenticated(true);
              localStorage.setItem('alokhandwala_user_profile', JSON.stringify(matched));
              document.cookie = `alokhandwala_session=${matched.id}; path=/; max-age=86400; SameSite=Lax`;
            } else {
              setIsAuthenticated(false);
              localStorage.removeItem('alokhandwala_logged_in');
              localStorage.removeItem('alokhandwala_active_user');
              localStorage.removeItem('alokhandwala_user_profile');
              document.cookie = 'alokhandwala_session=; path=/; max-age=0; SameSite=Lax';
            }
          }
        }
      } catch (e) {
        console.error('[Auth] Error initializing authentication session:', e);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    initAuth();

    return () => {
      isMounted = false;
    };
  }, []);

  const login = async (email: string, password?: string): Promise<{ success: boolean; error?: string }> => {
    const trimmedEmail = email.trim().toLowerCase();
    
    // Always query database first so updated roles and passwords are never stale
    let liveUsers: UserProfile[] = [];
    try {
      const res = await fetch('/api/users', { 
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache' }
      });
      const json = await res.json();
      if (json.success && Array.isArray(json.data) && json.data.length > 0) {
        liveUsers = json.data;
        setAvailableUsers(liveUsers);
      }
    } catch (e) {
      console.warn('[Auth] Database fetch failed on login, checking in-memory state', e);
    }

    // Match in live database users first; fall back to availableUsers then seed-data only if offline
    const user = liveUsers.find(u => u.email.toLowerCase() === trimmedEmail)
      || availableUsers.find(u => u.email.toLowerCase() === trimmedEmail)
      || initialUsers.find(u => u.email.toLowerCase() === trimmedEmail);

    if (!user) {
      return { 
        success: false, 
        error: 'Invalid email address. Please use your authorized ALOKHANDWALA corporate email.' 
      };
    }

    if (!user.isActive) {
      return { 
        success: false, 
        error: 'This account has been deactivated. Please contact your Super Administrator.' 
      };
    }

    // Verify password if set on account
    if (user.password && password && user.password !== password) {
      return {
        success: false,
        error: 'Incorrect password. Please verify your credentials.',
      };
    }

    // Set authenticated state and synchronize to persistent storage
    setCurrentUser(user);
    setIsAuthenticated(true);
    localStorage.setItem('alokhandwala_logged_in', 'true');
    localStorage.setItem('alokhandwala_active_user', user.id);
    localStorage.setItem('alokhandwala_user_profile', JSON.stringify(user));
    document.cookie = `alokhandwala_session=${user.id}; path=/; max-age=86400; SameSite=Lax`;

    return { success: true };
  };

  const loginAsUser = (userId: string) => {
    const user = availableUsers.find(u => u.id === userId) || initialUsers.find(u => u.id === userId);
    if (user) {
      setCurrentUser(user);
      setIsAuthenticated(true);
      localStorage.setItem('alokhandwala_logged_in', 'true');
      localStorage.setItem('alokhandwala_active_user', user.id);
      localStorage.setItem('alokhandwala_user_profile', JSON.stringify(user));
      document.cookie = `alokhandwala_session=${user.id}; path=/; max-age=86400; SameSite=Lax`;
    }
  };

  const logout = () => {
    setIsAuthenticated(false);
    localStorage.removeItem('alokhandwala_logged_in');
    localStorage.removeItem('alokhandwala_active_user');
    localStorage.removeItem('alokhandwala_user_profile');
    document.cookie = 'alokhandwala_session=; path=/; max-age=0; SameSite=Lax';
    router.push('/login');
  };

  const switchUser = (userId: string) => {
    const found = availableUsers.find(u => u.id === userId) || initialUsers.find(u => u.id === userId);
    if (found) {
      setCurrentUser(found);
      localStorage.setItem('alokhandwala_active_user', found.id);
      localStorage.setItem('alokhandwala_user_profile', JSON.stringify(found));
      document.cookie = `alokhandwala_session=${found.id}; path=/; max-age=86400; SameSite=Lax`;
    }
  };

  // Permanently update user role in database and immediately update client auth context
  const updateUserRole = async (userId: string, newRole: UserRole): Promise<boolean> => {
    try {
      const res = await fetch('/api/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: userId, role: newRole }),
      });
      const json = await res.json();
      if (json.success && json.data) {
        const updated = json.data as UserProfile;
        
        // Update availableUsers in state
        setAvailableUsers(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u));
        
        // If the modified user is currently logged in, update currentUser instantly
        if (currentUser && currentUser.id === userId) {
          const fresh = { ...currentUser, role: newRole };
          setCurrentUser(fresh);
          localStorage.setItem('alokhandwala_user_profile', JSON.stringify(fresh));
        }
        return true;
      }
      return false;
    } catch (err) {
      console.error('[Auth] Error updating user role:', err);
      return false;
    }
  };

  const can = (permission: PermissionKey): boolean => {
    if (!isAuthenticated) return false;
    return hasPermission(currentUser.role, permission);
  };

  return (
    <AuthContext.Provider 
      value={{ 
        currentUser, 
        isAuthenticated, 
        isLoading, 
        login, 
        loginAsUser, 
        logout, 
        switchUser, 
        can, 
        availableUsers,
        updateUserRole,
        refreshUsers
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

