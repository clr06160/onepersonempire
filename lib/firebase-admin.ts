import { applicationDefault, cert, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';

function privateKeyFromEnv() {
  return process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
}

export function initializeFirebaseAdmin() {
  if (getApps().length) return;

  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = privateKeyFromEnv();

  if (projectId && clientEmail && privateKey) {
    initializeApp({
      credential: cert({
        projectId,
        clientEmail,
        privateKey,
      }),
      projectId,
    });
    return;
  }

  initializeApp({
    credential: applicationDefault(),
    projectId,
  });
}

export function getAdminFirestore() {
  initializeFirebaseAdmin();
  return getFirestore(process.env.FIRESTORE_DATABASE_ID || '(default)');
}

export function getAdminStorageBucket() {
  const bucketName = process.env.PUBLISHED_ASSETS_BUCKET;
  if (!bucketName) throw new Error('Missing PUBLISHED_ASSETS_BUCKET in .env.local');

  initializeFirebaseAdmin();
  return getStorage().bucket(bucketName);
}
