'use client';

import React, { useState, useEffect } from 'react';
import { AuthGuard } from '@/components/AuthGuard';
import { Sidebar } from '@/components/Sidebar';
import { Header } from '@/components/Header';
import { TaskCard } from '@/components/TaskCard';
import { TaskModal } from '@/components/TaskModal';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase/client';
import { Task, TaskStatus, TaskPriority, Profile } from '@/lib/supabase/types';
import { INITIAL_DEMO_TASKS, INITIAL_DEMO_EMPLOYEES } from '@/lib/mockData';

export default function AllTasksPage() {
  const { profile, isDemoMode } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [employees, setEmployees] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | TaskStatus>('all');
  const [priorityFilter, setPriorityFilter] = useState<'all' | TaskPriority>('all');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [taskToDelete, setTaskToDelete] = useState<string | null>(null);

  const fetchAllData = async () => {
    setLoading(true);

    if (isDemoMode) {
      try {
        const savedTasks = typeof window !== 'undefined' ? localStorage.getItem('mahamee_demo_tasks') : null;
        const allTasks: Task[] = savedTasks ? JSON.parse(savedTasks) : INITIAL_DEMO_TASKS;
        if (!savedTasks && typeof window !== 'undefined') {
          localStorage.setItem('mahamee_demo_tasks', JSON.stringify(INITIAL_DEMO_TASKS));
        }

        const savedEmps = typeof window !== 'undefined' ? localStorage.getItem('mahamee_demo_employees') : null;
        const allEmps: Profile[] = savedEmps ? JSON.parse(savedEmps) : INITIAL_DEMO_EMPLOYEES;
        if (!savedEmps && typeof window !== 'undefined') {
          localStorage.setItem('mahamee_demo_employees', JSON.stringify(INITIAL_DEMO_EMPLOYEES));
        }

        const tasksWithProfiles = allTasks.map((t) => ({
          ...t,
          profiles: allEmps.find((e) => e.id === t.user_id) || t.profiles,
        }));

        setTasks(tasksWithProfiles);
        setEmployees(allEmps);
      } catch (e) {
        console.error('Error loading demo all-tasks', e);
      } finally {
        setLoading(false);
      }
      return;
    }

    try {
      // جلب جميع المهام مع بيانات الموظفات
      const { data: tasksData, error: tasksError } = await supabase
        .from('tasks')
        .select(`
          *,
          profiles:user_id (
            id,
            name,
            email,
            role,
            is_active
          )
        `)
        .order('created_at', { ascending: false });

      if (tasksError) console.error('Error fetching tasks:', tasksError);
      else setTasks((tasksData || []) as Task[]);

      // جلب قائمة الموظفات
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .order('name');

      if (profilesError) console.error('Error fetching profiles:', profilesError);
      else setEmployees((profilesData || []) as Profile[]);
    } catch (err) {
      console.error('Exception fetching tasks:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllData();
  }, [isDemoMode]);

  const handleStatusChange = async (taskId: string, newStatus: TaskStatus) => {
    try {
      setTasks((prev) =>
        prev.map((t) => (t.id === taskId ? { ...t, status: newStatus } : t))
      );

      if (isDemoMode) {
        const saved = localStorage.getItem('mahamee_demo_tasks');
        const all: Task[] = saved ? JSON.parse(saved) : INITIAL_DEMO_TASKS;
        const updated = all.map((t) => (t.id === taskId ? { ...t, status: newStatus } : t));
        localStorage.setItem('mahamee_demo_tasks', JSON.stringify(updated));
        fetchAllData();
        return;
      }

      const { error } = await supabase
        .from('tasks')
        .update({ status: newStatus })
        .eq('id', taskId);

      if (error) {
        console.error('Error updating task status:', error);
        fetchAllData();
      }
    } catch (err) {
      console.error('Exception updating task status:', err);
      fetchAllData();
    }
  };

  const handleSaveTask = async (taskData: {
    title: string;
    description: string;
    status: TaskStatus;
    priority: TaskPriority;
    due_date: string | null;
    category: string;
    user_id?: string;
  }) => {
    if (isDemoMode) {
      const saved = localStorage.getItem('mahamee_demo_tasks');
      const all: Task[] = saved ? JSON.parse(saved) : INITIAL_DEMO_TASKS;
      if (editingTask) {
        const updated = all.map((t) =>
          t.id === editingTask.id
            ? { ...t, ...taskData, updated_at: new Date().toISOString() }
            : t
        );
        localStorage.setItem('mahamee_demo_tasks', JSON.stringify(updated));
      } else {
        const newTask: Task = {
          id: `task-${Date.now()}`,
          title: taskData.title,
          description: taskData.description,
          status: taskData.status,
          priority: taskData.priority,
          due_date: taskData.due_date,
          category: taskData.category,
          user_id: taskData.user_id || profile?.id || 'demo-manager-id',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        localStorage.setItem('mahamee_demo_tasks', JSON.stringify([newTask, ...all]));
      }
      fetchAllData();
      return;
    }

    if (editingTask) {
      const { error } = await supabase
        .from('tasks')
        .update({
          title: taskData.title,
          description: taskData.description,
          status: taskData.status,
          priority: taskData.priority,
          due_date: taskData.due_date,
          category: taskData.category,
          user_id: taskData.user_id || editingTask.user_id,
        })
        .eq('id', editingTask.id);

      if (error) throw error;
    } else {
      const { error } = await supabase.from('tasks').insert({
        title: taskData.title,
        description: taskData.description,
        status: taskData.status,
        priority: taskData.priority,
        due_date: taskData.due_date,
        category: taskData.category,
        user_id: taskData.user_id || profile?.id,
      });

      if (error) throw error;
    }
    fetchAllData();
  };

  const confirmDeleteTask = async () => {
    if (!taskToDelete) return;

    if (isDemoMode) {
      const saved = localStorage.getItem('mahamee_demo_tasks');
      const all: Task[] = saved ? JSON.parse(saved) : INITIAL_DEMO_TASKS;
      const updated = all.filter((t) => t.id !== taskToDelete);
      localStorage.setItem('mahamee_demo_tasks', JSON.stringify(updated));
      setTasks((prev) => prev.filter((t) => t.id !== taskToDelete));
      setTaskToDelete(null);
      return;
    }

    try {
      const { error } = await supabase.from('tasks').delete().eq('id', taskToDelete);
      if (error) throw error;
      setTasks((prev) => prev.filter((t) => t.id !== taskToDelete));
      setTaskToDelete(null);
    } catch (err) {
      console.error('Error deleting task:', err);
    }
  };

  // تصدير جميع المهام إلى Excel/CSV
  const handleExportCSV = () => {
    if (tasks.length === 0) return;
    const headers = ['عنوان المهمة', 'الموظفة المكلفة', 'الحالة', 'الأولوية', 'التصنيف', 'تاريخ الاستحقاق', 'الوصف'];
    const rows = tasks.map((t) => [
      `"${t.title.replace(/"/g, '""')}"`,
      `"${t.profiles?.name || 'غير محدد'}"`,
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
    link.setAttribute('download', `جميع_مهام_الجمعية_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // تصفية المهام
  const filteredTasks = tasks.filter((t) => {
    const matchesSearch =
      t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (t.description && t.description.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (t.profiles?.name && t.profiles.name.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesEmployee = selectedEmployeeId === 'all' || t.user_id === selectedEmployeeId;
    const matchesStatus = statusFilter === 'all' || t.status === statusFilter;
    const matchesPriority = priorityFilter === 'all' || t.priority === priorityFilter;

    return matchesSearch && matchesEmployee && matchesStatus && matchesPriority;
  });

  return (
    <AuthGuard requireRole="manager">
      <div className="min-h-screen bg-background">
        <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />

        <Header
          onOpenMobileMenu={() => setIsSidebarOpen(true)}
          onOpenNewTaskModal={() => {
            setEditingTask(null);
            setIsTaskModalOpen(true);
          }}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
        />

        <main className="lg:pr-72 pt-20 p-4 lg:p-space-xl flex flex-col gap-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <h1 className="text-2xl lg:text-3xl font-bold text-primary">جميع المهام (لوحة المديرة)</h1>
                <span className="px-2.5 py-0.5 rounded-full bg-secondary-container text-on-secondary-container text-xs font-semibold">
                  {tasks.length} مهمة إجمالية
                </span>
              </div>
              <p className="text-xs lg:text-sm text-on-surface-variant">
                متابعة شاملة لمهام جميع الموظفات والبرامج الدعوية للجمعية مع اسم الموظفة المكلفة.
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={handleExportCSV}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-surface-container-lowest border border-surface-variant/50 text-xs font-semibold text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low transition-all shadow-sm"
              >
                <span className="material-symbols-outlined text-[18px] text-secondary">table_view</span>
                <span>تصدير Excel</span>
              </button>

              <button
                type="button"
                onClick={() => window.print()}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-surface-container-lowest border border-surface-variant/50 text-xs font-semibold text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low transition-all shadow-sm"
              >
                <span className="material-symbols-outlined text-[18px] text-primary">print</span>
                <span>طباعة</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setEditingTask(null);
                  setIsTaskModalOpen(true);
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary-container hover:bg-secondary text-on-primary rounded-xl text-xs font-bold shadow-sm transition-all transform active:scale-95"
              >
                <span className="material-symbols-outlined text-[18px]">add</span>
                <span>إضافة مهمة لموظفة</span>
              </button>
            </div>
          </div>

          {/* شريط الفلاتر المتقدم الخاص بالمديرة */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-surface-container-lowest p-4 rounded-2xl border border-surface-variant/40 shadow-sm">
            {/* فلتر اختيار الموظفة */}
            <div>
              <label className="block text-xs font-semibold text-primary mb-1">تصفية حسب الموظفة:</label>
              <select
                value={selectedEmployeeId}
                onChange={(e) => setSelectedEmployeeId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-surface-variant text-xs outline-none bg-surface-container-lowest text-on-surface font-medium"
              >
                <option value="all">كافة الموظفات ({employees.length})</option>
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.name} ({emp.role === 'manager' ? 'مديرة' : 'موظفة'})
                  </option>
                ))}
              </select>
            </div>

            {/* فلتر الحالة */}
            <div>
              <label className="block text-xs font-semibold text-primary mb-1">الحالة:</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="w-full px-3 py-2 rounded-xl border border-surface-variant text-xs outline-none bg-surface-container-lowest text-on-surface font-medium"
              >
                <option value="all">كافة الحالات</option>
                <option value="not_started">لم يتم</option>
                <option value="in_progress">قيد التنفيذ</option>
                <option value="completed">تم الإنجاز</option>
              </select>
            </div>

            {/* فلتر الأولوية */}
            <div>
              <label className="block text-xs font-semibold text-primary mb-1">الأولوية:</label>
              <select
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value as any)}
                className="w-full px-3 py-2 rounded-xl border border-surface-variant text-xs outline-none bg-surface-container-lowest text-on-surface font-medium"
              >
                <option value="all">كافة الأولويات</option>
                <option value="urgent">عاجلة جداً</option>
                <option value="high">عالية</option>
                <option value="medium">متوسطة</option>
                <option value="low">منخفضة</option>
              </select>
            </div>
          </div>

          {/* قائمة المهام مع إظهار الموظفة المكلفة */}
          {loading ? (
            <div className="py-16 flex flex-col items-center justify-center gap-3">
              <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin"></div>
              <span className="text-xs text-outline font-medium">جاري جلب مهام الجمعية...</span>
            </div>
          ) : filteredTasks.length === 0 ? (
            <div className="py-16 bg-surface-container-lowest rounded-2xl border border-surface-variant/40 flex flex-col items-center justify-center p-8 text-center gap-3">
              <span className="material-symbols-outlined text-outline text-5xl">folder_open</span>
              <h3 className="font-bold text-primary text-base">لا توجد مهام مطابقة للفلاتر الحالية</h3>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {filteredTasks.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  showAssignee={true} // دائماً يظهر اسم الموظفة للمديرة
                  onStatusChange={handleStatusChange}
                  onEdit={(t) => {
                    setEditingTask(t);
                    setIsTaskModalOpen(true);
                  }}
                  onDelete={(id) => setTaskToDelete(id)}
                />
              ))}
            </div>
          )}
        </main>

        <TaskModal
          isOpen={isTaskModalOpen}
          onClose={() => setIsTaskModalOpen(false)}
          onSave={handleSaveTask}
          initialTask={editingTask}
          employeesList={employees}
          isManager={true}
        />

        {taskToDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <div className="bg-surface-container-lowest rounded-2xl max-w-sm w-full p-6 shadow-xl border border-outline-variant/30 flex flex-col items-center text-center gap-4">
              <div className="w-12 h-12 rounded-full bg-error-container/30 text-error flex items-center justify-center">
                <span className="material-symbols-outlined text-2xl">delete</span>
              </div>
              <div className="flex flex-col gap-1">
                <h3 className="text-base font-bold text-primary">هل أنتِ متأكدة من حذف هذه المهمة؟</h3>
                <p className="text-xs text-on-surface-variant">سيتم حذف المهمة بشكل نهائي من حساب الموظفة.</p>
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
