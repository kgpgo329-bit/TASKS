'use client';

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase, isSupabaseConfigured } from '@/lib/supabase/client';
import { Profile, UserRole } from '@/lib/supabase/types';
import { User } from '@supabase/supabase-js';

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  role: UserRole | null;
  isManager: boolean;
  isEmployee: boolean;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (userId: string): Promise<Profile | null> => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error || !data) {
        console.error('Error fetching profile:', error);
        return null;
      }
      return data as Profile;
    } catch (err) {
      console.error('Exception fetching profile:', err);
      return null;
    }
  };

  const refreshProfile = async () => {
    if (!user) return;
    const p = await fetchProfile(user.id);
    if (p) {
      setProfile(p);
    }
  };

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setLoading(false);
      return;
    }

    // التحقق الأولي من الجلسة الحالية
    const initAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          setUser(session.user);
          const p = await fetchProfile(session.user.id);
          if (p) {
            if (!p.is_active) {
              await supabase.auth.signOut();
              setUser(null);
              setProfile(null);
            } else {
              setProfile(p);
            }
          }
        }
      } catch (err) {
        console.error('Auth initialization error:', err);
      } finally {
        setLoading(false);
      }
    };

    initAuth();

    // الاستماع للتغيرات في حالة المصادقة
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        setUser(session.user);
        const p = await fetchProfile(session.user.id);
        if (p) {
          if (!p.is_active) {
            await supabase.auth.signOut();
            setUser(null);
            setProfile(null);
          } else {
            setProfile(p);
          }
        }
      } else {
        setUser(null);
        setProfile(null);
      }
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string): Promise<{ error?: string }> => {
    if (!isSupabaseConfigured()) {
      return { error: 'يرجى إعداد متغيرات البيئة الخاصة بـ Supabase أولاً (NEXT_PUBLIC_SUPABASE_URL و NEXT_PUBLIC_SUPABASE_ANON_KEY)' };
    }

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        if (error.message.includes('Invalid login credentials')) {
          return { error: 'البريد الإلكتروني أو كلمة المرور غير صحيحة' };
        }
        return { error: error.message };
      }

      if (!data.user) {
        return { error: 'تعذر تسجيل الدخول، يرجى المحاولة لاحقاً' };
      }

      // جلب الملف الشخصي والتحقق من حالة الحساب
      const p = await fetchProfile(data.user.id);
      if (!p) {
        return { error: 'تعذر تحميل بيانات المستخدم. يرجى مراجعة إدارة النظام' };
      }

      if (!p.is_active) {
        await supabase.auth.signOut();
        return { error: 'تم تعطيل هذا الحساب من قبل الإدارة. يرجى مراجعة المديرة' };
      }

      setUser(data.user);
      setProfile(p);
      return {};
    } catch (err: any) {
      return { error: err.message || 'حدث خطأ أثناء تسجيل الدخول' };
    }
  };

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.error('Sign out error:', err);
    } finally {
      setUser(null);
      setProfile(null);
      if (typeof window !== 'undefined') {
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
