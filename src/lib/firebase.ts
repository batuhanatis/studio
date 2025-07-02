import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore, enableIndexedDbPersistence } from "firebase/firestore";

// IMPORTANT: Replace the following with your app's Firebase project configuration.
// See: https://firebase.google.com/docs/web/setup#available-libraries
const firebaseConfig = {
  apiKey: "AIzaSyDAeK5suiJ0O1-LvqZ-QA8KaTv0C_h7NR8",
  authDomain: "watchme-apps.firebaseapp.com",
  projectId: "watchme-apps",
  storageBucket: "watchme-apps.firebasestorage.app",
  messagingSenderId: "1076703186319",
  appId: "1:1076703186319:web:78f9255429938f976b4ffa",
  measurementId: "G-77JR4JZ88X"
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
