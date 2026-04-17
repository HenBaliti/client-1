// ========== Authentication Types ==========

export type AuthProvider = 'email' | 'google';

export interface User {
  id: string;
  email: string;
  displayName: string;
  photoUrl?: string;
  provider: AuthProvider;
  createdAt: Date;
  emailVerified: boolean;
}

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface SignupCredentials {
  email: string;
  password: string;
  displayName: string;
}

export interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  login: (credentials: LoginCredentials) => Promise<void>;
  signup: (credentials: SignupCredentials) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  logout: () => void;
  clearError: () => void;
  updateProfile: (updates: Partial<User>) => Promise<void>;
  deleteAccount: () => Promise<void>;
}

// For demo purposes - in production use proper backend
export interface StoredUser extends User {
  passwordHash: string;
}
