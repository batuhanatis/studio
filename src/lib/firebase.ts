import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAyPvD9_qqD8R3ljCAjF5oCAOJJnU320Xk",
  authDomain: "movie-finder-kqqse.firebaseapp.com",
  databaseURL: "https://movie-finder-kqqse-default-rtdb.firebaseio.com",
  projectId: "movie-finder-kqqse",
  storageBucket: "movie-finder-kqqse.firebasestorage.app",
  messagingSenderId: "226527022824",
  appId: "1:226527022824:web:78c6557a8005dec26e435d"
};

// Initialize Firebase
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);
const db = getFirestore(app);

export { app, auth, db };
