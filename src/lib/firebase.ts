import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";

// IMPORTANT: Replace the following with your app's Firebase project configuration.
// See: https://firebase.google.com/docs/web/setup#available-libraries
const firebaseConfig = {
  apiKey: "AIzaSyA86GPu4bus3pcVf0ryIc-2ebsUYNVZW5U",
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

export { app, auth };
