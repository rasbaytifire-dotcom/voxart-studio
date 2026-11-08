import { initializeApp } from 'firebase/app';
import { getFirestore, collection, doc, setDoc, getDoc, getDocs, deleteDoc } from 'firebase/firestore';
import { getAuth, signInAnonymously } from 'firebase/auth';

// Configuration loaded from firebase-applet-config.json
const firebaseConfig = {
  apiKey: "AIzaSyC3MKdgef5g5C5dg8re499j0Kbtc1Tf46E",
  authDomain: "braided-flux-bmvz5.firebaseapp.com",
  projectId: "braided-flux-bmvz5",
  storageBucket: "braided-flux-bmvz5.firebasestorage.app",
  messagingSenderId: "1023114298725",
  appId: "1:1023114298725:web:3aec7afbd80d15a00a8d8c"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, 'ai-studio-voxstudioaitextt-01f8280b-8fe3-4c8e-94f1-05b61385d6ac');
export const auth = getAuth(app);

// Helper to ensure anonymous auth for cloud storage access
export async function ensureAuth() {
  if (!auth.currentUser) {
    try {
      await signInAnonymously(auth);
    } catch (e: any) {
      if (e?.code === 'auth/admin-restricted-operation') {
        // Expected when anonymous auth is disabled in Firebase console; public firestore rules permit read/write.
      } else {
        console.warn("Firebase auth warning:", e);
      }
    }
  }
}
