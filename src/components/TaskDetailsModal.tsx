'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import {
  getTask,
  updateTask,
  updateTaskStatusWithProof,
  addAttachmentToTask,
  subscribeToTaskMessages,
  sendTaskMessage,
  markTaskMessagesAsRead,
  subscribeToTaskActivities,
  TASK_STATUS_LABELS,
} from '@/lib/firebase/db';
import { uploadTaskFile, formatFileSize } from '@/lib/firebase/storage';
import {
  Task,
  TaskStatus,
  TaskPriority,
  TaskAttachment,
  TaskMessage,
  TaskActivity,
  Profile,
} from '@/lib/firebase/types';

interface TaskDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  task: Task | null;
  onTaskUpdated?: (updatedTask: Task) => void;
  onEditTask?: (task: Task) => void;
  onDeleteTask?: (taskId: string) => void;
  employeesList?: Profile[];
}

export const TaskDetailsModal: React.FC<TaskDetailsModalProps> = ({
  isOpen,
  onClose,
  task: initialTask,
  onTaskUpdated,
  onEditTask,
  onDeleteTask,
  employeesList = [],
}) => {
  const { user, profile, isManager } = useAuth();
  const [currentTask, setCurrentTask] = useState<Task | null>(initialTask);
  const [activeTab, setActiveTab] = useState<'details' | 'chat' | 'activity'>('details');

  // رسائل المحادثة
  const [messages, setMessages] = useState<TaskMessage[]>([]);
  const [newMessageText, setNewMessageText] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  // سجل النشاط
  const [activities, setActivities] = useState<TaskActivity[]>([]);

  // رفع المرفقات
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [uploadError, setUploadError] = useState('');
  const [uploadSuccess, setUploadSuccess] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // نافذة إتمام المهمة مع إثبات
  const [isCompletionModalOpen, setIsCompletionModalOpen] = useState(false);
  const [completionNote, setCompletionNote] = useState('');
  const [completionFiles, setCompletionFiles] = useState<File[]>([]);
  const [completingTask, setCompletingTask] = useState(false);
  const [completionError, setCompletionError] = useState('');

  // معاينة الصورة المكبرة (Lightbox)
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  const currentUserId = user?.uid || (user as any)?.id || '';
  const currentUserName = profile?.name || 'مستخدم';
  const currentUserRole = profile?.role || (isManager ? 'manager' : 'employee');

  // مزامنة المهمة عند الفتح
  useEffect(() => {
    setCurrentTask(initialTask);
    setActiveTab('details');
    setUploadError('');
    setUploadSuccess('');
    setIsCompletionModalOpen(false);
    setCompletionError('');
  }, [initialTask, isOpen]);

  const taskId = currentTask?.id;

  // الاستماع اللحظي لتحديثات المهمة مع حماية دورة الحياة
  useEffect(() => {
    if (!isOpen || !taskId) return;

    let isMounted = true;

    // استماع لرسائل الشات
    const unsubscribeMessages = subscribeToTaskMessages(taskId, (msgs) => {
      if (isMounted) {
        setMessages(msgs);
        if (activeTab === 'chat' && currentUserId) {
          markTaskMessagesAsRead(taskId, currentUserId);
        }
      }
    });

    // استماع لسجل النشاط
    const unsubscribeActivities = subscribeToTaskActivities(taskId, (acts) => {
      if (isMounted) {
        setActivities(acts);
      }
    });

    return () => {
      isMounted = false;
      unsubscribeMessages();
      unsubscribeActivities();
    };
  }, [isOpen, taskId, activeTab, currentUserId]);

  // تمرير الشات لأسفل عند وصول رسالة جديدة
  useEffect(() => {
    if (activeTab === 'chat') {
      chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
      if (taskId && currentUserId) {
        markTaskMessagesAsRead(taskId, currentUserId);
      }
    }
  }, [messages, activeTab, taskId, currentUserId]);

  if (!isOpen || !currentTask) return null;

  // تحديد الموظفة أو المسؤولة المعنية للطرف الآخر
  const otherPartyId = isManager
    ? currentTask.user_id
    : currentTask.created_by || '';

  // شارات الحالة
  const statusConfig: Record<TaskStatus, { label: string; bg: string; icon: string }> = {
    not_started: { label: 'جديدة', bg: 'bg-surface-container text-on-surface-variant border-surface-variant', icon: 'pending' },
    in_progress: { label: 'قيد التنفيذ', bg: 'bg-amber-100 text-amber-900 border-amber-300', icon: 'timelapse' },
    under_review: { label: 'بانتظار المراجعة', bg: 'bg-blue-100 text-blue-900 border-blue-300', icon: 'fact_check' },
    completed: { label: 'مكتملة', bg: 'bg-secondary-container text-on-secondary-container border-secondary/30', icon: 'check_circle' },
    cancelled: { label: 'ملغاة', bg: 'bg-error-container text-on-error-container border-error/30', icon: 'cancel' },
  };

  const currentStatusInfo = statusConfig[currentTask.status] || statusConfig.not_started;

  // شارات الأولوية
  const priorityConfig: Record<TaskPriority, { label: string; bg: string }> = {
    urgent: { label: 'عاجلة جداً', bg: 'bg-error-container text-on-error-container border-error/20' },
    high: { label: 'عالية', bg: 'bg-amber-100 text-amber-900 border-amber-300' },
    medium: { label: 'متوسطة', bg: 'bg-surface-container text-on-surface-variant border-surface-variant' },
    low: { label: 'منخفضة', bg: 'bg-surface-container-low text-outline border-outline-variant/40' },
  };

  // إرسال رسالة في المحادثة
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessageText.trim() || sendingMessage) return;

    const text = newMessageText.trim();
    setNewMessageText('');
    setSendingMessage(true);

    try {
      await sendTaskMessage(
        currentTask.id,
        {
          task_id: currentTask.id,
          sender_id: currentUserId,
          sender_name: currentUserName,
          sender_role: currentUserRole,
          content: text,
          read_by: [currentUserId],
        },
        currentTask.title,
        otherPartyId
      );
    } catch (err: any) {
      console.error('Error sending message:', err);
    } finally {
      setSendingMessage(false);
    }
  };

  // رفع مرفق جديد
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploadError('');
    setUploadSuccess('');
    setUploadProgress(10);

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const attachment = await uploadTaskFile(
          currentTask.id,
          file,
          { id: currentUserId, name: currentUserName, role: currentUserRole },
          (prog) => setUploadProgress(prog)
        );

        await addAttachmentToTask(
          currentTask.id,
          attachment,
          { id: currentUserId, name: currentUserName, role: currentUserRole },
          currentTask.title,
          otherPartyId
        );

        setCurrentTask((prev) =>
          prev ? { ...prev, attachments: [...(prev.attachments || []), attachment] } : prev
        );

        if (onTaskUpdated && currentTask) {
          onTaskUpdated({
            ...currentTask,
            attachments: [...(currentTask.attachments || []), attachment],
          });
        }
      }

      setUploadSuccess(`تم رفع ${files.length} مرفق بنجاح`);
      setTimeout(() => setUploadSuccess(''), 4000);
    } catch (err: any) {
      console.error('Upload error:', err);
      setUploadError(err.message || 'حدث خطأ أثناء رفع الملف');
    } finally {
      setUploadProgress(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // تغيير الحالة
  const handleStatusChange = async (newStatus: TaskStatus) => {
    if (newStatus === currentTask.status) return;

    // إذا اختارت الموظفة إتمام المهمة، نفتح لها نافذة لإضافة ملاحظة إنجاز وإرفاق إثباتات
    if (newStatus === 'completed' && !isManager) {
      setIsCompletionModalOpen(true);
      return;
    }

    try {
      await updateTaskStatusWithProof(
        currentTask.id,
        newStatus,
        { id: currentUserId, name: currentUserName, role: currentUserRole },
        currentTask.title,
        { recipientUserId: otherPartyId }
      );

      const updated = { ...currentTask, status: newStatus };
      setCurrentTask(updated);
      if (onTaskUpdated) onTaskUpdated(updated);
    } catch (err: any) {
      console.error('Error changing status:', err);
    }
  };

  // تأكيد إتمام المهمة مع ملاحظة ومرفقات إثبات
  const handleConfirmCompletion = async () => {
    setCompletingTask(true);
    setCompletionError('');
    try {
      const uploadedAttachments: TaskAttachment[] = [];

      for (const file of completionFiles) {
        const att = await uploadTaskFile(currentTask.id, file, {
          id: currentUserId,
          name: currentUserName,
          role: currentUserRole,
        });
        uploadedAttachments.push(att);
      }

      await updateTaskStatusWithProof(
        currentTask.id,
        'completed',
        { id: currentUserId, name: currentUserName, role: currentUserRole },
        currentTask.title,
        {
          employeeNote: completionNote.trim() || undefined,
          newAttachments: uploadedAttachments.length > 0 ? uploadedAttachments : undefined,
          recipientUserId: otherPartyId,
        }
      );

      const updated: Task = {
        ...currentTask,
        status: 'completed',
        employee_note: completionNote.trim() || currentTask.employee_note,
        attachments: [...(currentTask.attachments || []), ...uploadedAttachments],
      };

      setCurrentTask(updated);
      if (onTaskUpdated) onTaskUpdated(updated);
      setIsCompletionModalOpen(false);
      setCompletionNote('');
      setCompletionFiles([]);
    } catch (err: any) {
      console.error('Error completing task:', err);
      setCompletionError(err.message || 'حدث خطأ أثناء حفظ إثبات إنجاز المهمة');
    } finally {
      setCompletingTask(false);
    }
  };

  const getFileIcon = (fileName: string) => {
    const ext = fileName.split('.').pop()?.toLowerCase() || '';
    if (['png', 'jpg', 'jpeg', 'webp'].includes(ext)) return 'image';
    if (ext === 'pdf') return 'picture_as_pdf';
    if (['doc', 'docx'].includes(ext)) return 'description';
    if (['xls', 'xlsx'].includes(ext)) return 'table_chart';
    return 'attach_file';
  };

  const isImageFile = (fileName: string) => {
    const ext = fileName.split('.').pop()?.toLowerCase() || '';
    return ['png', 'jpg', 'jpeg', 'webp'].includes(ext);
  };

  const unreadMessagesCount = messages.filter(
    (m) => m.sender_id !== currentUserId && (!m.read_by || !m.read_by.includes(currentUserId))
  ).length;

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
        <div className="bg-surface-container-lowest rounded-3xl w-full max-w-4xl max-h-[92vh] shadow-2xl border border-outline-variant/30 flex flex-col overflow-hidden">
          {/* رأس النافذة التفاعلي */}
          <div className="p-4 sm:p-5 bg-surface-container-low border-b border-surface-variant/40 flex items-start justify-between gap-4">
            <div className="flex flex-col gap-1.5 flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                {/* شارة الحالة */}
                <span
                  className={`inline-flex items-center gap-1 px-3 py-0.5 rounded-full text-xs font-bold border shadow-xs ${currentStatusInfo.bg}`}
                >
                  <span className="material-symbols-outlined text-[16px]">{currentStatusInfo.icon}</span>
                  <span>{currentStatusInfo.label}</span>
                </span>

                {/* شارة الأولوية */}
                <span
                  className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                    priorityConfig[currentTask.priority]?.bg || ''
                  }`}
                >
                  {priorityConfig[currentTask.priority]?.label || 'متوسطة'}
                </span>

                {/* التصنيف */}
                {currentTask.category && (
                  <span className="px-2.5 py-0.5 rounded-full text-xs bg-surface-container text-on-surface-variant">
                    {currentTask.category}
                  </span>
                )}

                {/* 🔒 علامة القفل للموظفة */}
                {!isManager && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200">
                    <span className="material-symbols-outlined text-[15px]">lock</span>
                    <span>مهمة مرسلة — لا يمكن تعديل المحتوى الأصلي</span>
                  </span>
                )}
              </div>

              <h2 className="text-lg sm:text-xl font-bold text-primary truncate">
                {currentTask.title}
              </h2>
            </div>

            <div className="flex items-center gap-1.5 flex-shrink-0">
              {/* زر تعديل المهمة للمسؤولة فقط */}
              {isManager && onEditTask && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onEditTask(currentTask);
                  }}
                  className="p-2 text-on-surface-variant hover:text-primary hover:bg-surface-container rounded-xl transition-colors"
                  title="تعديل بيانات المهمة"
                >
                  <span className="material-symbols-outlined text-[20px]">edit</span>
                </button>
              )}

              {/* زر حذف المهمة للمسؤولة فقط */}
              {isManager && onDeleteTask && (
                <button
                  type="button"
                  onClick={() => {
                    if (confirm('هل أنتِ متأكدة من حذف هذه المهمة نهائياً؟')) {
                      onClose();
                      onDeleteTask(currentTask.id);
                    }
                  }}
                  className="p-2 text-outline hover:text-error hover:bg-error-container/30 rounded-xl transition-colors"
                  title="حذف المهمة"
                >
                  <span className="material-symbols-outlined text-[20px]">delete</span>
                </button>
              )}

              {/* زر الإغلاق */}
              <button
                type="button"
                onClick={onClose}
                className="p-2 text-on-surface-variant hover:text-on-surface hover:bg-surface-container rounded-xl transition-colors"
              >
                <span className="material-symbols-outlined text-[22px]">close</span>
              </button>
            </div>
          </div>

          {/* أشرطة التنقل والتبويبات (مركز تفاصيل المهمة) */}
          <div className="px-4 sm:px-6 bg-surface-container-low border-b border-surface-variant/30 flex items-center justify-between gap-2 overflow-x-auto">
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setActiveTab('details')}
                className={`flex items-center gap-1.5 py-3 px-3.5 text-xs sm:text-sm font-bold border-b-2 transition-all ${
                  activeTab === 'details'
                    ? 'border-primary text-primary'
                    : 'border-transparent text-outline hover:text-on-surface'
                }`}
              >
                <span className="material-symbols-outlined text-[18px]">info</span>
                <span>تفاصيل المهمة والمرفقات</span>
                {currentTask.attachments && currentTask.attachments.length > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-surface-container text-on-surface-variant font-bold">
                    {currentTask.attachments.length}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('chat')}
                className={`flex items-center gap-1.5 py-3 px-3.5 text-xs sm:text-sm font-bold border-b-2 transition-all relative ${
                  activeTab === 'chat'
                    ? 'border-secondary text-secondary'
                    : 'border-transparent text-outline hover:text-on-surface'
                }`}
              >
                <span className="material-symbols-outlined text-[18px]">chat</span>
                <span>المحادثة</span>
                {unreadMessagesCount > 0 && (
                  <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-error text-white animate-pulse">
                    {unreadMessagesCount}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('activity')}
                className={`flex items-center gap-1.5 py-3 px-3.5 text-xs sm:text-sm font-bold border-b-2 transition-all ${
                  activeTab === 'activity'
                    ? 'border-primary text-primary'
                    : 'border-transparent text-outline hover:text-on-surface'
                }`}
              >
                <span className="material-symbols-outlined text-[18px]">history</span>
                <span>سجل النشاط</span>
                {activities.length > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-surface-container text-on-surface-variant">
                    {activities.length}
                  </span>
                )}
              </button>
            </div>

            {/* محدد تغيير الحالة السريع */}
            <div className="flex items-center gap-2 py-2">
              <label className="text-xs font-semibold text-outline hidden sm:inline">الحالة:</label>
              <select
                value={currentTask.status}
                onChange={(e) => handleStatusChange(e.target.value as TaskStatus)}
                className="text-xs font-bold px-3 py-1.5 rounded-xl border border-surface-variant focus:border-secondary bg-surface-container-lowest shadow-xs cursor-pointer"
              >
                <option value="not_started">جديدة</option>
                <option value="in_progress">قيد التنفيذ</option>
                <option value="under_review">بانتظار المراجعة</option>
                <option value="completed">مكتملة</option>
                {isManager && <option value="cancelled">ملغاة</option>}
              </select>
            </div>
          </div>

          {/* جسم النافذة ومحتوى التبويبات */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6">
            {/* ======================= التبويب 1: تفاصيل المهمة والمرفقات ======================= */}
            {activeTab === 'details' && (
              <div className="flex flex-col gap-6">
                {/* تنبيه القفل البارز للموظفة */}
                {!isManager && (
                  <div className="p-3.5 rounded-2xl bg-amber-50/80 border border-amber-200 text-amber-900 text-xs flex items-center gap-2.5">
                    <span className="material-symbols-outlined text-[20px] text-amber-700 flex-shrink-0">
                      lock
                    </span>
                    <span className="font-semibold">
                      🔒 المهمة مرسلة — لا يمكن تعديل محتوى المهمة الأصلي (العنوان والوصف وتوجيهات المسؤولة). يمكنك تغيير حالة التنفيذ، إرفاق إثباتاتك، والتواصل عبر المحادثة.
                    </span>
                  </div>
                )}

                {/* شبكة البيانات الوصفية (المسؤولة، المكلفة، المواعيد) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <div className="p-3 rounded-2xl bg-surface-container-low border border-surface-variant/30 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
                      <span className="material-symbols-outlined text-[20px]">admin_panel_settings</span>
                    </div>
                    <div className="min-w-0">
                      <span className="text-[11px] text-outline block">المسؤولة (مرسلة المهمة)</span>
                      <span className="text-xs font-bold text-primary truncate block">
                        {currentTask.creator_name || 'إدارة الجمعية'}
                      </span>
                    </div>
                  </div>

                  <div className="p-3 rounded-2xl bg-surface-container-low border border-surface-variant/30 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-secondary/10 text-secondary flex items-center justify-center flex-shrink-0">
                      <span className="material-symbols-outlined text-[20px]">person</span>
                    </div>
                    <div className="min-w-0">
                      <span className="text-[11px] text-outline block">الموظفة المكلفة</span>
                      <span className="text-xs font-bold text-primary truncate block">
                        {currentTask.profiles?.name ||
                          employeesList.find((e) => e.id === currentTask.user_id)?.name ||
                          'موظفة'}
                      </span>
                    </div>
                  </div>

                  <div className="p-3 rounded-2xl bg-surface-container-low border border-surface-variant/30 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-surface-container text-on-surface-variant flex items-center justify-center flex-shrink-0">
                      <span className="material-symbols-outlined text-[20px]">calendar_today</span>
                    </div>
                    <div className="min-w-0">
                      <span className="text-[11px] text-outline block">تاريخ الإرسال</span>
                      <span className="text-xs font-semibold text-on-surface truncate block">
                        {new Date(currentTask.created_at).toLocaleDateString('ar-SA')}
                      </span>
                    </div>
                  </div>

                  <div className="p-3 rounded-2xl bg-surface-container-low border border-surface-variant/30 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-surface-container text-on-surface-variant flex items-center justify-center flex-shrink-0">
                      <span className="material-symbols-outlined text-[20px]">event</span>
                    </div>
                    <div className="min-w-0">
                      <span className="text-[11px] text-outline block">تاريخ الاستحقاق</span>
                      <span className="text-xs font-semibold text-on-surface truncate block">
                        {currentTask.due_date || 'غير محدد'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* وصف المهمة الأصلي */}
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-bold text-primary flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[18px] text-secondary">segment</span>
                    <span>وصف وتفاصيل المهمة</span>
                  </label>
                  <div className="p-4 rounded-2xl bg-surface-container-low/60 border border-surface-variant/40 text-sm leading-relaxed whitespace-pre-wrap text-on-surface">
                    {currentTask.description ? (
                      currentTask.description
                    ) : (
                      <span className="text-outline text-xs italic">لا يوجد وصف مكتوب للمهمة.</span>
                    )}
                  </div>
                </div>

                {/* ملاحظة المسؤولة إن وجدت */}
                {currentTask.manager_note && (
                  <div className="p-4 rounded-2xl bg-primary-container/10 border border-primary-container/30 flex flex-col gap-1.5">
                    <div className="flex items-center gap-2 text-primary font-bold text-xs">
                      <span className="material-symbols-outlined text-[18px] text-secondary">note_alt</span>
                      <span>ملاحظة وتوجيهات المسؤولة:</span>
                    </div>
                    <p className="text-xs text-on-surface-variant leading-relaxed">
                      {currentTask.manager_note}
                    </p>
                  </div>
                )}

                {/* ملاحظة إنجاز الموظفة إن وجدت */}
                {currentTask.employee_note && (
                  <div className="p-4 rounded-2xl bg-secondary-container/20 border border-secondary/30 flex flex-col gap-1.5">
                    <div className="flex items-center gap-2 text-secondary font-bold text-xs">
                      <span className="material-symbols-outlined text-[18px]">verified</span>
                      <span>إفادة وملاحظات الموظفة عند التنفيذ:</span>
                    </div>
                    <p className="text-xs text-on-surface-variant leading-relaxed">
                      {currentTask.employee_note}
                    </p>
                  </div>
                )}

                {/* قسم المرفقات والصور */}
                <div className="flex flex-col gap-3 pt-4 border-t border-surface-variant/30">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-primary text-[20px]">attachment</span>
                      <h3 className="font-bold text-sm text-primary">المرفقات والملفات</h3>
                      <span className="text-xs text-outline">
                        ({currentTask.attachments?.length || 0})
                      </span>
                    </div>

                    {/* زر إرفاق ملف جديد */}
                    <div>
                      <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileUpload}
                        multiple
                        className="hidden"
                        accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.webp"
                      />
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploadProgress !== null}
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-secondary text-white rounded-xl text-xs font-bold hover:bg-secondary/90 shadow-sm transition-all disabled:opacity-50"
                      >
                        <span className="material-symbols-outlined text-[18px]">upload_file</span>
                        <span>إرفاق ملف / صورة</span>
                      </button>
                    </div>
                  </div>

                  {/* شريط تقدم الرفع إن وجد */}
                  {uploadProgress !== null && (
                    <div className="p-3 rounded-xl bg-surface-container-low border border-secondary/30 flex flex-col gap-1.5">
                      <div className="flex items-center justify-between text-xs font-semibold text-secondary">
                        <span>جاري رفع الملف...</span>
                        <span>{uploadProgress}%</span>
                      </div>
                      <div className="w-full h-1.5 bg-surface-container rounded-full overflow-hidden">
                        <div
                          className="h-full bg-secondary transition-all duration-200"
                          style={{ width: `${uploadProgress}%` }}
                        ></div>
                      </div>
                    </div>
                  )}

                  {/* رسائل الخطأ والنجاح */}
                  {uploadError && (
                    <div className="p-3 rounded-xl bg-error-container/30 text-on-error-container text-xs flex items-center gap-2 border border-error/20">
                      <span className="material-symbols-outlined text-[18px] text-error">error</span>
                      <span>{uploadError}</span>
                    </div>
                  )}
                  {uploadSuccess && (
                    <div className="p-3 rounded-xl bg-secondary-container/30 text-on-secondary-container text-xs flex items-center gap-2 border border-secondary/20">
                      <span className="material-symbols-outlined text-[18px]">check_circle</span>
                      <span>{uploadSuccess}</span>
                    </div>
                  )}

                  {/* قائمة المرفقات */}
                  {currentTask.attachments && currentTask.attachments.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-1">
                      {currentTask.attachments.map((att) => {
                        const isImg = isImageFile(att.name);
                        return (
                          <div
                            key={att.id}
                            className="p-3 rounded-2xl border border-surface-variant/40 bg-surface-container-lowest hover:border-secondary/40 transition-all flex items-center gap-3 shadow-2xs"
                          >
                            {/* معاينة مصغرة إذا كانت صورة، أو أيقونة ملف */}
                            {isImg ? (
                              <button
                                type="button"
                                onClick={() => setPreviewImage(att.url)}
                                className="relative w-12 h-12 rounded-xl overflow-hidden bg-surface-container flex-shrink-0 group cursor-pointer border border-surface-variant/30"
                              >
                                <img
                                  src={att.url}
                                  alt={att.name}
                                  className="w-full h-full object-cover transition-transform group-hover:scale-110"
                                />
                                <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                  <span className="material-symbols-outlined text-white text-[16px]">visibility</span>
                                </div>
                              </button>
                            ) : (
                              <div className="w-12 h-12 rounded-xl bg-surface-container-low text-primary flex items-center justify-center flex-shrink-0 border border-surface-variant/30">
                                <span className="material-symbols-outlined text-[24px]">
                                  {getFileIcon(att.name)}
                                </span>
                              </div>
                            )}

                            {/* بيانات الملف */}
                            <div className="flex-1 min-w-0">
                              <span className="text-xs font-bold text-primary truncate block" title={att.name}>
                                {att.name}
                              </span>
                              <div className="flex items-center gap-2 text-[10px] text-outline mt-0.5">
                                <span>{formatFileSize(att.size)}</span>
                                <span>•</span>
                                <span>{att.uploader_role === 'manager' ? 'المسؤولة' : 'الموظفة'}</span>
                              </div>
                            </div>

                            {/* زر فتح/تنزيل الملف */}
                            <a
                              href={att.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-2 text-on-surface-variant hover:text-primary hover:bg-surface-container-low rounded-xl transition-colors"
                              title="فتح الملف"
                            >
                              <span className="material-symbols-outlined text-[20px]">open_in_new</span>
                            </a>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="py-8 text-center text-outline border-2 border-dashed border-surface-variant/50 rounded-2xl flex flex-col items-center justify-center gap-1.5">
                      <span className="material-symbols-outlined text-[32px] opacity-40">attachment</span>
                      <p className="text-xs">لم يتم إرفاق ملفات مع هذه المهمة بعد.</p>
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="text-xs font-bold text-secondary hover:underline mt-1"
                      >
                        إضافة أول مرفق الآن
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ======================= التبويب 2: المحادثة الداخلية ======================= */}
            {activeTab === 'chat' && (
              <div className="flex flex-col h-[460px]">
                <div className="p-3 bg-surface-container-low/70 rounded-2xl text-xs text-outline mb-3 flex items-center gap-2 border border-surface-variant/30">
                  <span className="material-symbols-outlined text-[18px] text-secondary">forum</span>
                  <span>
                    هذه المحادثة خاصة بهذه المهمة فقط ومحصورة بين المسؤولة والموظفة المكلفة.
                  </span>
                </div>

                {/* منطقة عرض الرسائل */}
                <div className="flex-1 overflow-y-auto px-1 py-2 flex flex-col gap-3">
                  {messages.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center text-outline">
                      <span className="material-symbols-outlined text-[40px] opacity-40 mb-2">chat_bubble</span>
                      <p className="text-xs font-semibold">لا توجد رسائل سابقة في هذه المهمة.</p>
                      <p className="text-[11px] mt-1">ابدئي المحادثة الآن لإرسال التعليمات أو الاستفسار.</p>
                    </div>
                  ) : (
                    messages.map((msg) => {
                      const isMe = msg.sender_id === currentUserId;
                      return (
                        <div
                          key={msg.id}
                          className={`flex flex-col max-w-[80%] sm:max-w-[70%] ${
                            isMe ? 'self-end items-end' : 'self-start items-start'
                          }`}
                        >
                          <div className="flex items-center gap-1.5 text-[10px] text-outline mb-1 px-1">
                            <span className="font-bold text-primary">{msg.sender_name}</span>
                            <span
                              className={`px-1.5 py-0.2 rounded-full ${
                                msg.sender_role === 'manager'
                                  ? 'bg-secondary-container text-on-secondary-container'
                                  : 'bg-surface-container text-on-surface-variant'
                              }`}
                            >
                              {msg.sender_role === 'manager' ? 'مسؤولة' : 'موظفة'}
                            </span>
                          </div>

                          <div
                            className={`p-3 rounded-2xl text-xs sm:text-sm leading-relaxed shadow-2xs whitespace-pre-wrap ${
                              isMe
                                ? 'bg-primary text-white rounded-tl-none'
                                : 'bg-surface-container-low text-on-surface rounded-tr-none border border-surface-variant/40'
                            }`}
                          >
                            {msg.content}
                          </div>

                          <span className="text-[9px] text-outline mt-1 px-1">
                            {new Date(msg.created_at).toLocaleTimeString('ar-SA', {
                              hour: 'numeric',
                              minute: 'numeric',
                              hour12: true,
                            })}
                          </span>
                        </div>
                      );
                    })
                  )}
                  <div ref={chatBottomRef} />
                </div>

                {/* حقل إدخال الرسالة */}
                <form onSubmit={handleSendMessage} className="pt-3 border-t border-surface-variant/40 flex gap-2">
                  <input
                    type="text"
                    value={newMessageText}
                    onChange={(e) => setNewMessageText(e.target.value)}
                    placeholder="اكتبي رسالة..."
                    disabled={sendingMessage}
                    className="flex-1 px-4 py-2.5 rounded-xl border border-surface-variant focus:border-secondary focus:ring-2 focus:ring-secondary/20 text-sm outline-none transition-all"
                  />
                  <button
                    type="submit"
                    disabled={!newMessageText.trim() || sendingMessage}
                    className="px-5 py-2.5 bg-secondary text-white rounded-xl font-semibold text-xs shadow-sm hover:bg-secondary/90 transition-all disabled:opacity-50 flex items-center gap-1.5"
                  >
                    <span>إرسال</span>
                    <span className="material-symbols-outlined text-[18px]">send</span>
                  </button>
                </form>
              </div>
            )}

            {/* ======================= التبويب 3: سجل النشاط ======================= */}
            {activeTab === 'activity' && (
              <div className="flex flex-col gap-4">
                <div className="p-3 bg-surface-container-low/70 rounded-2xl text-xs text-outline flex items-center gap-2 border border-surface-variant/30">
                  <span className="material-symbols-outlined text-[18px] text-primary">history</span>
                  <span>
                    سجل تاريخي دقيق ومحمي يوثّق جميع العمليات والتغييرات على المهمة ولا يمكن حذفه.
                  </span>
                </div>

                <div className="relative pr-4 border-r-2 border-surface-variant flex flex-col gap-6 py-2">
                  {activities.length === 0 ? (
                    <div className="py-8 text-center text-outline text-xs">
                      لا يوجد نشاط مسجل حتى الآن.
                    </div>
                  ) : (
                    activities.map((act) => (
                      <div key={act.id} className="relative flex items-start gap-3">
                        <div className="absolute -right-[23px] top-0 w-3.5 h-3.5 rounded-full bg-secondary ring-4 ring-surface-container-lowest"></div>
                        <div className="p-3 rounded-2xl bg-surface-container-low/60 border border-surface-variant/30 flex-1">
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <span className="text-xs font-bold text-primary">{act.details}</span>
                            <span className="text-[10px] text-outline">
                              {new Date(act.created_at).toLocaleTimeString('ar-SA', {
                                hour: 'numeric',
                                minute: 'numeric',
                                hour12: true,
                              })}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-[10px] text-outline">
                            <span>بواسطة: {act.user_name}</span>
                            <span>•</span>
                            <span>{new Date(act.created_at).toLocaleDateString('ar-SA')}</span>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* أسفل النافذة: أزرار الإجراء السريع */}
          <div className="p-4 bg-surface-container-low border-t border-surface-variant/40 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              {/* أزرار الإجراءات السريعة للموظفة */}
              {!isManager && currentTask.status !== 'completed' && (
                <>
                  {currentTask.status !== 'in_progress' && (
                    <button
                      type="button"
                      onClick={() => handleStatusChange('in_progress')}
                      className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all flex items-center gap-1"
                    >
                      <span className="material-symbols-outlined text-[16px]">play_arrow</span>
                      <span>بدء العمل</span>
                    </button>
                  )}

                  {currentTask.status !== 'under_review' && (
                    <button
                      type="button"
                      onClick={() => handleStatusChange('under_review')}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all flex items-center gap-1"
                    >
                      <span className="material-symbols-outlined text-[16px]">fact_check</span>
                      <span>إرسال للمراجعة</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => setIsCompletionModalOpen(true)}
                    className="px-4 py-2 bg-secondary hover:bg-secondary/90 text-white rounded-xl text-xs font-bold shadow-sm transition-all flex items-center gap-1"
                  >
                    <span className="material-symbols-outlined text-[16px]">task_alt</span>
                    <span>إتمام المهمة مع إثبات</span>
                  </button>
                </>
              )}

              {currentTask.status === 'completed' && (
                <div className="flex items-center gap-1.5 text-xs font-bold text-secondary">
                  <span className="material-symbols-outlined text-[20px]">verified</span>
                  <span>تم إنجاز هذه المهمة بنجاح</span>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 bg-surface-container text-on-surface-variant hover:bg-surface-variant rounded-xl text-xs font-semibold transition-colors"
            >
              إغلاق
            </button>
          </div>
        </div>
      </div>

      {/* نافذة إتمام المهمة مع إثبات الموظفة */}
      {isCompletionModalOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150"
          style={{ zIndex: 100 }}
          onClick={(e) => {
            if (e.target === e.currentTarget && !completingTask) {
              setIsCompletionModalOpen(false);
            }
          }}
        >
          <div className="bg-surface-container-lowest rounded-3xl w-full max-w-md p-6 shadow-2xl border border-secondary/30 flex flex-col gap-4 relative z-[101]">
            <div className="flex items-center justify-between text-secondary">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[26px]">task_alt</span>
                <h3 className="text-base font-bold text-primary">إتمام المهمة وإرسال الإثبات</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsCompletionModalOpen(false)}
                disabled={completingTask}
                className="text-on-surface-variant hover:text-on-surface p-1.5 rounded-xl hover:bg-surface-container transition-colors disabled:opacity-50"
                title="إغلاق"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <p className="text-xs text-on-surface-variant leading-relaxed">
              يمكنك كتابة ملاحظاتك حول كيفية تنفيذ المهمة وإرفاق صور أو مستندات تثبت إتمام العمل بنجاح.
            </p>

            {completionError && (
              <div className="p-3 rounded-2xl bg-error-container/40 text-on-error-container text-xs flex items-center gap-2 border border-error/20">
                <span className="material-symbols-outlined text-[18px] text-error flex-shrink-0">error</span>
                <span>{completionError}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-primary mb-1">
                ملاحظات الإنجاز / تعليق الموظفة
              </label>
              <textarea
                value={completionNote}
                onChange={(e) => setCompletionNote(e.target.value)}
                placeholder="اكتبي ما تم إنجازه، مثل: تم فحص وتحديث جميع أجهزة القاعة وتعمل بكفاءة..."
                rows={3}
                className="w-full px-3.5 py-2.5 rounded-xl border border-surface-variant focus:border-secondary text-xs outline-none resize-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-primary mb-1 flex items-center justify-between">
                <span>إرفاق صور أو ملف إثبات (اختياري)</span>
                <span className="text-[10px] text-outline font-normal">(صور، PDF، Word)</span>
              </label>
              <input
                type="file"
                multiple
                accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.webp"
                onChange={(e) => {
                  if (e.target.files) {
                    const newFiles = Array.from(e.target.files);
                    setCompletionFiles((prev) => [...prev, ...newFiles]);
                  }
                }}
                className="w-full text-xs text-outline file:mr-0 file:ml-3 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-secondary file:text-white hover:file:bg-secondary/90 cursor-pointer"
              />
              {completionFiles.length > 0 && (
                <div className="mt-2.5 flex flex-col gap-1.5 max-h-32 overflow-y-auto">
                  {completionFiles.map((f, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between p-2 rounded-xl bg-surface-container-low text-xs border border-surface-variant/30"
                    >
                      <div className="flex items-center gap-2 truncate">
                        <span className="material-symbols-outlined text-[16px] text-secondary">
                          description
                        </span>
                        <span className="font-semibold truncate">{f.name}</span>
                        <span className="text-[10px] text-outline">({formatFileSize(f.size)})</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setCompletionFiles((prev) => prev.filter((_, idx) => idx !== i))}
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

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-surface-variant/30">
              <button
                type="button"
                onClick={() => setIsCompletionModalOpen(false)}
                disabled={completingTask}
                className="px-4 py-2 rounded-xl text-xs font-medium text-outline hover:bg-surface-container disabled:opacity-50"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleConfirmCompletion}
                disabled={completingTask}
                className="px-5 py-2.5 bg-secondary hover:bg-secondary/90 text-white rounded-xl text-xs font-bold shadow-sm transition-all disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
              >
                {completingTask && (
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                )}
                <span>{completingTask ? 'جاري الحفظ والإرسال...' : 'تأكيد الإنجاز'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* معاينة الصورة بالحجم الكامل (Lightbox) */}
      {previewImage && (
        <div
          className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in"
          style={{ zIndex: 110 }}
          onClick={() => setPreviewImage(null)}
        >
          <div className="relative max-w-3xl max-h-[90vh] overflow-hidden rounded-2xl z-[111]">
            <button
              type="button"
              onClick={() => setPreviewImage(null)}
              className="absolute top-3 left-3 p-2 bg-black/50 hover:bg-black/70 text-white rounded-full transition-colors"
            >
              <span className="material-symbols-outlined text-[24px]">close</span>
            </button>
            <img src={previewImage} alt="Preview" className="max-w-full max-h-[85vh] object-contain rounded-2xl" />
          </div>
        </div>
      )}
    </>
  );
};
