import * as admin from "firebase-admin";

// Initialize Firebase Admin once per instance
admin.initializeApp();

export const db = admin.firestore();
export const bucket = admin.storage().bucket();
export { FieldValue } from "firebase-admin/firestore";
