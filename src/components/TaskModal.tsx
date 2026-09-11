'use client';

import React, { useState, useEffect } from 'react';
import { Task, TaskPriority, TaskStatus, Profile } from '@/lib/firebase/types';

interface TaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (taskData: {
    title: string;
    description: string;
    status: TaskStatus;
    priority: TaskPriority;
    due_date: string | null;
    category: string;
    user_id?: string;
  }) => Promise<void>;
  initialTask?: Task | null;
  employeesList?: Profile[];
  isManager?: boolean;
}

export const TaskModal: React.FC<TaskModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialTask,
  employeesList = [],
  isManager = false,
}) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<TaskStatus>('not_started');
  const [priority, setPriority] = useState<TaskPriority>('medium');
  const [dueDate, setDueDate] = useState('');
  const [category, setCategory] = useState('عام');
  const [assignedUserId, setAssignedUserId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (initialTask) {
      setTitle(initialTask.title);
      setDescription(initialTask.description || '');
      setStatus(initialTask.status);
      setPriority(initialTask.priority);
      setDueDate(initialTask.due_date || '');
      setCategory(initialTask.category || 'عام');
      setAssignedUserId(initialTask.user_id);
    } else {
      setTitle('');
      setDescription('');
      setStatus('not_started');
      setPriority('medium');
      setDueDate('');
      setCategory('عام');
      setAssignedUserId(employeesList[0]?.id || '');
    }
    setError('');
  }, [initialTask, isOpen, employeesList]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('يرجى إدخال عنوان المهمة');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await onSave({
        title: title.trim(),
        description: description.trim(),
        status,
        priority,
        due_date: dueDate || null,
        category,
        user_id: isManager && assignedUserId ? assignedUserId : undefined,
      });
      onClose();
    } catch (err: any) {
      setError(err.message || 'حدث خطأ أثناء حفظ المهمة');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-surface-container-lowest rounded-2xl w-full max-w-lg shadow-xl border border-outline-variant/30 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* رأس النافذة */}
        <div className="px-space-lg py-space-md bg-surface-container-low border-b border-surface-variant/40 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-[24px]">
              {initialTask ? 'edit_note' : 'add_task'}
            </span>
            <h2 className="font-bold text-primary text-base">
              {initialTask ? 'تعديل المهمة' : 'إضافة مهمة جديدة'}
            </h2>
          </div>
          <button
            onClick={onClose}
            type="button"
            className="text-on-surface-variant hover:text-on-surface p-1 rounded-lg hover:bg-surface-container transition-colors"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* نموذج الإدخال */}
        <form onSubmit={handleSubmit} className="p-space-lg flex flex-col gap-4">
          {error && (
            <div className="p-3 rounded-xl bg-error-container/30 text-on-error-container text-xs flex items-center gap-2 border border-error/20">
              <span className="material-symbols-outlined text-[18px] text-error">error</span>
              <span>{error}</span>
            </div>
          )}

          {/* العنوان */}
          <div>
            <label className="block text-xs font-semibold text-primary mb-1">
              عنوان المهمة <span className="text-error">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="مثال: إعداد التقرير الربعي للبرامج الدعوية"
              required
              className="w-full px-3.5 py-2.5 rounded-xl border border-surface-variant focus:border-secondary focus:ring-2 focus:ring-secondary/20 text-sm outline-none transition-all"
            />
          </div>

          {/* الوصف */}
          <div>
            <label className="block text-xs font-semibold text-primary mb-1">تفاصيل المهمة وملاحظات</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="أدخلي تفاصيل المهمة والخطوات المطلوبة..."
              rows={3}
              className="w-full px-3.5 py-2.5 rounded-xl border border-surface-variant focus:border-secondary focus:ring-2 focus:ring-secondary/20 text-sm outline-none transition-all resize-none"
            />
          </div>

          {/* تعيين الموظفة (خاص بالمديرة فقط) */}
          {isManager && employeesList.length > 0 && (
            <div>
              <label className="block text-xs font-semibold text-primary mb-1">تعيين إلى الموظفة</label>
              <select
                value={assignedUserId}
                onChange={(e) => setAssignedUserId(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-surface-variant focus:border-secondary focus:ring-2 focus:ring-secondary/20 text-sm outline-none bg-surface-container-lowest"
              >
                {employeesList.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.name} ({emp.email}) - {emp.role === 'manager' ? 'مديرة' : 'موظفة'}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* الأولوية والحالة والتصنيف */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-primary mb-1">الأولوية</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as TaskPriority)}
                className="w-full px-3 py-2 rounded-xl border border-surface-variant focus:border-secondary text-xs outline-none bg-surface-container-lowest"
              >
                <option value="low">منخفضة</option>
                <option value="medium">متوسطة</option>
                <option value="high">عالية</option>
                <option value="urgent">عاجلة جداً</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-primary mb-1">الحالة</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as TaskStatus)}
                className="w-full px-3 py-2 rounded-xl border border-surface-variant focus:border-secondary text-xs outline-none bg-surface-container-lowest"
              >
                <option value="not_started">لم يتم</option>
                <option value="in_progress">قيد التنفيذ</option>
                <option value="completed">تم الإنجاز</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-primary mb-1">التصنيف</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-surface-variant focus:border-secondary text-xs outline-none bg-surface-container-lowest"
              >
                <option value="عام">عام</option>
                <option value="برامج دعوية">برامج دعوية</option>
                <option value="إدارية">إدارية</option>
                <option value="مالية">مالية</option>
                <option value="ترجمة">ترجمة</option>
                <option value="قوافل">قوافل وزيارات</option>
              </select>
            </div>
          </div>

          {/* تاريخ الاستحقاق */}
          <div>
            <label className="block text-xs font-semibold text-primary mb-1">تاريخ الاستحقاق</label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-surface-variant focus:border-secondary focus:ring-2 focus:ring-secondary/20 text-sm outline-none transition-all"
            />
          </div>

          {/* أزرار الإجراءات */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-surface-variant/30">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-medium text-on-surface-variant hover:bg-surface-container transition-colors"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 bg-primary hover:bg-secondary text-white rounded-xl text-xs font-semibold shadow-sm transition-all disabled:opacity-50 flex items-center gap-1.5"
            >
              {loading && <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>}
              <span>{initialTask ? 'حفظ التعديلات' : 'إضافة المهمة'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
