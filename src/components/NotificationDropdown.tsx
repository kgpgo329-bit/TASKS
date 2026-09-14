'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import {
  subscribeToUserNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
} from '@/lib/firebase/db';
import { AppNotification } from '@/lib/firebase/types';

interface NotificationDropdownProps {
  onSelectTask?: (taskId: string) => void;
}

export const NotificationDropdown: React.FC<NotificationDropdownProps> = ({ onSelectTask }) => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const userId = user?.uid || (user as any)?.id;

  // الاستماع اللحظي للإشعارات مع حماية إلغاء التثبيت
  useEffect(() => {
    if (!userId) return;

    let isMounted = true;
    const unsubscribe = subscribeToUserNotifications(userId, (notifs) => {
      if (isMounted) {
        setNotifications(notifs);
      }
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [userId]);

  // إغلاق القائمة عند النقر خارجها
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  const handleNotificationClick = async (notif: AppNotification) => {
    if (!notif.is_read) {
      await markNotificationAsRead(notif.id);
    }
    setIsOpen(false);
    if (onSelectTask && notif.task_id) {
      onSelectTask(notif.task_id);
    }
  };

  const handleMarkAllRead = async () => {
    if (!userId) return;
    await markAllNotificationsAsRead(userId);
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'new_task':
        return { icon: 'assignment', color: 'text-primary bg-primary/10' };
      case 'new_message':
        return { icon: 'chat', color: 'text-secondary bg-secondary/10' };
      case 'attachment_added':
        return { icon: 'attach_file', color: 'text-amber-600 bg-amber-500/10' };
      case 'status_changed':
        return { icon: 'sync', color: 'text-emerald-600 bg-emerald-500/10' };
      default:
        return { icon: 'notifications', color: 'text-primary bg-surface-container' };
    }
  };

  const formatNotificationTime = (isoString: string) => {
    try {
      const date = new Date(isoString);
      return new Intl.DateTimeFormat('ar-SA', {
        hour: 'numeric',
        minute: 'numeric',
        hour12: true,
        day: 'numeric',
        month: 'short',
      }).format(date);
    } catch {
      return '';
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* زر أيقونة الإشعارات */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-xl text-on-surface-variant hover:text-primary hover:bg-surface-container-low transition-colors"
        title="الإشعارات"
      >
        <span className="material-symbols-outlined text-[22px]">notifications</span>
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 min-w-[18px] h-[18px] px-1 bg-error text-white rounded-full text-[10px] font-bold flex items-center justify-center shadow-sm animate-pulse">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* القائمة المنسدلة */}
      {isOpen && (
        <div className="absolute left-0 sm:left-auto sm:right-0 mt-2 w-80 sm:w-96 max-w-[90vw] bg-surface-container-lowest rounded-2xl shadow-xl border border-surface-variant/50 overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-150">
          {/* رأس القائمة */}
          <div className="p-3.5 bg-surface-container-low border-b border-surface-variant/40 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-[20px]">notifications</span>
              <span className="font-bold text-sm text-primary">الإشعارات</span>
              {unreadCount > 0 && (
                <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-error-container text-on-error-container">
                  {unreadCount} غير مقروء
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllRead}
                className="text-[11px] font-semibold text-secondary hover:underline"
              >
                تحديد الكل كمقروء
              </button>
            )}
          </div>

          {/* محتوى الإشعارات */}
          <div className="max-h-[360px] overflow-y-auto divide-y divide-surface-variant/20">
            {notifications.length === 0 ? (
              <div className="py-10 px-4 text-center flex flex-col items-center justify-center text-outline">
                <span className="material-symbols-outlined text-[36px] mb-2 opacity-40">
                  notifications_off
                </span>
                <p className="text-xs">لا توجد إشعارات حالياً</p>
              </div>
            ) : (
              notifications.map((notif) => {
                const iconInfo = getNotificationIcon(notif.type);
                return (
                  <button
                    key={notif.id}
                    type="button"
                    onClick={() => handleNotificationClick(notif)}
                    className={`w-full text-right p-3 transition-colors flex items-start gap-3 hover:bg-surface-container-low/70 ${
                      !notif.is_read ? 'bg-secondary-container/15' : 'bg-surface-container-lowest'
                    }`}
                  >
                    <div
                      className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${iconInfo.color}`}
                    >
                      <span className="material-symbols-outlined text-[18px]">{iconInfo.icon}</span>
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1 mb-0.5">
                        <span
                          className={`text-xs truncate ${
                            !notif.is_read ? 'font-bold text-primary' : 'font-semibold text-on-surface'
                          }`}
                        >
                          {notif.title}
                        </span>
                        {!notif.is_read && (
                          <span className="w-2 h-2 rounded-full bg-secondary flex-shrink-0"></span>
                        )}
                      </div>
                      <p className="text-[11px] text-on-surface-variant line-clamp-2 leading-relaxed">
                        {notif.message}
                      </p>
                      <span className="text-[10px] text-outline mt-1 block">
                        {formatNotificationTime(notif.created_at)}
                      </span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};
