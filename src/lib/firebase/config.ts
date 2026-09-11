import { initializeApp, getApps, getApp, deleteApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

export const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyDDLRO_H5_HgUUsCnhK1A-6DWgnOGkD0BY",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "tasks-899c9.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "tasks-899c9",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "tasks-899c9.firebasestorage.app",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "447982585378",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:447982585378:web:527acd852bf1595f5d6c7b",
};

export const isFirebaseConfigured = () => {
  return Boolean(firebaseConfig.apiKey && firebaseConfig.apiKey !== 'AIzaSy...');
};

// Initialize Primary Firebase App
export const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

if (typeof window !== 'undefined') {
  console.log('[Firebase Initialization]', {
    projectId: firebaseConfig.projectId,
    authDomain: firebaseConfig.authDomain,
    apiKeyPrefix: firebaseConfig.apiKey.substring(0, 10) + '...',
  });
}

// دالة مساعدة لإنشاء حساب موظفة جديدة في Firebase Auth بدون تسجيل خروج المديرة الحالية
export async function createEmployeeAuthAccount(email: string, pass: string): Promise<string> {
  const secondaryAppName = `secondary-auth-${Date.now()}`;
  const secondaryApp = initializeApp(firebaseConfig, secondaryAppName);
  const secondaryAuth = getAuth(secondaryApp);

  try {
    const userCredential = await createUserWithEmailAndPassword(secondaryAuth, email, pass);
    const newUid = userCredential.user.uid;
    await signOut(secondaryAuth);
    return newUid;
  } finally {
    await deleteApp(secondaryApp);
  }
}
