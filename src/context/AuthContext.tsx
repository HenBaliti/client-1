import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import type {
  User,
  AuthContextType,
  LoginCredentials,
  SignupCredentials,
  StoredUser,
} from '../types/auth';

const AuthContext = createContext<AuthContextType | null>(null);

// Simple hash function for demo (in production, use bcrypt on server)
function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return hash.toString(36);
}

// Storage keys
const USERS_KEY = 'cw_users';
const CURRENT_USER_KEY = 'cw_current_user';

function getStoredUsers(): StoredUser[] {
  const data = localStorage.getItem(USERS_KEY);
  return data ? JSON.parse(data) : [];
}

function saveStoredUsers(users: StoredUser[]): void {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load user on mount
  useEffect(() => {
    const savedUser = localStorage.getItem(CURRENT_USER_KEY);
    if (savedUser) {
      setUser(JSON.parse(savedUser));
    }
    setIsLoading(false);
  }, []);

  // Save user changes
  useEffect(() => {
    if (user) {
      localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(CURRENT_USER_KEY);
    }
  }, [user]);

  const login = async (credentials: LoginCredentials): Promise<void> => {
    setIsLoading(true);
    setError(null);

    try {
      // Simulate network delay
      await new Promise(resolve => setTimeout(resolve, 500));

      const users = getStoredUsers();
      const storedUser = users.find(u => u.email === credentials.email);

      if (!storedUser) {
        throw new Error('User not found. Please sign up first.');
      }

      if (storedUser.passwordHash !== simpleHash(credentials.password)) {
        throw new Error('Invalid email or password.');
      }

      const { passwordHash, ...userWithoutPassword } = storedUser;
      setUser(userWithoutPassword);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const signup = async (credentials: SignupCredentials): Promise<void> => {
    setIsLoading(true);
    setError(null);

    try {
      await new Promise(resolve => setTimeout(resolve, 500));

      const users = getStoredUsers();
      
      if (users.some(u => u.email === credentials.email)) {
        throw new Error('Email already registered. Please login instead.');
      }

      if (credentials.password.length < 6) {
        throw new Error('Password must be at least 6 characters.');
      }

      const newUser: StoredUser = {
        id: crypto.randomUUID(),
        email: credentials.email,
        displayName: credentials.displayName,
        provider: 'email',
        createdAt: new Date(),
        emailVerified: false,
        passwordHash: simpleHash(credentials.password),
      };

      users.push(newUser);
      saveStoredUsers(users);

      const { passwordHash, ...userWithoutPassword } = newUser;
      setUser(userWithoutPassword);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Signup failed');
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const loginWithGoogle = async (): Promise<void> => {
    setIsLoading(true);
    setError(null);

    try {
      // Simulate Google OAuth flow
      // In production, use @react-oauth/google or Firebase Auth
      await new Promise(resolve => setTimeout(resolve, 800));

      // Create a mock Google user for demo
      const mockGoogleId = 'google_' + Math.random().toString(36).slice(2);
      const users = getStoredUsers();
      
      // Check if Google user exists (by provider + mock)
      let googleUser = users.find(u => u.provider === 'google' && u.id.startsWith('google_'));
      
      if (!googleUser) {
        // Create new Google user
        const newUser: StoredUser = {
          id: mockGoogleId,
          email: `user${Date.now()}@gmail.com`,
          displayName: 'Google User',
          photoUrl: 'https://ui-avatars.com/api/?name=Google+User&background=4285f4&color=fff',
          provider: 'google',
          createdAt: new Date(),
          emailVerified: true,
          passwordHash: '',
        };
        
        users.push(newUser);
        saveStoredUsers(users);
        googleUser = newUser;
      }

      const { passwordHash, ...userWithoutPassword } = googleUser;
      setUser(userWithoutPassword);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Google login failed');
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = (): void => {
    setUser(null);
    setError(null);
  };

  const clearError = (): void => {
    setError(null);
  };

  const updateProfile = async (updates: Partial<User>): Promise<void> => {
    if (!user) return;

    setIsLoading(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 300));

      const users = getStoredUsers();
      const idx = users.findIndex(u => u.id === user.id);
      
      if (idx !== -1) {
        users[idx] = { ...users[idx], ...updates };
        saveStoredUsers(users);
      }

      setUser(prev => prev ? { ...prev, ...updates } : null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed');
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const deleteAccount = async (): Promise<void> => {
    if (!user) return;

    setIsLoading(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 500));

      const users = getStoredUsers();
      const filtered = users.filter(u => u.id !== user.id);
      saveStoredUsers(filtered);

      // Clear subscription data
      localStorage.removeItem('cw_subscription');
      
      setUser(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        error,
        login,
        signup,
        loginWithGoogle,
        logout,
        clearError,
        updateProfile,
        deleteAccount,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
