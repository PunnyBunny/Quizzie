import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFunctions, connectFunctionsEmulator } from "firebase/functions";
import { getStorage } from "firebase/storage";
import { firebaseConfig } from "./firebase-config";

const isTest = window.location.hostname === "localhost";

// Initialize Firebase
export const app = initializeApp(firebaseConfig);

// Initialize Firebase Authentication and export it for use in the app
export const auth = getAuth(app);

export { signInWithEmailAndPassword } from "firebase/auth";

export const functions = getFunctions(app);

if (isTest) {
  connectFunctionsEmulator(functions, "127.0.0.1", 5001);
}

export { FirebaseError } from "firebase/app";

export const storage = getStorage(app);

// if (window.location.hostname === "localhost") {
//   connectStorageEmulator(storage, "127.0.0.1", 9199);
// }
