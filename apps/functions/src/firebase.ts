import * as admin from "firebase-admin";

admin.initializeApp({
  storageBucket: "quizzie-hku.firebasestorage.app",
});

export const db = admin.firestore();

export { FieldValue } from "firebase-admin/firestore";

export { admin };
