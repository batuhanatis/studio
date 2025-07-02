import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore, enableIndexedDbPersistence } from "firebase/firestore";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAyPvD9_qqD8R3ljCAjF5oCAOJJnU320Xk",
  authDomain: "movie-finder-kqqse.firebaseapp.com",
  databaseURL: "https://movie-finder-kqqse-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "movie-finder-kqqse",
  storageBucket: "movie-finder-kqqse.firebasestorage.app",
  messagingSenderId: "226527022824",
  appId: "1:226527022824:web:78c6557a8005dec26e435d"
};

// Initialize Firebase
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);
const db = getFirestore(app);

enableIndexedDbPersistence(db)
  .catch((err) => {
    if (err.code == 'failed-precondition') {
      // Multiple tabs open, persistence can only be enabled
      // in one tab at a time.
      console.warn("Firestore persistence failed: Multiple tabs open.");
    } else if (err.code == 'unimplemented') {
      // The current browser does not support all of the
      // features required to enable persistence
      console.warn("Firestore persistence not supported in this browser.");
    }
  });

export { app, auth, db };
