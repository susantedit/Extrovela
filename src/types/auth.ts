/**
 * EXTROVELA — Authentication Domain Contracts
 */

export type AuthStateStatus = 'INITIALIZING' | 'SIGNED_OUT' | 'GUEST' | 'SIGNED_IN';

export interface AuthUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  isAnonymous: boolean;
  emailVerified: boolean;
  createdAt: string;
  lastLoginAt: string;
}

export interface AuthState {
  status: AuthStateStatus;
  user: AuthUser | null;
  isLoading: boolean;
  error: string | null;
}

export interface AuthCredentials {
  email: string;
  password?: string;
}
