import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  addDoc,
} from 'firebase/firestore';
import { db } from './config';
import { Profile, Task } from './types';

// ==============================================================================
// Profiles (المستخدمات / الموظفات)
// ==============================================================================

export async function getProfile(userId: string): Promise<Profile | null> {
  const docRef = doc(db, 'profiles', userId);
  const snap = await getDoc(docRef);
  if (!snap.exists()) return null;
  return snap.data() as Profile;
}

export async function setProfile(profile: Profile): Promise<void> {
  const docRef = doc(db, 'profiles', profile.id);
  await setDoc(docRef, profile, { merge: true });
}

export async function getAllProfiles(): Promise<Profile[]> {
  const colRef = collection(db, 'profiles');
  const snap = await getDocs(colRef);
  return snap.docs.map((d) => d.data() as Profile);
}

export async function updateProfile(userId: string, data: Partial<Profile>): Promise<void> {
  const docRef = doc(db, 'profiles', userId);
  await updateDoc(docRef, {
    ...data,
    updated_at: new Date().toISOString(),
  });
}

export async function deleteProfile(userId: string): Promise<void> {
  // حذف المستخدم من profiles
  const docRef = doc(db, 'profiles', userId);
  await deleteDoc(docRef);

  // حذف كافة مهام المستخدم
  const tasksCol = collection(db, 'tasks');
  const q = query(tasksCol, where('user_id', '==', userId));
  const snap = await getDocs(q);
  const deletePromises = snap.docs.map((d) => deleteDoc(d.ref));
  await Promise.all(deletePromises);
}

// ==============================================================================
// Tasks (المهام)
// ==============================================================================

export async function getUserTasks(userId: string): Promise<Task[]> {
  const tasksCol = collection(db, 'tasks');
  const q = query(tasksCol, where('user_id', '==', userId));
  const snap = await getDocs(q);
  const list = snap.docs.map((d) => ({ ...d.data(), id: d.id } as Task));
  // فرز حسب تاريخ الإنشاء تنازلياً
  return list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}

export async function getAllTasks(): Promise<Task[]> {
  const tasksCol = collection(db, 'tasks');
  const snap = await getDocs(tasksCol);
  const list = snap.docs.map((d) => ({ ...d.data(), id: d.id } as Task));
  return list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}

export async function createTask(taskData: Omit<Task, 'id' | 'created_at' | 'updated_at'>): Promise<Task> {
  const tasksCol = collection(db, 'tasks');
  const now = new Date().toISOString();
  const docRef = await addDoc(tasksCol, {
    ...taskData,
    created_at: now,
    updated_at: now,
  });

  return {
    ...taskData,
    id: docRef.id,
    created_at: now,
    updated_at: now,
  };
}

export async function updateTask(taskId: string, data: Partial<Task>): Promise<void> {
  const docRef = doc(db, 'tasks', taskId);
  await updateDoc(docRef, {
    ...data,
    updated_at: new Date().toISOString(),
  });
}

export async function deleteTask(taskId: string): Promise<void> {
  const docRef = doc(db, 'tasks', taskId);
  await deleteDoc(docRef);
}
