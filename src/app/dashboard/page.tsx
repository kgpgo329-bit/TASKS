'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { AuthGuard } from '@/components/AuthGuard';
import { Sidebar } from '@/components/Sidebar';
import { Header } from '@/components/Header';
import { TaskCard } from '@/components/TaskCard';
import { TaskModal } from '@/components/TaskModal';
import { useAuth } from '@/contexts/AuthContext';
import { getAllTasks, getAllProfiles, updateTask, deleteTask, createTask } from '@/lib/firebase/db';
import { Task, TaskStatus, Profile } from '@/lib/firebase/types';
export default function DashboardPage() {
  const { profile } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [employees, setEmployees] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  const fetchDashboardData = async () => {
    setLoading(true);

    try {
      const [tasksData, profilesData] = await Promise.all([getAllTasks(), getAllProfiles()]);
      const tasksWithProfiles = tasksData.map((t) => ({
        ...t,
        profiles: profilesData.find((e) => e.id === t.user_id) || t.profiles,
      }));

      setTasks(tasksWithProfiles);
      setEmployees(profilesData);
    } catch (err) {
      console.error('Exception fetching dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const handleStatusChange = async (taskId: string, newStatus: TaskStatus) => {
    try {
      setTasks((prev) =>
        prev.map((t) => (t.id === taskId ? { ...t, status: newStatus } : t))
      );

      await updateTask(taskId, { status: newStatus });
      fetchDashboardData();
    } catch (err) {
      console.error('Exception updating status:', err);
      fetchDashboardData();
    }
  };

  // إحصائيات عامة
  const totalTasks = tasks.length;
  const completedTasks = tasks.filter((t) => t.status === 'completed').length;
  const inProgressTasks = tasks.filter((t) => t.status === 'in_progress').length;
  const notStartedTasks = tasks.filter((t) => t.status === 'not_started').length;
  const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
  const activeEmployees = employees.filter((e) => e.is_active).length;

  // المهام العاجلة اليوم
  const urgentTasks = tasks.filter(
    (t) => (t.priority === 'urgent' || t.priority === 'high') && t.status !== 'completed'
  );

  return (
    <AuthGuard requireRole="manager">
      <div className="min-h-screen bg-background">
        <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />

        <Header
          onOpenMobileMenu={() => setIsSidebarOpen(true)}
          onOpenNewTaskModal={() => {
            setSelectedTask(null);
            setIsTaskModalOpen(true);
          }}
          title="لوحة المتابعة الإدارية"
        />

        <main className="lg:pr-72 pt-20 p-4 lg:p-space-xl flex flex-col gap-6">
          {/* بانر الترحيب ونسبة الإنجاز الأسبوعية (مطابق لتصميم stitch_/_2) */}
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-l from-primary-container via-primary to-primary text-white p-6 lg:p-8 shadow-md">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
              <div className="flex flex-col gap-2 max-w-2xl">
                <div className="inline-flex items-center gap-1.5 self-start px-3 py-1 rounded-full bg-white/10 text-secondary-fixed text-xs font-semibold backdrop-blur-sm">
                  <span className="material-symbols-outlined text-[16px]">verified</span>
                  <span>لوحة المتابعة الإدارية والدعوية</span>
                </div>
                <h1 className="text-xl lg:text-3xl font-bold tracking-tight">
                  مرحباً {profile?.name || 'المديرة'} 👋، أسبوع حافل بالإنجاز والتميز في برامج الجاليات
                </h1>
                <p className="text-xs lg:text-sm text-primary-fixed-dim/90 flex items-center gap-1">
                  <span className="material-symbols-outlined text-[16px] text-tertiary-fixed">format_quote</span>
                  <span>نظمي مهام فريق العمل وتابعي الإنجازات اليومية لدعم رسالة الجمعية</span>
                </p>
              </div>

              {/* بطاقة النسبة المئوية */}
              <div className="flex flex-col gap-2 bg-black/20 backdrop-blur-md p-4 rounded-2xl min-w-[260px] border border-white/10">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-white/90">معدل الإنجاز الإجمالي</span>
                  <span className="text-2xl font-bold text-tertiary-fixed">{completionRate}%</span>
                </div>
                <div className="w-full h-2.5 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-secondary-fixed rounded-full transition-all duration-700"
                    style={{ width: `${completionRate}%` }}
                  ></div>
                </div>
                <div className="flex items-center justify-between text-[11px] text-white/70 pt-1">
                  <span>تم إنجاز {completedTasks} من {totalTasks} مهمة</span>
                  <span>{activeEmployees} موظفة نشطة</span>
                </div>
              </div>
            </div>
          </div>

          {/* صف بطاقات المؤشرات (KPIs) */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
            <div className="bg-surface-container-lowest rounded-2xl p-4 shadow-sm border border-surface-variant/40 flex items-center justify-between">
              <div className="flex flex-col">
                <span className="text-xs text-on-surface-variant font-medium">مهام الجمعية</span>
                <span className="text-2xl font-bold text-primary mt-1">{totalTasks}</span>
              </div>
              <div className="w-10 h-10 rounded-xl bg-surface-container-low flex items-center justify-center text-primary">
                <span className="material-symbols-outlined text-[22px]">format_list_bulleted</span>
              </div>
            </div>

            <div className="bg-surface-container-lowest rounded-2xl p-4 shadow-sm border border-surface-variant/40 flex items-center justify-between">
              <div className="flex flex-col">
                <span className="text-xs text-on-surface-variant font-medium">قيد التنفيذ</span>
                <span className="text-2xl font-bold text-amber-600 mt-1">{inProgressTasks}</span>
              </div>
              <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600">
                <span className="material-symbols-outlined text-[22px]">pending_actions</span>
              </div>
            </div>

            <div className="bg-surface-container-lowest rounded-2xl p-4 shadow-sm border border-surface-variant/40 flex items-center justify-between">
              <div className="flex flex-col">
                <span className="text-xs text-on-surface-variant font-medium">المهام المنجزة</span>
                <span className="text-2xl font-bold text-secondary mt-1">{completedTasks}</span>
              </div>
              <div className="w-10 h-10 rounded-xl bg-secondary-container/50 flex items-center justify-center text-secondary">
                <span className="material-symbols-outlined text-[22px]">verified</span>
              </div>
            </div>

            <div className="bg-surface-container-lowest rounded-2xl p-4 shadow-sm border border-surface-variant/40 flex items-center justify-between">
              <div className="flex flex-col">
                <span className="text-xs text-on-surface-variant font-medium">فريق العمل</span>
                <span className="text-2xl font-bold text-primary mt-1">{employees.length}</span>
              </div>
              <div className="w-10 h-10 rounded-xl bg-surface-container-low flex items-center justify-center text-primary">
                <span className="material-symbols-outlined text-[22px]">group</span>
              </div>
            </div>
          </div>

          {/* محتوى اللوحة الرئيسي: قسمان متجاوران */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* العمود الأيمن: المهام العاجلة لليوم (يشغل عمودين) */}
            <div className="lg:col-span-2 flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-error text-[22px]">priority_high</span>
                  <h2 className="text-base font-bold text-primary">المهام العاجلة والمهمة</h2>
                  <span className="px-2 py-0.5 rounded-full bg-error-container text-on-error-container text-xs font-bold">
                    {urgentTasks.length}
                  </span>
                </div>
                <Link
                  href="/all-tasks"
                  className="text-xs font-semibold text-secondary hover:text-primary transition-colors flex items-center gap-1"
                >
                  <span>عرض جميع المهام</span>
                  <span className="material-symbols-outlined text-[16px]">chevron_left</span>
                </Link>
              </div>

              {loading ? (
                <div className="py-12 bg-surface-container-lowest rounded-2xl border border-surface-variant/40 flex items-center justify-center">
                  <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                </div>
              ) : urgentTasks.length === 0 ? (
                <div className="bg-surface-container-lowest rounded-2xl p-8 border border-surface-variant/40 text-center flex flex-col items-center gap-2">
                  <span className="material-symbols-outlined text-secondary text-4xl">check_circle</span>
                  <p className="text-xs font-semibold text-primary">لا توجد مهام عاجلة معلقة حالياً</p>
                  <p className="text-[11px] text-on-surface-variant">جميع المهام الحرجة تم إنجازها بنجاح.</p>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {urgentTasks.slice(0, 5).map((t) => (
                    <TaskCard
                      key={t.id}
                      task={t}
                      showAssignee={true}
                      onStatusChange={handleStatusChange}
                      onEdit={(task) => {
                        setSelectedTask(task);
                        setIsTaskModalOpen(true);
                      }}
                      onDelete={async (taskId) => {
                        await deleteTask(taskId);
                        fetchDashboardData();
                      }}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* العمود الأيسر: إدارة الموظفات السريعة والتقويم */}
            <div className="flex flex-col gap-4">
              <div className="bg-surface-container-lowest rounded-2xl p-5 border border-surface-variant/40 shadow-sm flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-primary">إحصائيات الموظفات</h3>
                  <Link
                    href="/employees"
                    className="text-xs font-semibold text-secondary hover:underline"
                  >
                    إدارة الفريق
                  </Link>
                </div>

                <div className="flex flex-col gap-2.5">
                  {employees.slice(0, 5).map((emp) => {
                    const empTasks = tasks.filter((t) => t.user_id === emp.id);
                    const empCompleted = empTasks.filter((t) => t.status === 'completed').length;
                    const empRate = empTasks.length > 0 ? Math.round((empCompleted / empTasks.length) * 100) : 0;

                    return (
                      <div
                        key={emp.id}
                        className="p-2.5 rounded-xl bg-surface-container-low flex items-center justify-between text-xs"
                      >
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-primary text-white flex items-center justify-center font-bold text-xs">
                            {emp.name.charAt(0)}
                          </div>
                          <div className="flex flex-col">
                            <span className="font-semibold text-primary">{emp.name}</span>
                            <span className="text-[10px] text-on-surface-variant">
                              {emp.role === 'manager' ? 'مديرة' : 'موظفة'}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-secondary">{empCompleted}/{empTasks.length}</span>
                          <span className="px-1.5 py-0.5 rounded text-[10px] bg-surface-container text-on-surface-variant">
                            {empRate}%
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <Link
                  href="/employees"
                  className="w-full py-2 bg-primary/10 hover:bg-primary text-primary hover:text-white rounded-xl text-xs font-bold text-center transition-all"
                >
                  + إدارة وإضافة الموظفات
                </Link>
              </div>
            </div>
          </div>
        </main>

        <TaskModal
          isOpen={isTaskModalOpen}
          onClose={() => setIsTaskModalOpen(false)}
          onSave={async (taskData) => {
            if (selectedTask) {
              await updateTask(selectedTask.id, {
                title: taskData.title,
                description: taskData.description,
                status: taskData.status,
                priority: taskData.priority,
                due_date: taskData.due_date,
                category: taskData.category,
                user_id: taskData.user_id || selectedTask.user_id,
              });
            } else {
              await createTask({
                title: taskData.title,
                description: taskData.description,
                status: taskData.status,
                priority: taskData.priority,
                due_date: taskData.due_date,
                category: taskData.category,
                user_id: taskData.user_id || profile?.id || '',
              });
            }
            fetchDashboardData();
          }}
          initialTask={selectedTask}
          employeesList={employees}
          isManager={true}
        />
      </div>
    </AuthGuard>
  );
}
