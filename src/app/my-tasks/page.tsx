'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { AuthGuard } from '@/components/AuthGuard';
import { Sidebar } from '@/components/Sidebar';
import { Header } from '@/components/Header';
import { TaskCard } from '@/components/TaskCard';
import { TaskModal } from '@/components/TaskModal';
import { TaskDetailsModal } from '@/components/TaskDetailsModal';
import { useAuth } from '@/contexts/AuthContext';
import { getUserTasks, createTask, updateTask, deleteTask, getTask } from '@/lib/firebase/db';
import { Task, TaskStatus, TaskPriority } from '@/lib/firebase/types';

export default function MyTasksPage() {
  const { user, profile, isManager } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | TaskStatus>('all');
  const [priorityFilter, setPriorityFilter] = useState<'all' | TaskPriority>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [taskToDelete, setTaskToDelete] = useState<string | null>(null);
  const [detailsTask, setDetailsTask] = useState<Task | null>(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const currentUserId = user?.uid || (user as any)?.id;

  // جلب مهام المستخدم الحالي فقط من Firestore
  const fetchMyTasks = async (forceRefresh = false) => {
    if (!currentUserId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setFetchError(null);

    try {
      const myTasks = await getUserTasks(currentUserId, forceRefresh);
      setTasks(myTasks);
    } catch (err: any) {
      console.error('Exception fetching tasks:', err);
      setFetchError(err?.message || 'تعذر تحميل قائمة المهام الخاصة');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMyTasks();
  }, [currentUserId]);

  // تغيير حالة المهمة
  const handleStatusChange = async (taskId: string, newStatus: TaskStatus) => {
    try {
      setTasks((prev) =>
        prev.map((t) => (t.id === taskId ? { ...t, status: newStatus } : t))
      );

      await updateTask(taskId, { status: newStatus });
    } catch (err) {
      console.error('Exception updating task status:', err);
      fetchMyTasks();
    }
  };

  // حفظ أو تعديل مهمة
  const handleSaveTask = async (taskData: {
    title: string;
    description: string;
    status: TaskStatus;
    priority: TaskPriority;
    due_date: string | null;
    category: string;
    user_id?: string;
  }) => {
    if (!user) return;

    if (editingTask) {
      await updateTask(editingTask.id, {
        title: taskData.title,
        description: taskData.description,
        status: taskData.status,
        priority: taskData.priority,
        due_date: taskData.due_date,
        category: taskData.category,
      });
      setTasks((prev) =>
        prev.map((t) =>
          t.id === editingTask.id
            ? { ...t, ...taskData, updated_at: new Date().toISOString() }
            : t
        )
      );
    } else {
      const newTask = await createTask({
        title: taskData.title,
        description: taskData.description,
        status: taskData.status,
        priority: taskData.priority,
        due_date: taskData.due_date,
        category: taskData.category,
        user_id: currentUserId,
      });
      setTasks((prev) => [newTask, ...prev]);
    }
  };

  // حذف مهمة
  const confirmDeleteTask = async () => {
    if (!taskToDelete) return;

    try {
      await deleteTask(taskToDelete);
      setTasks((prev) => prev.filter((t) => t.id !== taskToDelete));
      setTaskToDelete(null);
    } catch (err) {
      console.error('Error deleting task:', err);
    }
  };

  // تصدير المهام كملف CSV (متوافق مع Excel)
  const handleExportCSV = () => {
    if (tasks.length === 0) return;
    const headers = ['عنوان المهمة', 'الحالة', 'الأولوية', 'التصنيف', 'تاريخ الاستحقاق', 'الوصف'];
    const rows = tasks.map((t) => [
      `"${t.title.replace(/"/g, '""')}"`,
      `"${t.status === 'completed' ? 'تم الإنجاز' : t.status === 'in_progress' ? 'قيد التنفيذ' : 'لم يتم'}"`,
      `"${t.priority}"`,
      `"${t.category || 'عام'}"`,
      `"${t.due_date || 'غير محدد'}"`,
      `"${(t.description || '').replace(/"/g, '""')}"`,
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `مهامي_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // إحصائيات سريعة
  const totalCount = tasks.length;
  const completedCount = tasks.filter((t) => t.status === 'completed').length;
  const inProgressCount = tasks.filter((t) => t.status === 'in_progress').length;
  const underReviewCount = tasks.filter((t) => t.status === 'under_review').length;
  const notStartedCount = tasks.filter((t) => t.status === 'not_started').length;
  const completionRate = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  // استخراج قائمة التصنيفات
  const categories = useMemo(() => {
    const cats = new Set<string>();
    tasks.forEach((t) => {
      if (t.category) cats.add(t.category);
    });
    return Array.from(cats);
  }, [tasks]);

  // تصفية المهام
  const filteredTasks = tasks.filter((t) => {
    const matchesSearch =
      t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (t.description && t.description.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesStatus = statusFilter === 'all' || t.status === statusFilter;
    const matchesPriority = priorityFilter === 'all' || t.priority === priorityFilter;
    const matchesCategory = selectedCategory === 'all' || t.category === selectedCategory;

    return matchesSearch && matchesStatus && matchesPriority && matchesCategory;
  });

  return (
    <AuthGuard>
      <div className="min-h-screen bg-background">
        {/* القائمة الجانبية */}
        <Sidebar
          isOpen={isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
          myTasksCount={totalCount}
        />

        {/* الترويسة العلوية */}
        <Header
          onOpenMobileMenu={() => setIsSidebarOpen(true)}
          onOpenNewTaskModal={() => {
            setEditingTask(null);
            setIsTaskModalOpen(true);
          }}
          onSelectTask={async (taskId) => {
            const found = tasks.find((t) => t.id === taskId);
            if (found) {
              setDetailsTask(found);
              setIsDetailsModalOpen(true);
            } else {
              const t = await getTask(taskId);
              if (t) {
                setDetailsTask(t);
                setIsDetailsModalOpen(true);
              }
            }
          }}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
        />

        {/* المحتوى الرئيسي */}
        <main className="lg:pr-72 pt-20 pb-28 lg:pb-10 p-4 lg:p-space-xl flex flex-col gap-6">
          {/* شريط العنوان والإجراءات */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <h1 className="text-2xl lg:text-3xl font-bold text-primary">مهامي الخاصة بي</h1>
                <span className="px-2.5 py-0.5 rounded-full bg-secondary-container text-on-secondary-container text-xs font-semibold">
                  {totalCount} مهمة
                </span>
              </div>
              <p className="text-xs lg:text-sm text-on-surface-variant">
                متابعة وإنجاز كافة مهامكِ وبرامجكِ الدعوية والإدارية بدقة وسهولة.
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {/* زر التصدير */}
              <button
                type="button"
                onClick={handleExportCSV}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-surface-container-lowest border border-surface-variant/50 text-xs font-semibold text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low transition-all shadow-sm"
              >
                <span className="material-symbols-outlined text-[18px] text-secondary">table_view</span>
                <span>تصدير كـ Excel</span>
              </button>

              {/* زر الطباعة */}
              <button
                type="button"
                onClick={() => window.print()}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-surface-container-lowest border border-surface-variant/50 text-xs font-semibold text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low transition-all shadow-sm"
              >
                <span className="material-symbols-outlined text-[18px] text-primary">print</span>
                <span>طباعة</span>
              </button>

              {/* زر إضافة مهمة جديدة */}
              <button
                type="button"
                onClick={() => {
                  setEditingTask(null);
                  setIsTaskModalOpen(true);
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary-container hover:bg-secondary text-on-primary rounded-xl text-xs font-bold shadow-sm transition-all transform active:scale-95"
              >
                <span className="material-symbols-outlined text-[18px]">add</span>
                <span>مهمة جديدة</span>
              </button>
            </div>
          </div>

          {/* صف بطاقات المؤشرات والإحصاءات */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
            <div className="bg-surface-container-lowest rounded-2xl p-4 shadow-sm border border-surface-variant/40 flex items-center justify-between">
              <div className="flex flex-col">
                <span className="text-xs text-on-surface-variant font-medium">إجمالي المهام</span>
                <span className="text-2xl font-bold text-primary mt-1">{totalCount}</span>
              </div>
              <div className="w-10 h-10 rounded-xl bg-surface-container-low flex items-center justify-center text-primary">
                <span className="material-symbols-outlined text-[22px]">assignment</span>
              </div>
            </div>

            <div className="bg-surface-container-lowest rounded-2xl p-4 shadow-sm border border-surface-variant/40 flex items-center justify-between">
              <div className="flex flex-col">
                <span className="text-xs text-on-surface-variant font-medium">قيد التنفيذ</span>
                <span className="text-2xl font-bold text-amber-600 mt-1">{inProgressCount}</span>
              </div>
              <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600">
                <span className="material-symbols-outlined text-[22px]">pending_actions</span>
              </div>
            </div>

            <div className="bg-surface-container-lowest rounded-2xl p-4 shadow-sm border border-surface-variant/40 flex items-center justify-between">
              <div className="flex flex-col">
                <span className="text-xs text-on-surface-variant font-medium">تم الإنجاز</span>
                <span className="text-2xl font-bold text-secondary mt-1">{completedCount}</span>
              </div>
              <div className="w-10 h-10 rounded-xl bg-secondary-container/50 flex items-center justify-center text-secondary">
                <span className="material-symbols-outlined text-[22px]">task_alt</span>
              </div>
            </div>

            <div className="bg-surface-container-lowest rounded-2xl p-4 shadow-sm border border-surface-variant/40 flex items-center justify-between">
              <div className="flex flex-col">
                <span className="text-xs text-on-surface-variant font-medium">نسبة الإنجاز</span>
                <span className="text-2xl font-bold text-primary mt-1">{completionRate}%</span>
              </div>
              <div className="w-10 h-10 rounded-xl bg-primary-container/10 flex items-center justify-center text-primary font-bold text-xs">
                {completionRate}%
              </div>
            </div>
          </div>

          {/* شريط الفلاتر والتصنيفات */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-surface-container-lowest p-3 rounded-2xl border border-surface-variant/40 shadow-sm">
            {/* تبويبات الحالات */}
            <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0">
              <button
                type="button"
                onClick={() => setStatusFilter('all')}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all whitespace-nowrap ${
                  statusFilter === 'all'
                    ? 'bg-primary-container text-on-primary shadow-sm'
                    : 'text-on-surface-variant hover:bg-surface-container-low'
                }`}
              >
                الكل ({totalCount})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('not_started')}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all whitespace-nowrap ${
                  statusFilter === 'not_started'
                    ? 'bg-primary-container text-on-primary shadow-sm'
                    : 'text-on-surface-variant hover:bg-surface-container-low'
                }`}
              >
                لم يتم ({notStartedCount})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('in_progress')}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all whitespace-nowrap ${
                  statusFilter === 'in_progress'
                    ? 'bg-primary-container text-on-primary shadow-sm'
                    : 'text-on-surface-variant hover:bg-surface-container-low'
                }`}
              >
                قيد التنفيذ ({inProgressCount})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('under_review')}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all whitespace-nowrap ${
                  statusFilter === 'under_review'
                    ? 'bg-primary-container text-on-primary shadow-sm'
                    : 'text-on-surface-variant hover:bg-surface-container-low'
                }`}
              >
                بانتظار المراجعة ({underReviewCount})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('completed')}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all whitespace-nowrap ${
                  statusFilter === 'completed'
                    ? 'bg-primary-container text-on-primary shadow-sm'
                    : 'text-on-surface-variant hover:bg-surface-container-low'
                }`}
              >
                تم الإنجاز ({completedCount})
              </button>
            </div>

            {/* فلتر الأولوية والتصنيف */}
            <div className="flex items-center gap-2">
              <select
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value as any)}
                className="px-2.5 py-1.5 rounded-xl border border-surface-variant text-xs outline-none bg-surface-container-lowest text-on-surface-variant"
              >
                <option value="all">كافة الأولويات</option>
                <option value="urgent">عاجلة جداً</option>
                <option value="high">عالية</option>
                <option value="medium">متوسطة</option>
                <option value="low">منخفضة</option>
              </select>

              {categories.length > 0 && (
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="px-2.5 py-1.5 rounded-xl border border-surface-variant text-xs outline-none bg-surface-container-lowest text-on-surface-variant"
                >
                  <option value="all">كافة التصنيفات</option>
                  {categories.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>

          {/* قائمة المهام */}
          {loading ? (
            <div className="py-20 bg-surface-container-lowest rounded-2xl border border-surface-variant/40 flex flex-col items-center justify-center gap-3">
              <div className="w-9 h-9 border-3 border-primary border-t-transparent rounded-full animate-spin"></div>
              <span className="text-sm text-primary font-bold">جاري تحميل المهام...</span>
              <span className="text-xs text-on-surface-variant">يتم الآن جلب مهامكِ المعتمدة</span>
            </div>
          ) : fetchError ? (
            <div className="py-16 bg-surface-container-lowest rounded-2xl border border-error/20 flex flex-col items-center justify-center p-8 text-center gap-4">
              <div className="w-14 h-14 rounded-full bg-error-container/40 text-error flex items-center justify-center shadow-sm">
                <span className="material-symbols-outlined text-3xl">cloud_off</span>
              </div>
              <div className="flex flex-col gap-1 max-w-md">
                <h3 className="font-bold text-primary text-base">تعذر تحميل المهام حالياً</h3>
                <p className="text-xs text-on-surface-variant">{fetchError}</p>
              </div>
              <button
                type="button"
                onClick={() => fetchMyTasks()}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary hover:bg-secondary text-white rounded-xl text-xs font-bold shadow-md shadow-primary/10 transition-all transform active:scale-95"
              >
                <span className="material-symbols-outlined text-[18px]">refresh</span>
                <span>إعادة المحاولة</span>
              </button>
            </div>
          ) : filteredTasks.length === 0 ? (
            <div className="py-16 bg-surface-container-lowest rounded-2xl border border-surface-variant/40 flex flex-col items-center justify-center p-8 text-center gap-3">
              <span className="material-symbols-outlined text-outline text-5xl">task_alt</span>
              <div className="flex flex-col">
                <h3 className="font-bold text-primary text-base">لا توجد مهام مطابقة</h3>
                <p className="text-xs text-on-surface-variant mt-1">
                  {searchQuery || statusFilter !== 'all' || priorityFilter !== 'all'
                    ? 'جربي تغيير فلاتر البحث أو التصفية.'
                    : 'أحسنتِ! يمكنكِ البدء بمتابعة مهامكِ المسندة إليكِ أو إضافة مهمة شخصية.'}
                </p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {filteredTasks.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  showAssignee={false}
                  onStatusChange={handleStatusChange}
                  onEdit={(t) => {
                    setDetailsTask(t);
                    setIsDetailsModalOpen(true);
                  }}
                  onDelete={(id) => {
                    if (isManager) {
                      setTaskToDelete(id);
                    }
                  }}
                  onOpenDetails={(t) => {
                    setDetailsTask(t);
                    setIsDetailsModalOpen(true);
                  }}
                />
              ))}
            </div>
          )}
        </main>

        {/* مركز تفاصيل المهمة المتكامل */}
        <TaskDetailsModal
          isOpen={isDetailsModalOpen}
          onClose={() => {
            setIsDetailsModalOpen(false);
            setDetailsTask(null);
          }}
          task={detailsTask}
          onTaskUpdated={() => {
            fetchMyTasks();
          }}
        />

        {/* نافذة إضافة / تعديل مهمة */}
        <TaskModal
          isOpen={isTaskModalOpen}
          onClose={() => setIsTaskModalOpen(false)}
          onSave={handleSaveTask}
          initialTask={editingTask}
          isManager={false}
        />

        {/* نافذة تأكيد الحذف */}
        {taskToDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <div className="bg-surface-container-lowest rounded-2xl max-w-sm w-full p-6 shadow-xl border border-outline-variant/30 flex flex-col items-center text-center gap-4 animate-in fade-in zoom-in-95 duration-200">
              <div className="w-12 h-12 rounded-full bg-error-container/30 text-error flex items-center justify-center">
                <span className="material-symbols-outlined text-2xl">delete</span>
              </div>
              <div className="flex flex-col gap-1">
                <h3 className="text-base font-bold text-primary">هل أنتِ متأكدة من حذف هذه المهمة؟</h3>
                <p className="text-xs text-on-surface-variant">لا يمكن التراجع عن هذا الإجراء بعد الحذف.</p>
              </div>
              <div className="flex items-center gap-2 w-full pt-2">
                <button
                  type="button"
                  onClick={() => setTaskToDelete(null)}
                  className="flex-1 py-2 px-4 rounded-xl border border-surface-variant text-xs font-semibold text-on-surface-variant hover:bg-surface-container transition-colors"
                >
                  إلغاء
                </button>
                <button
                  type="button"
                  onClick={confirmDeleteTask}
                  className="flex-1 py-2 px-4 rounded-xl bg-error hover:bg-red-700 text-white text-xs font-semibold shadow-sm transition-colors"
                >
                  تأكيد الحذف
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AuthGuard>
  );
}
