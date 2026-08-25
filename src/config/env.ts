/**
 * EXTROVELA — Environment & Configuration System
 * 
 * Strict runtime validation for client-safe environment variables across
 * development, staging, and production environments.
 * 
 * Server-only secrets (e.g. Gemini AI keys, Database connection strings, Admin credentials)
 * must NEVER be placed here or exposed to the client bundle.
 */

export type AppEnvironment = 'development' | 'staging' | 'production';

export interface ClientConfig {
  env: AppEnvironment;
  isProduction: boolean;
  isDevelopment: boolean;
  apiBaseUrl: string;
  firebase: {
    apiKey: string;
    authDomain: string;
    projectId: string;
    storageBucket: string;
    messagingSenderId: string;
    appId: string;
    measurementId?: string;
  };
  features: {
    enableAnalytics: boolean;
    enableCrashlytics: boolean;
    enablePerformance: boolean;
    enableAppCheck: boolean;
    mockOfflineData: boolean;
    /**
     * Phase 13 dev-only escape hatch: serve mock real-world data instead of the
     * live provider client. HARD-BLOCKED in production builds (see below) so a
     * production app can never silently ship mock places/weather.
     */
    mockProviders: boolean;
    /**
     * Phase 14 dev-only escape hatch: seed fake companions / friendships and allow
     * fabricated handle-search results so the social UI can be exercised without a
     * configured Firebase project. HARD-BLOCKED in production (resolves to false
     * even if the env var is set) so real users never see invented social data.
     */
    mockSocial: boolean;
  };
  appName: string;
  appVersion: string;
}

const getEnvVar = (key: string, defaultValue = ''): string => {
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    return (import.meta.env[key] as string) || defaultValue;
  }
  return defaultValue;
};

const currentEnv = (getEnvVar('VITE_APP_ENV', getEnvVar('MODE', 'development'))) as AppEnvironment;

export const config: ClientConfig = {
  env: currentEnv,
  isProduction: currentEnv === 'production',
  isDevelopment: currentEnv === 'development',
  apiBaseUrl: getEnvVar('VITE_API_URL', 'http://localhost:5000'),
  firebase: {
    apiKey: getEnvVar('VITE_FIREBASE_API_KEY', 'placeholder-api-key'),
    authDomain: getEnvVar('VITE_FIREBASE_AUTH_DOMAIN', 'extrovela-app.firebaseapp.com'),
    projectId: getEnvVar('VITE_FIREBASE_PROJECT_ID', 'extrovela-app'),
    storageBucket: getEnvVar('VITE_FIREBASE_STORAGE_BUCKET', 'extrovela-app.appspot.com'),
    messagingSenderId: getEnvVar('VITE_FIREBASE_MESSAGING_SENDER_ID', '1234567890'),
    appId: getEnvVar('VITE_FIREBASE_APP_ID', '1:1234567890:web:abcdef123456'),
    measurementId: getEnvVar('VITE_FIREBASE_MEASUREMENT_ID', ''),
  },
  features: {
    enableAnalytics: getEnvVar('VITE_ENABLE_ANALYTICS', 'true') === 'true',
    enableCrashlytics: getEnvVar('VITE_ENABLE_CRASHLYTICS', 'true') === 'true',
    enablePerformance: getEnvVar('VITE_ENABLE_PERF', 'true') === 'true',
    enableAppCheck: getEnvVar('VITE_ENABLE_APP_CHECK', 'false') === 'true',
    mockOfflineData: getEnvVar('VITE_MOCK_OFFLINE', 'false') === 'true',
    // Only honoured OUTSIDE production. Even if VITE_USE_MOCK_PROVIDERS=true is
    // set in a production build, this resolves to false — production never mocks.
    mockProviders:
      currentEnv !== 'production' && getEnvVar('VITE_USE_MOCK_PROVIDERS', 'false') === 'true',
    // Same prod-blocked pattern for the social layer (Phase 14). Production never
    // seeds or fabricates companions; with no Firebase configured it fails clean.
    mockSocial:
      currentEnv !== 'production' && getEnvVar('VITE_USE_MOCK_SOCIAL', 'false') === 'true',
  },
  appName: 'EXTROVELA',
  appVersion: '1.0.0',
};

export default config;
