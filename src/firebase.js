import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDj4hEZe4UkxGtaxVIb5uATBmHB9r8WGis",
  authDomain: "prabhat-diesels.firebaseapp.com",
  projectId: "prabhat-diesels",
  storageBucket: "prabhat-diesels.firebasestorage.app",
  messagingSenderId: "185274258504",
  appId: "1:185274258504:web:6a7cf6b088f9c8e090b47d"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
