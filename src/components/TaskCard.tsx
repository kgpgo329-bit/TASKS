'use client';

import React from 'react';
import { Task, TaskStatus } from '@/lib/firebase/types';

interface TaskCardProps {
  task: Task;
  showAssignee?: boolean;
  onStatusChange: (taskId: string, newStatus: TaskStatus) => Promise<void>;
  onEdit: (task: Task) => void;
  onDelete: (taskId: string) => void;
}

export const TaskCard: React.FC<TaskCardProps> = ({
  task,
  showAssignee = false,
  onStatusChange,
  onEdit,
  onDelete,
}) => {
  const isCompleted = task.status === 'completed';
  const isInProgress = task.status === 'in_progress';

  // حساب ألوان شارة الأولوية
  const priorityConfig = {
    urgent: { label: 'عاجلة جداً', bg: 'bg-error-container text-on-error-container border-error/20' },
    high: { label: 'عالية', bg: 'bg-amber-100 text-amber-900 border-amber-300' },
    medium: { label: 'متوسطة', bg: 'bg-surface-container text-on-surface-variant border-surface-variant' },
    low: { label: 'منخفضة', bg: 'bg-surface-container-low text-outline border-outline-variant/40' },
  }[task.priority] || { label: 'عادية', bg: 'bg-surface-container text-on-surface-variant border-surface-variant' };

  // تنسيق حالة المهمة
  const statusConfig = {
    not_started: { label: 'لم يتم', bg: 'bg-surface-container text-on-surface-variant', icon: 'pending' },
    in_progress: { label: 'قيد التنفيذ', bg: 'bg-amber-100 text-amber-800', icon: 'timelapse' },
    completed: { label: 'تم الإنجاز', bg: 'bg-secondary-container text-on-secondary-container', icon: 'check_circle' },
  }[task.status];

  // التبديل السريع للحالة بالضغط على زر الاختيار
  const handleToggleCheck = () => {
    if (isCompleted) {
      onStatusChange(task.id, 'not_started');
    } else {
      onStatusChange(task.id, 'completed');
    }
  };

  return (
    <div
      className={`group relative p-space-md rounded-2xl border transition-all duration-200 ${
        isCompleted
          ? 'bg-[#F4FAF6] border-secondary/20 shadow-none opacity-90'
          : 'bg-surface-container-lowest border-surface-variant/40 shadow-sm hover:shadow-md hover:border-secondary/30'
      }`}
    >
      <div className="flex items-start justify-between gap-space-md">
        {/* الجانب الأيمن: مربع التحديد السريع والعنوان */}
        <div className="flex items-start gap-space-sm flex-1">
          {/* مربع التحديد التفاعلي الكبير */}
          <button
            type="button"
            onClick={handleToggleCheck}
            className={`mt-1 w-6 h-6 rounded-lg flex items-center justify-center transition-all ${
              isCompleted
                ? 'bg-secondary text-white shadow-sm ring-2 ring-secondary/30'
                : 'border-2 border-outline/40 hover:border-secondary hover:bg-surface-container-low'
            }`}
            title={isCompleted ? 'تحديد كـ "لم يتم"' : 'تحديد كـ "تم"'}
          >
            {isCompleted && (
              <span className="material-symbols-outlined text-[18px] font-bold leading-none">check</span>
            )}
          </button>

          <div className="flex flex-col gap-1 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h3
                className={`font-semibold text-base transition-colors ${
                  isCompleted ? 'line-through text-outline' : 'text-primary'
                }`}
              >
                {task.title}
              </h3>

              {/* شارة الأولوية */}
              <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium border ${priorityConfig.bg}`}>
                {priorityConfig.label}
              </span>

              {/* تصنيف المهمة */}
              {task.category && (
                <span className="px-2 py-0.5 rounded-full text-[11px] bg-surface-container-low text-on-surface-variant border border-outline-variant/30">
                  {task.category}
                </span>
              )}
            </div>

            {/* الوصف إن وجد */}
            {task.description && (
              <p className={`text-xs mt-1 line-clamp-2 ${isCompleted ? 'text-outline/70' : 'text-on-surface-variant'}`}>
                {task.description}
              </p>
            )}

            {/* تفاصيل إضافية: الموظفة والتاريخ */}
            <div className="flex items-center gap-4 mt-2 text-xs text-outline flex-wrap">
              {/* الموظفة المكلفة (يظهر للمديرة أو في صفحة جميع المهام) */}
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
            </div>
          </div>
        </div>

        {/* الجانب الأيسر: قائمة تغيير الحالة السريعة وأزرار التعديل والحذف */}
        <div className="flex items-center gap-2">
          {/* محدد الحالة السريع */}
          <select
            value={task.status}
            onChange={(e) => onStatusChange(task.id, e.target.value as TaskStatus)}
            className={`text-xs font-semibold px-2.5 py-1 rounded-xl border border-transparent focus:outline-none focus:ring-1 focus:ring-secondary cursor-pointer ${statusConfig.bg}`}
          >
            <option value="not_started">لم يتم</option>
            <option value="in_progress">قيد التنفيذ</option>
            <option value="completed">تم الإنجاز</option>
          </select>

          {/* زر التعديل */}
          <button
            type="button"
            onClick={() => onEdit(task)}
            className="p-1.5 text-on-surface-variant hover:text-primary hover:bg-surface-container rounded-lg transition-colors"
            title="تعديل المهمة"
          >
            <span className="material-symbols-outlined text-[18px]">edit</span>
          </button>

          {/* زر الحذف */}
          <button
            type="button"
            onClick={() => onDelete(task.id)}
            className="p-1.5 text-outline hover:text-error hover:bg-error-container/30 rounded-lg transition-colors"
            title="حذف المهمة"
          >
            <span className="material-symbols-outlined text-[18px]">delete</span>
          </button>
        </div>
      </div>
    </div>
  );
};
