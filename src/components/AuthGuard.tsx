'use client';

import React, { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { UserRole } from '@/lib/firebase/types';
import { Logo } from '@/components/Logo';

interface AuthGuardProps {
  children: React.ReactNode;
  requireRole?: UserRole;
}

export const AuthGuard: React.FC<AuthGuardProps> = ({ children, requireRole }) => {
  const { user, profile, loading, isManager } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading) {
      if (!user) {
        router.replace('/login');
      } else if (requireRole === 'manager' && profile && !isManager) {
        // إذا حاولت موظفة دخول صفحة مخصصة للمديرة بعد التأكد من جلب بيانات الملف
        router.replace('/my-tasks');
      }
    }
  }, [user, profile, loading, requireRole, isManager, router]);

  // ننتظر حتى تكتمل قراءة بيانات المستخدم وصلاحياته تماماً
  if (loading || (user && !profile)) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4">
        <Logo size={56} showText={true} />
        <div className="flex items-center gap-2 text-primary font-medium">
          <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
          <span>جاري التحقق من الصلاحيات...</span>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  if (requireRole === 'manager' && !isManager) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-center">
        <div className="max-w-md bg-surface-container-lowest p-8 rounded-2xl shadow-sm border border-outline-variant/30 flex flex-col items-center gap-4">
          <span className="material-symbols-outlined text-error text-5xl">lock</span>
          <h2 className="text-xl font-bold text-primary">صفحة مخصصة لإدارة النظام</h2>
          <p className="text-on-surface-variant text-sm">
            ليس لديكِ صلاحية للوصول إلى هذه الصفحة، حيث أنها متاحة للمديرة فقط.
          </p>
          <button
            onClick={() => router.replace('/my-tasks')}
            className="mt-2 px-6 py-2.5 bg-primary text-white rounded-xl font-medium hover:bg-secondary transition-colors"
          >
            الانتقال إلى مهامي الخاصة
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};
