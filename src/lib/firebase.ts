// Import the functions you need from the SDKs you need
import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInAnonymously, 
  linkWithPopup, 
  linkWithCredential, 
  EmailAuthProvider,
  onAuthStateChanged,
  type User,
  signOut,
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
  orderBy,
  getDocs
} from "firebase/firestore";

// Your web app's Firebase configuration, explicitly for movie-finder-kqqse
const firebaseConfig = {
  apiKey: "AIzaSyAyPvD9_qqD8R3ljCAjF5oCAOJJnU320Xk",
  authDomain: "movie-finder-kqqse.firebaseapp.com",
  projectId: "movie-finder-kqqse",
  storageBucket: "movie-finder-kqqse.appspot.com",
  messagingSenderId: "226527022824",
  appId: "1:226527022824:web:78c6557a8005dec26e435d"
};

// Initialize Firebase App
// This pattern ensures that Firebase is initialized only once.
let app: FirebaseApp;
if (!getApps().length) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApp();
}

// Get Auth instance
const auth = getAuth(app);

// Get Firestore instance - This specifically connects to the (default) Cloud Firestore database.
const db = getFirestore(app);

// Initialize other Firebase services
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
  getDocs,
  signOut,
  type User
};
