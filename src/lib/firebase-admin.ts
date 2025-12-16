import "server-only";
import { initializeApp, getApps, cert, getApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";

const serviceAccount = {
    projectId: process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
};

export function getAdminApp() {
    if (getApps().length === 0) {
        return initializeApp({
            credential: cert(serviceAccount),
        });
    }
    return getApp();
}

export const adminDb = getFirestore(getAdminApp());
export const adminAuth = getAuth(getAdminApp());
