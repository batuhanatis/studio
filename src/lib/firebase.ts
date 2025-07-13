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
  deleteUser,
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
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";

// Your web app's Firebase configuration for watchme-b8338
const firebaseConfig = {
  apiKey: "AIzaSyAWmjaDJyPlr3ObiP2wKFxriNkNzA4f_DM",
  authDomain: "watchme-b8338.firebaseapp.com",
  projectId: "watchme-b8338",
  storageBucket: "watchme-b8338.appspot.com",
  messagingSenderId: "184640156630",
  appId: "1:184640156630:web:e5a38718ee3f540e746a77",
  measurementId: "G-ZM8DPW9F7T"
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

// Get Storage instance
const storage = getStorage(app);

// Initialize other Firebase services
const googleProvider = new GoogleAuthProvider();

export { 
  app, 
  auth, 
  db,
  storage,
  ref,
  uploadBytes,
  getDownloadURL,
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
  deleteUser,
  type User
};
