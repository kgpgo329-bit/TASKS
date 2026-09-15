/**
 * © 2026 Jory Al-Thuwaini — Mahami Platform
 * منصة مهامي — جميع الحقوق محفوظة
 */

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
  const [user, setUser] = useState<User | null>(() => {
    return auth.currentUser || null;
  });
  const [profile, setProfile] = useState<Profile | null>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('mahamee_cached_profile');
        if (saved) return JSON.parse(saved);
      } catch {}
    }
    return null;
  });
  const [loading, setLoading] = useState<boolean>(true);

  // جلب مستند المستخدم من Firestore والتحقق من صلاحياته
  const fetchUserProfile = async (
    uid: string
  ): Promise<{ profile: Profile | null; error?: string }> => {
    try {
      const userProfile = await getProfile(uid);
      if (userProfile && typeof window !== 'undefined') {
        try {
          localStorage.setItem('mahamee_cached_profile', JSON.stringify(userProfile));
        } catch {}
      }
      return { profile: userProfile };
    } catch (err: any) {
      console.warn('Warning fetching user document from Firestore:', err?.message || err);
      // كخيار احتياطي في حال بطء الشبكة، قراءة البروفايل المحفوظ محلياً
      if (typeof window !== 'undefined') {
        try {
          const saved = localStorage.getItem('mahamee_cached_profile');
          if (saved) {
            const parsed = JSON.parse(saved);
            if (parsed && (parsed.id === uid || parsed.email)) {
              return { profile: parsed };
            }
          }
        } catch {}
      }
      return { profile: null, error: err?.message || 'Network error' };
    }
  };

  const refreshProfile = async () => {
    if (!user) return;
    try {
      const res = await fetchUserProfile(user.uid);
      const p = res.profile;
      if (p) {
        if (p.is_active === false || (p.role !== 'manager' && p.role !== 'employee')) {
          await signOut();
        } else {
          setProfile(p);
        }
      }
    } catch (err) {
      console.warn('refreshProfile error:', err);
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

    // مؤقت أمان يضمن عدم بقاء شاشة التحميل معلقة أكثر من 7 ثوانٍ في أي ظرف شبكي
    const safetyTimer = setTimeout(() => {
      setLoading(false);
    }, 7000);

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      try {
        if (firebaseUser) {
          const res = await fetchUserProfile(firebaseUser.uid);
          if (res.error) {
            // في حالة وجود خطأ شبكة مؤقت لا نسجل الخروج قسراً بل نحافظ على المستخدم
            setUser(firebaseUser);
          } else if (
            !res.profile ||
            (res.profile.role !== 'manager' && res.profile.role !== 'employee') ||
            res.profile.is_active === false
          ) {
            // إذا كان المستند غير موجود نهائياً أو معطل من الإدارة
            await firebaseSignOut(auth);
            setUser(null);
            setProfile(null);
          } else {
            setUser(firebaseUser);
            setProfile(res.profile);
          }
        } else {
          setUser(null);
          setProfile(null);
        }
      } catch (e) {
        console.error('Auth state verification error:', e);
      } finally {
        clearTimeout(safetyTimer);
        setLoading(false);
      }
    });

    return () => {
      clearTimeout(safetyTimer);
      unsubscribe();
    };
  }, []);

  // تسجيل الدخول الحقيقي عبر البريد وكلمة المرور في Firebase Auth
  const signIn = async (
    email: string,
    password: string
  ): Promise<{ error?: string; role?: UserRole }> => {
    if (!isFirebaseConfigured()) {
      return { error: 'يرجى إعداد بيانات Firebase أولاً في ملف .env.local' };
    }

    console.log('[Auth] Starting signIn for email:', email.trim(), {
      projectId: auth.app.options.projectId,
      authDomain: auth.app.options.authDomain,
    });

    try {
      // 1. تسجيل الدخول في Firebase Authentication
      console.log('[Auth] Calling signInWithEmailAndPassword...');
      const credential = await signInWithEmailAndPassword(auth, email.trim(), password);
      const uid = credential.user.uid;
      console.log('[Auth] Firebase Auth SUCCESS! Logged in UID:', uid);

      // 2. قراءة مستند المستخدم من Firestore: users/{uid}
      console.log('[Auth] Fetching user document from Firestore (users/' + uid + ')...');
      const fetchRes = await fetchUserProfile(uid);
      const userProfile = fetchRes.profile;
      console.log('[Auth] Firestore userProfile result:', userProfile);

      if (fetchRes.error) {
        await firebaseSignOut(auth);
        setUser(null);
        setProfile(null);
        return {
          error: `[firestore/network-error] تعذر قراءة بيانات المستخدم من Firestore: ${fetchRes.error}`,
        };
      }

      // 3. التحقق من وجود المستند في Firestore
      if (!userProfile) {
        console.error('[Auth] Firestore document not found for UID:', uid);
        await firebaseSignOut(auth);
        setUser(null);
        setProfile(null);
        return {
          error: `[firestore/user-not-found] نجحت المصادقة في Firebase Auth (UID: ${uid})، ولكن لم يُعثر على مستند المستخدم في Firestore تحت: users/${uid}. يرجى إضافة المستند وتحديد الدور (role).`,
        };
      }

      // 4. التحقق من الدور الوظيفي (manager أو employee)
      if (userProfile.role !== 'manager' && userProfile.role !== 'employee') {
        console.error('[Auth] Invalid role:', userProfile.role);
        await firebaseSignOut(auth);
        setUser(null);
        setProfile(null);
        return {
          error: `[firestore/invalid-role] الدور الوظيفي غير صالح (role: "${userProfile.role || ''}"). يجب أن يكون manager أو employee في users/${uid}.`,
        };
      }

      // 5. التحقق من حالة تفعيل الحساب
      if (userProfile.is_active === false) {
        console.error('[Auth] Account is disabled');
        await firebaseSignOut(auth);
        setUser(null);
        setProfile(null);
        return {
          error: `[firestore/account-disabled] تم تعطيل هذا الحساب من قبل الإدارة (is_active: false) في users/${uid}.`,
        };
      }

      // نجاح تسجيل الدخول واعتماد الصلاحيات
      setUser(credential.user);
      setProfile(userProfile);
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem('mahamee_cached_profile', JSON.stringify(userProfile));
        } catch {}
      }
      return { role: userProfile.role };
    } catch (err: any) {
      console.error('[Firebase Auth Error Code]:', err?.code);
      console.error('[Firebase Auth Error Message]:', err?.message);
      console.error('[Firebase Auth Full Error]:', err);

      const code = err?.code || 'auth/unknown-error';
      const msg = err?.message || 'حدث خطأ غير متوقع أثناء تسجيل الدخول';

      return {
        error: `[${code}]: ${msg}`,
      };
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
        localStorage.removeItem('mahamee_cached_profile');
        window.location.href = '/login';
      }
    }
  };

  const roleStr = (profile?.role || '').toString().toLowerCase().trim();
  const isManager = Boolean(
    profile &&
    (roleStr === 'manager' || roleStr === 'admin' || roleStr.includes('مدير') || roleStr.includes('مسؤول'))
  );
  const isEmployee = Boolean(
    profile &&
    (roleStr === 'employee' || roleStr.includes('موظف'))
  );

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
