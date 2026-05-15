// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getStorage } from "firebase/storage";
import { getFirestore } from "firebase/firestore";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAzQG2iu-2EMCxjIrtNdTIQn51Gcjem7kY",
  authDomain: "voltflow-7ae91.firebaseapp.com",
  projectId: "voltflow-7ae91",
  storageBucket: "voltflow-7ae91.firebasestorage.app",
  messagingSenderId: "603730244612",
  appId: "1:603730244612:web:a3a0a8d685a186df2e3151"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const storage = getStorage(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

export { app, auth, storage, db, provider };
