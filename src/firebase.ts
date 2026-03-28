import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth, signInAnonymously, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

export { signInWithPopup };

// Authenticate anonymously by default so we can write to Firestore
// But we should check if we are already logged in
auth.onAuthStateChanged((user) => {
  if (!user) {
    signInAnonymously(auth).catch((error) => {
      console.error("Error signing in anonymously:", error);
    });
  }
});
