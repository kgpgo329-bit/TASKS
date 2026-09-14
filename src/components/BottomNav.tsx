'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

export const BottomNav: React.FC = () => {
  const pathname = usePathname();
  const { user, profile, isManager } = useAuth();

  // عدم العرض إذا لم يسجل الدخول أو في صفحة تسجيل الدخول
  if (!user || !profile || pathname === '/login') {
    return null;
  }

  const navItems = isManager
    ? [
        {
          label: 'لوحة التحكم',
          path: '/dashboard',
          icon: 'grid_view',
        },
        {
          label: 'جميع المهام',
          path: '/all-tasks',
          icon: 'checklist',
        },
        {
          label: 'مهامي',
          path: '/my-tasks',
          icon: 'task_alt',
        },
        {
          label: 'إدارة الموظفات',
          path: '/employees',
          icon: 'group',
        },
      ]
    : [
        {
          label: 'مهامي الخاصة',
          path: '/my-tasks',
          icon: 'task_alt',
        },
      ];

  return (
    <nav
      aria-label="شريط التنقل السريع للجوال"
      className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-surface/95 backdrop-blur-xl border-t border-surface-variant/40 shadow-[0_-4px_20px_rgba(0,0,0,0.06)] px-2 py-1.5 flex items-center justify-around"
    >
      {navItems.map((item) => {
        const isActive = pathname === item.path;
        return (
          <Link
            key={item.path}
            href={item.path}
            className={`flex flex-col items-center justify-center py-1 px-3 rounded-2xl transition-all duration-200 active:scale-95 ${
              isActive
                ? 'text-primary font-bold'
                : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            <div
              className={`w-10 h-7 flex items-center justify-center rounded-full transition-all ${
                isActive ? 'bg-primary-container text-on-primary shadow-xs' : ''
              }`}
            >
              <span className="material-symbols-outlined text-[22px]">{item.icon}</span>
            </div>
            <span className="text-[10px] mt-0.5 tracking-tight font-medium">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
};
