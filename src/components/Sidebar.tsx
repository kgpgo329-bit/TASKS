'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Logo } from '@/components/Logo';

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
  myTasksCount?: number;
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpen = false, onClose, myTasksCount }) => {
  const pathname = usePathname();
  const router = useRouter();
  const { profile, isManager, signOut } = useAuth();

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
          label: 'مهامي الخاصة بي',
          path: '/my-tasks',
          icon: 'task_alt',
          badge: myTasksCount !== undefined ? myTasksCount : null,
        },
        {
          label: 'إدارة الموظفات',
          path: '/employees',
          icon: 'group',
          managerOnly: true,
        },
      ]
    : [
        {
          label: 'مهامي الخاصة بي',
          path: '/my-tasks',
          icon: 'task_alt',
          badge: myTasksCount !== undefined ? myTasksCount : null,
        },
      ];

  const sidebarContent = (
    <div className="h-full flex flex-col justify-between bg-surface-container-lowest border-l border-surface-variant/40 shadow-sm">
      <div className="flex flex-col">
        {/* رأس القائمة الجانبية مع الشعار */}
        <div className="p-space-lg flex items-center justify-between border-b border-surface-variant/30">
          <a href="/dashboard" className="cursor-pointer hover:opacity-90 transition-opacity">
            <Logo size={42} showText={true} />
          </a>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="lg:hidden p-1.5 rounded-lg text-on-surface-variant hover:bg-surface-container-low transition-colors"
            >
              <span className="material-symbols-outlined text-[22px]">close</span>
            </button>
          )}
        </div>

        {/* عناصر التنقل */}
        <div className="px-space-md py-space-md">
          <div className="text-xs font-semibold text-outline mb-2 px-space-xs uppercase tracking-wider">
            {isManager ? 'إدارة النظام' : 'مساحة العمل'}
          </div>
          <nav className="flex flex-col gap-space-xxs">
            {navItems.map((item) => {
              const isActive = pathname === item.path;
              return (
                <a
                  key={item.path}
                  href={item.path}
                  onClick={(e) => {
                    if (pathname === item.path) {
                      e.preventDefault();
                      if (onClose) onClose();
                      return;
                    }
                    if (onClose) onClose();
                    window.location.href = item.path;
                  }}
                  className={`flex items-center justify-between px-space-md py-space-sm rounded-xl font-medium transition-all duration-150 cursor-pointer ${
                    isActive
                      ? 'bg-primary-container text-on-primary shadow-sm'
                      : 'text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface'
                  }`}
                >
                  <div className="flex items-center gap-space-sm">
                    <span className="material-symbols-outlined text-[22px]">{item.icon}</span>
                    <span className="text-sm">{item.label}</span>
                  </div>
                  {item.badge !== null && item.badge !== undefined && (
                    <span
                      className={`px-space-xs py-0.5 rounded-full text-xs font-semibold ${
                        isActive
                          ? 'bg-secondary-container text-on-secondary-container'
                          : 'bg-surface-container text-on-surface-variant'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </a>
              );
            })}
          </nav>
        </div>
      </div>

      {/* أسفل القائمة: بيانات المستخدم وتسجيل الخروج */}
      <div className="p-space-md border-t border-surface-variant/30 flex flex-col gap-space-xs">
        <div className="p-space-sm rounded-xl bg-surface-container-low flex items-center gap-space-sm">
          <div className="relative flex-shrink-0 w-10 h-10 rounded-full bg-primary-container text-on-primary flex items-center justify-center font-bold text-base shadow-sm">
            {profile?.name ? profile.name.charAt(0).toUpperCase() : 'م'}
            <span className="absolute bottom-0 left-0 w-2.5 h-2.5 rounded-full bg-secondary ring-2 ring-surface-container-lowest"></span>
          </div>
          <div className="flex flex-col min-w-0 flex-1">
            <span className="text-sm font-semibold text-on-surface truncate">
              {profile?.name || 'مستخدم'}
            </span>
            <div className="flex items-center gap-1">
              <span
                className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
                  isManager
                    ? 'bg-secondary-container/60 text-secondary'
                    : 'bg-surface-container text-on-surface-variant'
                }`}
              >
                {isManager ? 'مديرة النظام' : 'موظفة'}
              </span>
            </div>
          </div>
        </div>

        <button
          onClick={() => signOut()}
          className="flex items-center justify-center gap-space-xs w-full py-2 px-space-sm rounded-xl text-error text-xs font-semibold hover:bg-error-container/20 transition-colors"
        >
          <span className="material-symbols-outlined text-[18px]">logout</span>
          <span>تسجيل الخروج</span>
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* القائمة الثابتة على شاشات سطح المكتب */}
      <aside className="hidden lg:block fixed top-0 right-0 bottom-0 w-72 z-30">
        {sidebarContent}
      </aside>

      {/* القائمة المنبثقة للجوال */}
      {isOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-sm transition-opacity"
            onClick={onClose}
          />
          <div className="relative w-72 max-w-[85vw] h-full z-10">
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
};
