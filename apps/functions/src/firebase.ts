import * as admin from "firebase-admin";

// Initialize Firebase Admin once per instance
import serviceAccountKey from "../firebase-service-account-key.json";

admin.initializeApp({
  credential: admin.credential.cert(serviceAccountKey as admin.ServiceAccount),
  storageBucket: "quizzie-hku.firebasestorage.app",
});

export const db = admin.firestore();

export { FieldValue } from "firebase-admin/firestore";

export { admin };
