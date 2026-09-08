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
      if (typeof window !== 'undefined') {
        const saved = localStorage.getItem('mahamee_demo_user');
        if (saved) {
          try {
            const { user: u, profile: p } = JSON.parse(saved);
            setUser(u);
            setProfile(p);
          } catch (e) {
            console.error('Error parsing demo user', e);
          }
        }
      }
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
      id: demoProfile.id,
      email: demoProfile.email,
      app_metadata: {},
      user_metadata: { name: demoProfile.name, role: demoProfile.role },
      aud: 'authenticated',
      created_at: demoProfile.created_at,
    } as unknown as User;

    setUser(demoUser);
    setProfile(demoProfile);
    if (typeof window !== 'undefined') {
      localStorage.setItem('mahamee_demo_user', JSON.stringify({ user: demoUser, profile: demoProfile }));
    }
  };

  const signOut = async () => {
    try {
      if (isSupabaseConfigured()) {
        await supabase.auth.signOut();
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
  const isDemoMode = !isSupabaseConfigured() || user?.id.startsWith('demo-') === true;

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
