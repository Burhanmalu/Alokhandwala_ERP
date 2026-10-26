'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
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
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<UserProfile>(initialUsers[0]);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    try {
      const loggedIn = localStorage.getItem('alokhandwala_logged_in');
      const savedUserId = localStorage.getItem('alokhandwala_active_user');

      if (loggedIn === 'true' && savedUserId) {
        const found = initialUsers.find(u => u.id === savedUserId);
        if (found) {
          setCurrentUser(found);
          setIsAuthenticated(true);
          // Sync cookie for Next.js middleware
          document.cookie = `alokhandwala_session=${found.id}; path=/; max-age=86400; SameSite=Lax`;
        } else {
          setIsAuthenticated(false);
          document.cookie = 'alokhandwala_session=; path=/; max-age=0; SameSite=Lax';
        }
      } else {
        setIsAuthenticated(false);
        document.cookie = 'alokhandwala_session=; path=/; max-age=0; SameSite=Lax';
      }
    } catch (e) {
      console.error('Error loading session:', e);
      setIsAuthenticated(false);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const login = async (email: string, password?: string): Promise<{ success: boolean; error?: string }> => {
    const trimmedEmail = email.trim().toLowerCase();
    
    // Find user in pre-configured initialUsers or persistent store
    let user = initialUsers.find(u => u.email.toLowerCase() === trimmedEmail);
    if (!user) {
      try {
        const res = await fetch('/api/users');
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          user = json.data.find((u: any) => u.email.toLowerCase() === trimmedEmail);
        }
      } catch (e) {
        // fallback to initialUsers
      }
    }

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

    // Set authenticated state
    setCurrentUser(user);
    setIsAuthenticated(true);
    localStorage.setItem('alokhandwala_logged_in', 'true');
    localStorage.setItem('alokhandwala_active_user', user.id);
    document.cookie = `alokhandwala_session=${user.id}; path=/; max-age=86400; SameSite=Lax`;

    return { success: true };
  };

  const loginAsUser = (userId: string) => {
    const user = initialUsers.find(u => u.id === userId);
    if (user) {
      setCurrentUser(user);
      setIsAuthenticated(true);
      localStorage.setItem('alokhandwala_logged_in', 'true');
      localStorage.setItem('alokhandwala_active_user', user.id);
      document.cookie = `alokhandwala_session=${user.id}; path=/; max-age=86400; SameSite=Lax`;
    }
  };

  const logout = () => {
    setIsAuthenticated(false);
    localStorage.removeItem('alokhandwala_logged_in');
    localStorage.removeItem('alokhandwala_active_user');
    document.cookie = 'alokhandwala_session=; path=/; max-age=0; SameSite=Lax';
    router.push('/login');
  };

  const switchUser = (userId: string) => {
    const found = initialUsers.find(u => u.id === userId);
    if (found) {
      setCurrentUser(found);
      localStorage.setItem('alokhandwala_active_user', found.id);
      document.cookie = `alokhandwala_session=${found.id}; path=/; max-age=86400; SameSite=Lax`;
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
        availableUsers: initialUsers 
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
