'use client';

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import {
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  User,
} from 'firebase/auth';
import { auth, isFirebaseConfigured } from '@/lib/firebase/config';
import { getProfile, setProfile as saveProfileToDb } from '@/lib/firebase/db';
import { Profile, UserRole } from '@/lib/firebase/types';

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  role: UserRole | null;
  isManager: boolean;
  isEmployee: boolean;
  isDemoMode: boolean;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error?: string }>;
  signInAsDemo: (role: UserRole) => void;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchUserProfile = async (u: User): Promise<Profile | null> => {
    try {
      let p = await getProfile(u.uid);
      if (!p) {
        // إذا كان المستخدم جديداً ومسجلاً للتو
        const isManagerEmail =
          u.email?.includes('admin') ||
          u.email?.includes('manager') ||
          u.email === 'manager@mahamee.local';

        p = {
          id: u.uid,
          email: u.email || '',
          name: u.displayName || u.email?.split('@')[0] || 'مستخدم',
          role: isManagerEmail ? 'manager' : 'employee',
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        await saveProfileToDb(p);
      }
      return p;
    } catch (err) {
      console.error('Error fetching user profile:', err);
      return null;
    }
  };

  const refreshProfile = async () => {
    if (!user) return;
    const p = await fetchUserProfile(user);
    if (p) setProfile(p);
  };

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedDemo = localStorage.getItem('mahamee_demo_user');
      if (savedDemo) {
        try {
          const { user: u, profile: p } = JSON.parse(savedDemo);
          setUser(u);
          setProfile(p);
          setLoading(false);
          return;
        } catch (e) {}
      }
    }

    if (!isFirebaseConfigured()) {
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);
        const p = await fetchUserProfile(firebaseUser);
        if (p) {
          if (!p.is_active) {
            await firebaseSignOut(auth);
            setUser(null);
            setProfile(null);
          } else {
            setProfile(p);
          }
        }
      } else {
        // تحقق إن لم نكن في وضع التجربة
        const savedDemo = typeof window !== 'undefined' ? localStorage.getItem('mahamee_demo_user') : null;
        if (!savedDemo) {
          setUser(null);
          setProfile(null);
        }
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const signIn = async (email: string, password: string): Promise<{ error?: string }> => {
    if (!isFirebaseConfigured()) {
      return { error: 'يرجى إعداد بيانات Firebase أولاً في ملف .env.local' };
    }

    try {
      // مسح أي وضع تجريبي سابق
      if (typeof window !== 'undefined') {
        localStorage.removeItem('mahamee_demo_user');
      }

      const credential = await signInWithEmailAndPassword(auth, email.trim(), password);
      const p = await fetchUserProfile(credential.user);

      if (!p) {
        return { error: 'تعذر تحميل بيانات المستخدم. يرجى مراجعة إدارة النظام' };
      }

      if (!p.is_active) {
        await firebaseSignOut(auth);
        setUser(null);
        setProfile(null);
        return { error: 'تم تعطيل هذا الحساب من قبل الإدارة. يرجى مراجعة المديرة' };
      }

      setUser(credential.user);
      setProfile(p);
      return {};
    } catch (err: any) {
      if (
        err.code === 'auth/invalid-credential' ||
        err.code === 'auth/user-not-found' ||
        err.code === 'auth/wrong-password'
      ) {
        return { error: 'البريد الإلكتروني أو كلمة المرور غير صحيحة' };
      }
      if (err.code === 'auth/too-many-requests') {
        return { error: 'تم إدخال كلمة المرور بشكل خاطئ عدة مرات. يرجى الانتظار قليلاً' };
      }
      return { error: err.message || 'حدث خطأ أثناء تسجيل الدخول' };
    }
  };

  const signInAsDemo = (role: UserRole) => {
    const demoProfile: Profile =
      role === 'manager'
        ? {
            id: 'demo-manager-id',
            name: 'نهى العتيبي',
            email: 'noha@mahamee.local',
            role: 'manager',
            is_active: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }
        : {
            id: 'demo-employee-id',
            name: 'سارة الشمري',
            email: 'sara@mahamee.local',
            role: 'employee',
            is_active: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };

    const demoUser = {
      uid: demoProfile.id,
      email: demoProfile.email,
      displayName: demoProfile.name,
    } as unknown as User;

    setUser(demoUser);
    setProfile(demoProfile);
    if (typeof window !== 'undefined') {
      localStorage.setItem('mahamee_demo_user', JSON.stringify({ user: demoUser, profile: demoProfile }));
    }
  };

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
        window.location.href = '/login';
      }
    }
  };

  const isManager = profile?.role === 'manager';
  const isEmployee = profile?.role === 'employee';
  const isDemoMode =
    !isFirebaseConfigured() ||
    user?.uid.startsWith('demo-') === true ||
    (typeof window !== 'undefined' && Boolean(localStorage.getItem('mahamee_demo_user')));

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        role: profile?.role || null,
        isManager,
        isEmployee,
        isDemoMode,
        loading,
        signIn,
        signInAsDemo,
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
