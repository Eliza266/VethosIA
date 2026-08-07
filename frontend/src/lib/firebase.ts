import { initializeApp } from 'firebase/app';
import { connectAuthEmulator, getAuth, GoogleAuthProvider } from 'firebase/auth';
import { connectFirestoreEmulator, getFirestore } from 'firebase/firestore';
import { connectStorageEmulator, getStorage } from 'firebase/storage';

// Init real de Firebase. Antes vivia en services/firebase.ts y ademas estaba
// duplicado en config/firebase.ts (que solo reexportaba). Centralizamos aca en
// lib/ y dejamos services/firebase.ts como alias para no romper los imports viejos.
const rawFirebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const REQUIRED_FIREBASE_KEYS = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_STORAGE_BUCKET',
  'VITE_FIREBASE_APP_ID',
] as const;

export const useFirebaseEmulators =
  import.meta.env.DEV && import.meta.env.VITE_USE_FIREBASE_EMULATORS === 'true';

export const missingFirebaseConfig = REQUIRED_FIREBASE_KEYS.filter((key) => {
  const envKey = key.replace('VITE_FIREBASE_', '') as keyof typeof rawFirebaseConfig;
  const configKey = envKey.toLowerCase().replace(/_([a-z])/g, (_, char: string) => char.toUpperCase()) as keyof typeof rawFirebaseConfig;
  return !rawFirebaseConfig[configKey];
});

export const isFirebaseConfigured = useFirebaseEmulators || missingFirebaseConfig.length === 0;

const firebaseConfig = {
  apiKey: rawFirebaseConfig.apiKey || 'vetia-local-missing-api-key',
  authDomain: rawFirebaseConfig.authDomain || 'vethosia-5895b.firebaseapp.com',
  projectId: rawFirebaseConfig.projectId || 'vethosia-5895b',
  storageBucket: rawFirebaseConfig.storageBucket || 'vethosia-5895b.firebasestorage.app',
  messagingSenderId: rawFirebaseConfig.messagingSenderId || '000000000000',
  appId: rawFirebaseConfig.appId || '1:000000000000:web:0000000000000000000000',
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
auth.languageCode = 'es';
export const googleProvider = new GoogleAuthProvider();
export const db = getFirestore(app);
export const storage = getStorage(app);

const emulatorState = globalThis as typeof globalThis & {
  __VETIA_FIREBASE_EMULATORS_CONNECTED__?: boolean;
};

if (useFirebaseEmulators && !emulatorState.__VETIA_FIREBASE_EMULATORS_CONNECTED__) {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
  connectStorageEmulator(storage, '127.0.0.1', 9199);
  emulatorState.__VETIA_FIREBASE_EMULATORS_CONNECTED__ = true;
}
