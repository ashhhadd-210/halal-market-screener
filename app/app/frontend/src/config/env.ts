const DEFAULT_DEV_API_BASE = "http://localhost:8000/screen";

function sanitizeBaseUrl(value: string): string {
  return value.replace(/\/+$/, "");
}

function readRequired(name: keyof ImportMetaEnv): string {
  const value = import.meta.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

function readOptional(name: keyof ImportMetaEnv): string | undefined {
  const value = import.meta.env[name]?.trim();
  return value ? value : undefined;
}

const rawApiBase = readOptional("VITE_API_BASE");

export const appEnv = {
  isDev: import.meta.env.DEV,
  isProd: import.meta.env.PROD,
  apiBase: sanitizeBaseUrl(rawApiBase ?? (import.meta.env.DEV ? DEFAULT_DEV_API_BASE : readRequired("VITE_API_BASE"))),
  firebase: {
    apiKey: readRequired("VITE_FIREBASE_API_KEY"),
    authDomain: readRequired("VITE_FIREBASE_AUTH_DOMAIN"),
    projectId: readRequired("VITE_FIREBASE_PROJECT_ID"),
    storageBucket: readRequired("VITE_FIREBASE_STORAGE_BUCKET"),
    messagingSenderId: readRequired("VITE_FIREBASE_MESSAGING_SENDER_ID"),
    appId: readRequired("VITE_FIREBASE_APP_ID"),
    measurementId: readOptional("VITE_FIREBASE_MEASUREMENT_ID"),
  },
} as const;
