import * as admin from "firebase-admin";

// Initialize Firebase Admin once per instance
admin.initializeApp();

export const db = admin.firestore();

export { FieldValue } from "firebase-admin/firestore";
