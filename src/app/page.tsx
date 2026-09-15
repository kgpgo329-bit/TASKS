/**
 * © 2026 Jory Al-Thuwaini — Mahami Platform
 * منصة مهامي — جميع الحقوق محفوظة
 */

'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Logo } from '@/components/Logo';

export default function HomePage() {
  const { user, profile, loading, isManager } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      if (!user) {
        router.replace('/login');
      } else if (isManager) {
        router.replace('/dashboard');
      } else {
        router.replace('/my-tasks');
      }
    }
  }, [user, profile, loading, isManager, router]);

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4">
      <Logo size={64} showText={true} />
      <div className="flex items-center gap-2 text-primary font-medium text-sm">
        <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
        <span>جاري تهيئة النظام...</span>
      </div>
    </div>
  );
}
