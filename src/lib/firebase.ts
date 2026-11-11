import { initializeApp } from 'firebase/app'
import { getAuth, GoogleAuthProvider } from 'firebase/auth'
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from 'firebase/firestore'

// Public web-app config (safe to commit); access control lives in Firestore rules.
// FIREBASE_CONFIG_PLACEHOLDER — filled in during project setup.
export const firebaseConfig = {
  apiKey: 'AIzaSyBT6TV87Wcd5KJI5PQSdS6XJEIL4uq4kPg',
  authDomain: 'kioku-f9m2x.firebaseapp.com',
  projectId: 'kioku-f9m2x',
  storageBucket: 'kioku-f9m2x.firebasestorage.app',
  messagingSenderId: '756085388182',
  appId: '1:756085388182:web:9ea11a6ce4373ac75f63b7',
}

export const app = initializeApp(firebaseConfig)
export const auth = getAuth(app)
export const googleProvider = new GoogleAuthProvider()

export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
})
