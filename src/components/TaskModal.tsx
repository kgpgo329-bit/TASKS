/**
 * © 2026 Jory Al-Thuwaini — Mahami Platform
 * منصة مهامي — جميع الحقوق محفوظة
 */

'use client';

import React, { useState, useEffect } from 'react';
import { Task, TaskPriority, TaskStatus, Profile } from '@/lib/firebase/types';
import { formatFileSize, ALLOWED_FILE_EXTENSIONS } from '@/lib/firebase/storage';

interface TaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (taskData: {
    title: string;
    description: string;
    manager_note?: string;
    status: TaskStatus;
    priority: TaskPriority;
    due_date: string | null;
    category: string;
    user_id?: string;
    selectedFiles?: File[];
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
  const [managerNote, setManagerNote] = useState('');
  const [status, setStatus] = useState<TaskStatus>('not_started');
  const [priority, setPriority] = useState<TaskPriority>('medium');
  const [dueDate, setDueDate] = useState('');
  const [category, setCategory] = useState('عام');
  const [assignedUserId, setAssignedUserId] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      if (initialTask) {
        setTitle(initialTask.title || '');
        setDescription(initialTask.description || '');
        setManagerNote(initialTask.manager_note || '');
        setStatus(initialTask.status || 'not_started');
        setPriority(initialTask.priority || 'medium');
        setDueDate(initialTask.due_date || '');
        setCategory(initialTask.category || 'عام');
        setAssignedUserId(initialTask.user_id || '');
      } else {
        setTitle('');
        setDescription('');
        setManagerNote('');
        setStatus('not_started');
        setPriority('medium');
        setDueDate('');
        setCategory('عام');
        setAssignedUserId(employeesList[0]?.id || '');
      }
      setSelectedFiles([]);
      setError('');
    }
  }, [initialTask, isOpen]);

  // تحديث الموظفة المختارة تلقائياً عند تحميل قائمة الموظفات دون مسح المدخلات
  useEffect(() => {
    if (!assignedUserId && employeesList.length > 0 && !initialTask) {
      setAssignedUserId(employeesList[0].id);
    }
  }, [employeesList, assignedUserId, initialTask]);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const newFiles = Array.from(e.target.files);
    setSelectedFiles((prev) => [...prev, ...newFiles]);
  };

  const removeSelectedFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('يرجى إدخال عنوان المهمة');
      return;
    }

    const effectiveAssignedUserId = isManager
      ? (assignedUserId || employeesList[0]?.id || undefined)
      : undefined;

    setLoading(true);
    setError('');

    try {
      await onSave({
        title: title.trim(),
        description: description.trim(),
        manager_note: managerNote.trim() || undefined,
        status,
        priority,
        due_date: dueDate || null,
        category: category || 'عام',
        user_id: effectiveAssignedUserId,
        selectedFiles: selectedFiles.length > 0 ? selectedFiles : undefined,
      });
      onClose();
    } catch (err: any) {
      console.error('Error saving task in modal:', err);
      setError(err.message || 'حدث خطأ أثناء حفظ المهمة');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-surface-container-lowest rounded-3xl w-full max-w-xl max-h-[90vh] shadow-2xl border border-outline-variant/30 flex flex-col overflow-hidden">
        {/* رأس النافذة */}
        <div className="px-6 py-4 bg-surface-container-low border-b border-surface-variant/40 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-[24px]">
              {initialTask ? 'edit_note' : 'add_task'}
            </span>
            <h2 className="font-bold text-primary text-base">
              {initialTask ? 'تعديل بيانات المهمة' : 'إنشاء وإرسال مهمة جديدة'}
            </h2>
          </div>
          <button
            onClick={onClose}
            type="button"
            className="text-on-surface-variant hover:text-on-surface p-1 rounded-xl hover:bg-surface-container transition-colors"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* نموذج الإدخال */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto flex flex-col gap-4 flex-1">
          {error && (
            <div className="p-3 rounded-2xl bg-error-container/30 text-on-error-container text-xs flex items-center gap-2 border border-error/20">
              <span className="material-symbols-outlined text-[18px] text-error">error</span>
              <span>{error}</span>
            </div>
          )}

          {/* العنوان */}
          <div>
            <label className="block text-xs font-bold text-primary mb-1">
              عنوان المهمة <span className="text-error">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="مثال: فحص وتحديث أجهزة الجمعية وتسجيل الأعطال"
              required
              className="w-full px-4 py-2.5 rounded-xl border border-surface-variant focus:border-secondary focus:ring-2 focus:ring-secondary/20 text-sm outline-none transition-all"
            />
          </div>

          {/* تعيين الموظفة (خاص بالمديرة فقط) */}
          {isManager && employeesList.length > 0 && (
            <div>
              <label className="block text-xs font-bold text-primary mb-1">
                تعيين وإرسال إلى الموظفة <span className="text-error">*</span>
              </label>
              <select
                value={assignedUserId}
                onChange={(e) => setAssignedUserId(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-surface-variant focus:border-secondary focus:ring-2 focus:ring-secondary/20 text-sm outline-none bg-surface-container-lowest"
              >
                {employeesList.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.name} ({emp.email}) - {emp.role === 'manager' ? 'مديرة' : 'موظفة'}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* الوصف */}
          <div>
            <label className="block text-xs font-bold text-primary mb-1">تفاصيل وخطوات المهمة</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="أدخلي تفاصيل المهمة بالتفصيل والخطوات المطلوبة تنفيذها..."
              rows={3}
              className="w-full px-4 py-2.5 rounded-xl border border-surface-variant focus:border-secondary focus:ring-2 focus:ring-secondary/20 text-sm outline-none transition-all resize-none"
            />
          </div>

          {/* ملاحظة المسؤولة */}
          <div>
            <label className="block text-xs font-bold text-secondary mb-1 flex items-center gap-1">
              <span className="material-symbols-outlined text-[16px]">note_alt</span>
              <span>ملاحظة أو توجيه خاص من المسؤولة (تظهر للموظفة بشكل بارز)</span>
            </label>
            <input
              type="text"
              value={managerNote}
              onChange={(e) => setManagerNote(e.target.value)}
              placeholder="مثال: يرجى الانتهاء من فحص الأجهزة قبل يوم الخميس القادم."
              className="w-full px-4 py-2 rounded-xl border border-secondary/30 bg-secondary/5 focus:border-secondary text-sm outline-none transition-all"
            />
          </div>

          {/* الأولوية والحالة والتصنيف */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-primary mb-1">الأولوية</label>
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
              <label className="block text-xs font-bold text-primary mb-1">الحالة</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as TaskStatus)}
                className="w-full px-3 py-2 rounded-xl border border-surface-variant focus:border-secondary text-xs outline-none bg-surface-container-lowest"
              >
                <option value="not_started">جديدة</option>
                <option value="in_progress">قيد التنفيذ</option>
                <option value="under_review">بانتظار المراجعة</option>
                <option value="completed">مكتملة</option>
                {isManager && <option value="cancelled">ملغاة</option>}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-primary mb-1">التصنيف</label>
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
            <label className="block text-xs font-bold text-primary mb-1">تاريخ الاستحقاق</label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-surface-variant focus:border-secondary focus:ring-2 focus:ring-secondary/20 text-sm outline-none transition-all"
            />
          </div>

          {/* إرفاق ملفات وصور مع المهمة */}
          <div className="pt-2 border-t border-surface-variant/30">
            <label className="block text-xs font-bold text-primary mb-1.5 flex items-center justify-between">
              <span className="flex items-center gap-1">
                <span className="material-symbols-outlined text-[18px] text-secondary">attach_file</span>
                <span>إرفاق ملفات أو صور مع المهمة</span>
              </span>
              <span className="text-[10px] text-outline font-normal">
                (PDF, DOCX, XLSX, صور حتى 15MB)
              </span>
            </label>

            <input
              type="file"
              multiple
              accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.webp"
              onChange={handleFileChange}
              className="w-full text-xs text-outline file:mr-0 file:ml-3 file:py-1.5 file:px-3.5 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-surface-container-high file:text-on-surface hover:file:bg-surface-variant cursor-pointer"
            />

            {/* قائمة الملفات المختارة */}
            {selectedFiles.length > 0 && (
              <div className="mt-2.5 flex flex-col gap-1.5">
                {selectedFiles.map((file, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-2 rounded-xl bg-surface-container-low text-xs border border-surface-variant/30"
                  >
                    <div className="flex items-center gap-2 truncate">
                      <span className="material-symbols-outlined text-[16px] text-secondary">description</span>
                      <span className="font-semibold truncate">{file.name}</span>
                      <span className="text-[10px] text-outline">({formatFileSize(file.size)})</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeSelectedFile(idx)}
                      className="p-1 text-outline hover:text-error rounded-lg transition-colors"
                      title="إزالة"
                    >
                      <span className="material-symbols-outlined text-[16px]">close</span>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* تنبيه الخطأ بالقرب من أزرار الإجراءات لضمان رؤيته فوراً */}
          {error && (
            <div className="p-3 rounded-2xl bg-error-container/40 text-on-error-container text-xs flex items-center gap-2 border border-error/20">
              <span className="material-symbols-outlined text-[18px] text-error flex-shrink-0">error</span>
              <span className="flex-1">{error}</span>
            </div>
          )}

          {/* أزرار الإجراءات */}
          <div className="flex items-center justify-end gap-2 pt-4 border-t border-surface-variant/30">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 rounded-xl text-xs font-medium text-outline hover:bg-surface-container transition-colors disabled:opacity-50"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2.5 bg-primary hover:bg-secondary text-white rounded-xl text-xs font-bold shadow-sm transition-all disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
            >
              {loading && (
                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              )}
              <span>{loading ? 'جاري الإرسال...' : (initialTask ? 'حفظ التعديلات' : 'إرسال وتكليف المهمة')}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

