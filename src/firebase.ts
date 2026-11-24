import { initializeApp } from 'firebase/app'
import { connectAuthEmulator, getAuth } from 'firebase/auth'
import {
  connectFirestoreEmulator,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from 'firebase/firestore'

// These values come from the Firebase console (Project settings > Your apps) and are safe to publish:
// access is controlled by the security rules, not by keeping these secret.
export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY ?? 'demo-key',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ?? 'demo-school-marks.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID ?? 'demo-school-marks',
  appId: import.meta.env.VITE_FIREBASE_APP_ID ?? 'demo-app',
}

export const useEmulator = import.meta.env.VITE_USE_EMULATOR === 'true' || !import.meta.env.VITE_FIREBASE_API_KEY

export const app = initializeApp(firebaseConfig)
export const auth = getAuth(app)

// Keep a copy of the data on the device so marks can be entered on a weak connection and sync later.
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
})

if (useEmulator) {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true })
  connectFirestoreEmulator(db, '127.0.0.1', 8080)
}
