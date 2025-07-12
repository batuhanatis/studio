import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInAnonymously, 
  linkWithPopup, 
  linkWithCredential, 
  EmailAuthProvider,
  onAuthStateChanged,
  type User
} from "firebase/auth";
import { 
  getFirestore,
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
  updateDoc,
  collection,
  query,
  where,
  addDoc,
  deleteDoc,
  writeBatch,
  runTransaction,
  arrayUnion,
  arrayRemove,
  onSnapshot,
  orderBy
} from "firebase/firestore";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAyPvD9_qqD8R3ljCAjF5oCAOJJnU320Xk",
  authDomain: "movie-finder-kqqse.firebaseapp.com",
  projectId: "movie-finder-kqqse",
  storageBucket: "movie-finder-kqqse.appspot.com",
  messagingSenderId: "226527022824",
  appId: "1:226527022824:web:78c6557a8005dec26e435d"
};

// Initialize Firebase
const app: FirebaseApp = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);
const db = getFirestore(app);
const googleProvider = new GoogleAuthProvider();

export { 
  app, 
  auth, 
  db, 
  googleProvider, 
  signInAnonymously, 
  linkWithPopup, 
  linkWithCredential, 
  EmailAuthProvider,
  onAuthStateChanged,
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
  updateDoc,
  collection,
  query,
  where,
  addDoc,
  deleteDoc,
  writeBatch,
  runTransaction,
  arrayUnion,
  arrayRemove,
  onSnapshot,
  orderBy,
  type User
};
