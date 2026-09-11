'use client';

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import {
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  User,
} from 'firebase/auth';
import { auth, isFirebaseConfigured } from '@/lib/firebase/config';
import { getProfile } from '@/lib/firebase/db';
import { Profile, UserRole } from '@/lib/firebase/types';

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  role: UserRole | null;
  isManager: boolean;
  isEmployee: boolean;
  isDemoMode: boolean;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error?: string; role?: UserRole }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  // جلب مستند المستخدم من Firestore والتحقق من صلاحياته
  const fetchUserProfile = async (uid: string): Promise<Profile | null> => {
    try {
      const userProfile = await getProfile(uid);
      return userProfile;
    } catch (err) {
      console.error('Error fetching user document from Firestore:', err);
      return null;
    }
  };

  const refreshProfile = async () => {
    if (!user) return;
    const p = await fetchUserProfile(user.uid);
    if (p) {
      if (p.is_active === false || (p.role !== 'manager' && p.role !== 'employee')) {
        await signOut();
      } else {
        setProfile(p);
      }
    }
  };

  // مراقبة حالة جلسة Firebase Auth الحقيقية
  useEffect(() => {
    // تنظيف أي بقايا تجريبية سابقة
    if (typeof window !== 'undefined') {
      localStorage.removeItem('mahamee_demo_user');
      localStorage.removeItem('mahamee_demo_tasks');
      localStorage.removeItem('mahamee_demo_employees');
    }

    if (!isFirebaseConfigured()) {
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          const userProfile = await fetchUserProfile(firebaseUser.uid);
          // التحقق من وجود المستند وصلاحية الدور والتفعيل
          if (
            !userProfile ||
            (userProfile.role !== 'manager' && userProfile.role !== 'employee') ||
            userProfile.is_active === false
          ) {
            await firebaseSignOut(auth);
            setUser(null);
            setProfile(null);
          } else {
            setUser(firebaseUser);
            setProfile(userProfile);
          }
        } catch (e) {
          console.error('Auth state verification error:', e);
          setUser(null);
          setProfile(null);
        }
      } else {
        setUser(null);
        setProfile(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // تسجيل الدخول الحقيقي عبر البريد وكلمة المرور في Firebase Auth
  const signIn = async (
    email: string,
    password: string
  ): Promise<{ error?: string; role?: UserRole }> => {
    if (!isFirebaseConfigured()) {
      return { error: 'يرجى إعداد بيانات Firebase أولاً في ملف .env.local' };
    }

    try {
      // 1. تسجيل الدخول في Firebase Authentication
      const credential = await signInWithEmailAndPassword(auth, email.trim(), password);
      const uid = credential.user.uid;

      // 2. قراءة مستند المستخدم من Firestore: users/{uid}
      const userProfile = await fetchUserProfile(uid);

      // 3. التحقق من وجود المستند في Firestore
      if (!userProfile) {
        await firebaseSignOut(auth);
        setUser(null);
        setProfile(null);
        return {
          error: 'لم يتم العثور على بيانات الحساب في قاعدة البيانات (users). يرجى مراجعة إدارة النظام لتهيئة حسابك.',
        };
      }

      // 4. التحقق من الدور الوظيفي (manager أو employee)
      if (userProfile.role !== 'manager' && userProfile.role !== 'employee') {
        await firebaseSignOut(auth);
        setUser(null);
        setProfile(null);
        return {
          error: 'ليس لديكِ دور وظيفي صالح (مديرة أو موظفة) للوصول إلى النظام. يرجى التواصل مع الإدارة.',
        };
      }

      // 5. التحقق من حالة تفعيل الحساب
      if (userProfile.is_active === false) {
        await firebaseSignOut(auth);
        setUser(null);
        setProfile(null);
        return {
          error: 'تم تعطيل هذا الحساب من قبل الإدارة. يرجى مراجعة المديرة.',
        };
      }

      // نجاح تسجيل الدخول واعتماد الصلاحيات
      setUser(credential.user);
      setProfile(userProfile);
      return { role: userProfile.role };
    } catch (err: any) {
      console.error('Firebase sign in error:', err);
      if (
        err.code === 'auth/invalid-credential' ||
        err.code === 'auth/user-not-found' ||
        err.code === 'auth/wrong-password' ||
        err.code === 'auth/invalid-email'
      ) {
        return { error: 'البريد الإلكتروني أو كلمة المرور غير صحيحة' };
      }
      if (err.code === 'auth/too-many-requests') {
        return { error: 'تم إدخال كلمة المرور بشكل خاطئ عدة مرات. يرجى الانتظار قليلاً ثم المحاولة ثانية' };
      }
      return { error: err.message || 'حدث خطأ أثناء تسجيل الدخول. يرجى التحقق من اتصالك والمحاولة مجدداً' };
    }
  };

  // تسجيل الخروج الحقيقي
  const signOut = async () => {
    try {
      if (auth.currentUser) {
        await firebaseSignOut(auth);
      }
    } catch (err) {
      console.error('Sign out error:', err);
    } finally {
      setUser(null);
      setProfile(null);
      if (typeof window !== 'undefined') {
        localStorage.removeItem('mahamee_demo_user');
        localStorage.removeItem('mahamee_demo_tasks');
        localStorage.removeItem('mahamee_demo_employees');
        window.location.href = '/login';
      }
    }
  };

  const isManager = profile?.role === 'manager';
  const isEmployee = profile?.role === 'employee';

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        role: profile?.role || null,
        isManager,
        isEmployee,
        isDemoMode: false,
        loading,
        signIn,
        signOut,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
