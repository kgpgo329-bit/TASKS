'use client';

import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { NotificationDropdown } from '@/components/NotificationDropdown';

interface HeaderProps {
  onOpenMobileMenu?: () => void;
  onOpenNewTaskModal?: () => void;
  onOpenAddEmployeeModal?: () => void;
  onSelectTask?: (taskId: string) => void;
  searchQuery?: string;
  onSearchChange?: (val: string) => void;
  title?: string;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenMobileMenu,
  onOpenNewTaskModal,
  onOpenAddEmployeeModal,
  onSelectTask,
  searchQuery = '',
  onSearchChange,
  title,
}) => {
  const { profile, isManager } = useAuth();

  // الحصول على التاريخ الهجري / الميلادي الحالي
  const todayDate = new Intl.DateTimeFormat('ar-SA', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(new Date());

  return (
    <header className="fixed top-0 right-0 lg:right-72 left-0 h-20 bg-surface/90 backdrop-blur-xl z-20 shadow-[0_1px_8px_rgba(0,0,0,0.04)] px-4 lg:px-space-xl flex items-center justify-between transition-all">
      {/* الجانب الأيمن: زر فتح القائمة على الجوال وشريط البحث */}
      <div className="flex items-center gap-space-md flex-1 max-w-xl">
        {onOpenMobileMenu && (
          <button
            onClick={onOpenMobileMenu}
            className="lg:hidden p-2 rounded-xl text-on-surface-variant hover:bg-surface-container-low transition-colors"
            title="القائمة"
          >
            <span className="material-symbols-outlined text-[24px]">menu</span>
          </button>
        )}

        {onSearchChange ? (
          <div className="relative w-full">
            <span className="material-symbols-outlined absolute right-space-sm top-1/2 -translate-y-1/2 text-outline text-[20px]">
              search
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="ابحث عن مهمة، موعد، أو تصنيف..."
              className="w-full bg-surface-container-lowest text-on-surface placeholder:text-outline pr-10 pl-space-md py-space-xs rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-secondary/30 transition-all shadow-[0_1px_2px_rgba(0,0,0,0.03)] border border-transparent focus:border-secondary"
            />
          </div>
        ) : (
          title && <h1 className="text-lg font-bold text-primary truncate">{title}</h1>
        )}
      </div>

      {/* الجانب الأيسر: التاريخ والأزرار التفاعلية */}
      <div className="flex items-center gap-2 lg:gap-3">
        {/* شارة التاريخ */}
        <div className="hidden xl:flex items-center gap-space-xs text-on-surface-variant text-xs font-medium bg-surface-container-low px-space-md py-space-xs rounded-full">
          <span className="material-symbols-outlined text-[18px] text-secondary">calendar_today</span>
          <span>{todayDate}</span>
        </div>

        {/* قائمة الإشعارات اللحظية */}
        <NotificationDropdown onSelectTask={onSelectTask} />

        {/* زر إضافة موظف جديد للمديرة */}
        {onOpenAddEmployeeModal && isManager && (
          <button
            type="button"
            onClick={onOpenAddEmployeeModal}
            className="inline-flex items-center gap-space-xs px-3.5 lg:px-space-md py-2 bg-secondary text-white rounded-xl text-sm font-semibold shadow-sm hover:bg-secondary/90 transition-all transform active:scale-95"
            title="إضافة موظف جديد"
          >
            <span className="material-symbols-outlined text-[20px]">person_add</span>
            <span className="hidden sm:inline">إضافة موظف</span>
          </button>
        )}

        {/* زر إضافة مهمة جديدة */}
        {onOpenNewTaskModal && (
          <button
            type="button"
            onClick={onOpenNewTaskModal}
            className="inline-flex items-center gap-space-xs px-3.5 lg:px-space-md py-2 bg-primary-container text-on-primary rounded-xl text-sm font-semibold shadow-sm hover:bg-secondary transition-all transform active:scale-95"
          >
            <span className="material-symbols-outlined text-[20px]">add</span>
            <span className="hidden sm:inline">مهمة جديدة</span>
          </button>
        )}

        {/* الصورة الشخصية الصغيرة */}
        <div className="flex items-center gap-space-xs pr-space-xs">
          <div className="relative w-9 h-9 rounded-full bg-primary text-on-primary flex items-center justify-center font-bold text-sm shadow-sm ring-2 ring-surface">
            {profile?.name ? profile.name.charAt(0).toUpperCase() : 'م'}
            <span className="absolute bottom-0 left-0 w-2.5 h-2.5 rounded-full bg-secondary ring-2 ring-surface"></span>
          </div>
        </div>
      </div>
    </header>
  );
};
