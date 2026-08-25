/**
 * EXTROVELA — Authentication State Machine Context (Phase 3)
 * 
 * Manages the auth state lifecycle:
 * INITIALIZING -> SIGNED_OUT / GUEST / SIGNED_IN
 */

import React, { createContext, useContext, useState, useEffect } from 'react';
import { AuthUser, AuthStateStatus } from '../types/auth';
import { firebaseAuth } from '../services/firebase/firebaseAuth';
import { analytics } from '../services/firebase/firebaseAnalytics';
import { getHumanReadableErrorMessage } from '../utils/errorHandler';
import logger from '../utils/logger';

interface AuthContextType {
  status: AuthStateStatus;
  user: AuthUser | null;
  isLoading: boolean;
  error: string | null;
  signInAsGuest: () => Promise<void>;
  signInWithEmail: (email: string, pass: string) => Promise<void>;
  signUpWithEmail: (name: string, email: string, pass: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  linkAccountToEmail: (email: string, pass: string) => Promise<void>;
  sendPasswordReset: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
  deleteAccount: () => Promise<void>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [status, setStatus] = useState<AuthStateStatus>('INITIALIZING');
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    logger.info('Initializing Firebase Authentication listener...');
    const unsubscribe = firebaseAuth.onAuthState((authUser, authStatus) => {
      setUser(authUser);
      setStatus(authStatus);
      setIsLoading(false);
      logger.info('Auth state updated', { status: authStatus, uid: authUser?.uid });
    });

    return () => unsubscribe();
  }, []);

  const signInAsGuest = async () => {
    setIsLoading(true);
    setError(null);
    try {
      analytics.trackEvent('guest_started');
      const guest = await firebaseAuth.signInAsGuest();
      setUser(guest);
      setStatus('GUEST');
      analytics.trackEvent('auth_completed', { category: 'guest' });
    } catch (err: any) {
      const msg = getHumanReadableErrorMessage(err);
      setError(msg);
      setStatus('SIGNED_OUT');
    } finally {
      setIsLoading(false);
    }
  };

  const signInWithEmail = async (email: string, pass: string) => {
    setIsLoading(true);
    setError(null);
    try {
      analytics.trackEvent('auth_started', { category: 'email' });
      const signedIn = await firebaseAuth.signInWithEmail(email, pass);
      setUser(signedIn);
      setStatus('SIGNED_IN');
      analytics.trackEvent('auth_completed', { category: 'email' });
    } catch (err: any) {
      setError(getHumanReadableErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  const signUpWithEmail = async (name: string, email: string, pass: string) => {
    setIsLoading(true);
    setError(null);
    try {
      analytics.trackEvent('auth_started', { category: 'email_signup' });
      const created = await firebaseAuth.signUpWithEmail(name, email, pass);
      setUser(created);
      setStatus('SIGNED_IN');
      analytics.trackEvent('auth_completed', { category: 'email_signup' });
    } catch (err: any) {
      setError(getHumanReadableErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  const signInWithGoogle = async () => {
    setIsLoading(true);
    setError(null);
    try {
      analytics.trackEvent('auth_started', { category: 'google' });
      const gUser = await firebaseAuth.signInWithGoogle();
      setUser(gUser);
      setStatus('SIGNED_IN');
      analytics.trackEvent('auth_completed', { category: 'google' });
    } catch (err: any) {
      setError(getHumanReadableErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  const linkAccountToEmail = async (email: string, pass: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const linked = await firebaseAuth.linkGuestToEmail(email, pass);
      setUser(linked);
      setStatus('SIGNED_IN');
      analytics.trackEvent('guest_converted', { category: 'email' });
    } catch (err: any) {
      setError(getHumanReadableErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  const sendPasswordReset = async (email: string) => {
    setIsLoading(true);
    setError(null);
    try {
      await firebaseAuth.sendPasswordReset(email);
    } catch (err: any) {
      setError(getHumanReadableErrorMessage(err));
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const signOut = async () => {
    setIsLoading(true);
    try {
      await firebaseAuth.signOut();
      setUser(null);
      setStatus('SIGNED_OUT');
    } finally {
      setIsLoading(false);
    }
  };

  const deleteAccount = async () => {
    setIsLoading(true);
    try {
      await firebaseAuth.deleteAccount();
      setUser(null);
      setStatus('SIGNED_OUT');
    } finally {
      setIsLoading(false);
    }
  };

  const clearError = () => setError(null);

  return (
    <AuthContext.Provider
      value={{
        status,
        user,
        isLoading,
        error,
        signInAsGuest,
        signInWithEmail,
        signUpWithEmail,
        signInWithGoogle,
        linkAccountToEmail,
        sendPasswordReset,
        signOut,
        deleteAccount,
        clearError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
