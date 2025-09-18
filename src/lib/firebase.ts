import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyCQJDp55tB7OSPxr1QrfvtgHHr9y5OMLPI",
  authDomain: "quizzie-hku.firebaseapp.com",
  projectId: "quizzie-hku",
  storageBucket: "quizzie-hku.firebasestorage.app",
  messagingSenderId: "946562431166",
  appId: "1:946562431166:web:ed85280e879a9e9b2806ef",
  measurementId: "G-7PSGM0GJP7",
};

// Initialize Firebase
export const app = initializeApp(firebaseConfig);

// Initialize Firebase Authentication and export it for use in the app
export const auth = getAuth(app);

export { signInWithEmailAndPassword } from "firebase/auth";

export { FirebaseError } from "firebase/app";
