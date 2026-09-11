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
import { Profile, Task, UserRole } from './types';

// ==============================================================================
// Profiles (المستخدمات / الموظفات)
// ==============================================================================

export async function getProfile(userId: string): Promise<Profile | null> {
  // 1. قراءة مستند المستخدم أولاً من مجموعة users/{uid} كما هو مطلوب بدقة
  const userRef = doc(db, 'users', userId);
  const userSnap = await getDoc(userRef);
  if (userSnap.exists()) {
    const data = userSnap.data();
    return {
      id: userId,
      name: data.name || data.displayName || data.email?.split('@')[0] || 'مستخدم',
      email: data.email || '',
      role: data.role as UserRole,
      is_active: data.is_active !== undefined ? data.is_active : (data.isActive !== undefined ? data.isActive : true),
      created_at: data.created_at || data.createdAt || new Date().toISOString(),
      updated_at: data.updated_at || data.updatedAt || new Date().toISOString(),
    };
  }

  // 2. كخيار احتياطي قراءة profiles/{uid}
  const profRef = doc(db, 'profiles', userId);
  const profSnap = await getDoc(profRef);
  if (profSnap.exists()) {
    const data = profSnap.data();
    return {
      id: userId,
      name: data.name || data.displayName || data.email?.split('@')[0] || 'مستخدم',
      email: data.email || '',
      role: data.role as UserRole,
      is_active: data.is_active !== undefined ? data.is_active : (data.isActive !== undefined ? data.isActive : true),
      created_at: data.created_at || data.createdAt || new Date().toISOString(),
      updated_at: data.updated_at || data.updatedAt || new Date().toISOString(),
    };
  }

  return null;
}

export const getUserDocument = getProfile;

export async function setProfile(profile: Profile): Promise<void> {
  const userRef = doc(db, 'users', profile.id);
  const profRef = doc(db, 'profiles', profile.id);
  await Promise.all([
    setDoc(userRef, profile, { merge: true }),
    setDoc(profRef, profile, { merge: true }),
  ]);
}

export async function getAllProfiles(): Promise<Profile[]> {
  const usersCol = collection(db, 'users');
  const userSnap = await getDocs(usersCol);
  if (!userSnap.empty) {
    return userSnap.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        name: data.name || data.displayName || data.email?.split('@')[0] || 'مستخدم',
        email: data.email || '',
        role: data.role as UserRole,
        is_active: data.is_active !== undefined ? data.is_active : (data.isActive !== undefined ? data.isActive : true),
        created_at: data.created_at || data.createdAt || new Date().toISOString(),
        updated_at: data.updated_at || data.updatedAt || new Date().toISOString(),
      };
    });
  }

  const profCol = collection(db, 'profiles');
  const profSnap = await getDocs(profCol);
  return profSnap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      name: data.name || data.displayName || data.email?.split('@')[0] || 'مستخدم',
      email: data.email || '',
      role: data.role as UserRole,
      is_active: data.is_active !== undefined ? data.is_active : true,
      created_at: data.created_at || new Date().toISOString(),
      updated_at: data.updated_at || new Date().toISOString(),
    };
  });
}

export async function updateProfile(userId: string, data: Partial<Profile>): Promise<void> {
  const updatedData = {
    ...data,
    updated_at: new Date().toISOString(),
  };
  const userRef = doc(db, 'users', userId);
  const profRef = doc(db, 'profiles', userId);
  await Promise.allSettled([
    setDoc(userRef, updatedData, { merge: true }),
    setDoc(profRef, updatedData, { merge: true }),
  ]);
}

export async function deleteProfile(userId: string): Promise<void> {
  const userRef = doc(db, 'users', userId);
  const profRef = doc(db, 'profiles', userId);
  await Promise.allSettled([
    deleteDoc(userRef),
    deleteDoc(profRef),
  ]);

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
