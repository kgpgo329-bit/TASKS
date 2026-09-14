'use client';

import React from 'react';
import { Task, TaskStatus } from '@/lib/firebase/types';
import { useAuth } from '@/contexts/AuthContext';

interface TaskCardProps {
  task: Task;
  showAssignee?: boolean;
  onStatusChange: (taskId: string, newStatus: TaskStatus) => Promise<void>;
  onEdit: (task: Task) => void;
  onDelete: (taskId: string) => void;
  onOpenDetails?: (task: Task) => void;
}

export const TaskCard: React.FC<TaskCardProps> = ({
  task,
  showAssignee = false,
  onStatusChange,
  onEdit,
  onDelete,
  onOpenDetails,
}) => {
  const { isManager } = useAuth();
  const isCompleted = task.status === 'completed';

  // حساب ألوان شارة الأولوية
  const priorityConfig = {
    urgent: { label: 'عاجلة جداً', bg: 'bg-error-container text-on-error-container border-error/20' },
    high: { label: 'عالية', bg: 'bg-amber-100 text-amber-900 border-amber-300' },
    medium: { label: 'متوسطة', bg: 'bg-surface-container text-on-surface-variant border-surface-variant' },
    low: { label: 'منخفضة', bg: 'bg-surface-container-low text-outline border-outline-variant/40' },
  }[task.priority] || { label: 'عادية', bg: 'bg-surface-container text-on-surface-variant border-surface-variant' };

  // تنسيق حالة المهمة
  const statusConfig: Record<TaskStatus, { label: string; bg: string; icon: string }> = {
    not_started: { label: 'جديدة', bg: 'bg-surface-container text-on-surface-variant', icon: 'pending' },
    in_progress: { label: 'قيد التنفيذ', bg: 'bg-amber-100 text-amber-900', icon: 'timelapse' },
    under_review: { label: 'بانتظار المراجعة', bg: 'bg-blue-100 text-blue-900', icon: 'fact_check' },
    completed: { label: 'مكتملة', bg: 'bg-secondary-container text-on-secondary-container', icon: 'check_circle' },
    cancelled: { label: 'ملغاة', bg: 'bg-error-container text-on-error-container', icon: 'cancel' },
  };

  const currentStatusInfo = statusConfig[task.status] || statusConfig.not_started;

  // التبديل السريع للحالة بالضغط على زر الاختيار
  const handleToggleCheck = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isCompleted) {
      onStatusChange(task.id, 'not_started');
    } else {
      onStatusChange(task.id, 'completed');
    }
  };

  const handleCardClick = () => {
    if (onOpenDetails) {
      onOpenDetails(task);
    }
  };

  return (
    <div
      onClick={handleCardClick}
      className={`group relative p-4 sm:p-space-md rounded-2xl border transition-all duration-200 cursor-pointer ${
        isCompleted
          ? 'bg-[#F4FAF6] border-secondary/20 shadow-none opacity-90'
          : 'bg-surface-container-lowest border-surface-variant/40 shadow-sm hover:shadow-md hover:border-secondary/40'
      }`}
    >
      <div className="flex items-start justify-between gap-3 sm:gap-space-md">
        {/* الجانب الأيمن: مربع التحديد السريع والعنوان */}
        <div className="flex items-start gap-3 sm:gap-space-sm flex-1 min-w-0">
          {/* مربع التحديد التفاعلي */}
          <button
            type="button"
            onClick={handleToggleCheck}
            className={`mt-1 w-6 h-6 rounded-lg flex items-center justify-center transition-all flex-shrink-0 ${
              isCompleted
                ? 'bg-secondary text-white shadow-sm ring-2 ring-secondary/30'
                : 'border-2 border-outline/40 hover:border-secondary hover:bg-surface-container-low'
            }`}
            title={isCompleted ? 'تحديد كـ "جديدة"' : 'تحديد كـ "مكتملة"'}
          >
            {isCompleted && (
              <span className="material-symbols-outlined text-[18px] font-bold leading-none">check</span>
            )}
          </button>

          <div className="flex flex-col gap-1 flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3
                className={`font-bold text-base transition-colors truncate ${
                  isCompleted ? 'line-through text-outline' : 'text-primary group-hover:text-secondary'
                }`}
              >
                {task.title}
              </h3>

              {/* شارة الأولوية */}
              <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold border ${priorityConfig.bg}`}>
                {priorityConfig.label}
              </span>

              {/* تصنيف المهمة */}
              {task.category && (
                <span className="px-2 py-0.5 rounded-full text-[11px] bg-surface-container-low text-on-surface-variant border border-outline-variant/30">
                  {task.category}
                </span>
              )}

              {/* 🔒 علامة القفل للموظفة */}
              {!isManager && (
                <span
                  className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200"
                  title="المهمة مرسلة — محتوى المهمة محمي من التعديل"
                >
                  <span className="material-symbols-outlined text-[13px]">lock</span>
                  <span>مقفل</span>
                </span>
              )}

              {/* شارة المرفقات إن وجدت */}
              {task.attachments && task.attachments.length > 0 && (
                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-surface-container text-on-surface-variant">
                  <span className="material-symbols-outlined text-[13px] text-secondary">attachment</span>
                  <span>{task.attachments.length}</span>
                </span>
              )}

              {/* شارة ملاحظة المسؤولة */}
              {task.manager_note && (
                <span
                  className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-primary/10 text-primary"
                  title="تحتوي على توجيه خاص من المسؤولة"
                >
                  <span className="material-symbols-outlined text-[13px] text-secondary">note_alt</span>
                  <span>توجيه</span>
                </span>
              )}
            </div>

            {/* الوصف إن وجد */}
            {task.description && (
              <p className={`text-xs mt-1 line-clamp-2 leading-relaxed ${isCompleted ? 'text-outline/70' : 'text-on-surface-variant'}`}>
                {task.description}
              </p>
            )}

            {/* تفاصيل إضافية: الموظفة والتاريخ */}
            <div className="flex items-center gap-3 sm:gap-4 mt-2 text-xs text-outline flex-wrap">
              {/* الموظفة المكلفة */}
              {showAssignee && (
                <div className="flex items-center gap-1 text-primary font-medium bg-surface-container-low px-2 py-0.5 rounded-md">
                  <span className="material-symbols-outlined text-[16px] text-secondary">person</span>
                  <span>المكلفة: {task.profiles?.name || 'غير محدد'}</span>
                </div>
              )}

              {/* تاريخ الاستحقاق */}
              {task.due_date && (
                <div className="flex items-center gap-1">
                  <span className="material-symbols-outlined text-[16px]">event</span>
                  <span>الاستحقاق: {task.due_date}</span>
                </div>
              )}

              {/* زر تفاصيل المهمة السريع */}
              <span className="text-[11px] font-semibold text-secondary flex items-center gap-0.5 mr-auto">
                <span>عرض التفاصيل والمحادثة</span>
                <span className="material-symbols-outlined text-[15px]">arrow_back</span>
              </span>
            </div>
          </div>
        </div>

        {/* الجانب الأيسر: قائمة تغيير الحالة السريعة وأزرار التعديل والحذف للمديرة */}
        <div className="flex items-center gap-1.5 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
          {/* محدد الحالة السريع */}
          <select
            value={task.status}
            onChange={(e) => onStatusChange(task.id, e.target.value as TaskStatus)}
            className={`text-xs font-bold px-2.5 py-1 rounded-xl border border-transparent focus:outline-none focus:ring-1 focus:ring-secondary cursor-pointer ${currentStatusInfo.bg}`}
          >
            <option value="not_started">جديدة</option>
            <option value="in_progress">قيد التنفيذ</option>
            <option value="under_review">بانتظار المراجعة</option>
            <option value="completed">مكتملة</option>
            {isManager && <option value="cancelled">ملغاة</option>}
          </select>

          {/* زر التعديل للمسؤولة فقط */}
          {isManager && (
            <button
              type="button"
              onClick={() => onEdit(task)}
              className="p-1.5 text-on-surface-variant hover:text-primary hover:bg-surface-container rounded-xl transition-colors"
              title="تعديل المهمة"
            >
              <span className="material-symbols-outlined text-[18px]">edit</span>
            </button>
          )}

          {/* زر الحذف للمسؤولة فقط */}
          {isManager && (
            <button
              type="button"
              onClick={() => onDelete(task.id)}
              className="p-1.5 text-outline hover:text-error hover:bg-error-container/30 rounded-xl transition-colors"
              title="حذف المهمة"
            >
              <span className="material-symbols-outlined text-[18px]">delete</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

