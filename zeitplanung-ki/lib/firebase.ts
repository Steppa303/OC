import { initializeApp } from "firebase/app";
import { getStorage } from "firebase/storage";
import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyAf0Jnso3VOr3yFLpKTq0JYzNnXyBhpqkk",
  authDomain: "grandiosezeitplanung.firebaseapp.com",
  projectId: "grandiosezeitplanung",
  storageBucket: "grandiosezeitplanung.firebasestorage.app",
  messagingSenderId: "866078134526",
  appId: "1:866078134526:web:d953044a1bd653d90d55af"
};

// Initialize Modular App (for Storage/Utils)
// usage in utils.ts relies on modular storage instance
const app = initializeApp(firebaseConfig);
export const storage = getStorage(app);

// Initialize Compat App (for Firestore)
// Switching to compat/namespaced API to resolve "no exported member" errors
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

export const db = firebase.firestore();