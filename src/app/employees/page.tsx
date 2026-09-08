'use client';

import React, { useState, useEffect } from 'react';
import { AuthGuard } from '@/components/AuthGuard';
import { Sidebar } from '@/components/Sidebar';
import { Header } from '@/components/Header';
import { EmployeeModal } from '@/components/EmployeeModal';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase/client';
import { Profile, UserRole, Task } from '@/lib/supabase/types';
import { INITIAL_DEMO_EMPLOYEES, INITIAL_DEMO_TASKS } from '@/lib/mockData';

interface EmployeeWithStats extends Profile {
  total_tasks?: number;
  completed_tasks?: number;
  in_progress_tasks?: number;
}

export default function EmployeesPage() {
  const { user, isDemoMode } = useAuth();
  const [employees, setEmployees] = useState<EmployeeWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<Profile | null>(null);
  const [employeeToDelete, setEmployeeToDelete] = useState<Profile | null>(null);
  const [actionError, setActionError] = useState('');
  const [actionSuccess, setActionSuccess] = useState('');

  // دالة مساعدة للحصول على JWT الخاص بالمديرة للطلبات الإدارية الآمنة
  const getAuthToken = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token || '';
  };

  const fetchEmployees = async () => {
    setLoading(true);
    setActionError('');

    if (isDemoMode) {
      try {
        const savedEmps = typeof window !== 'undefined' ? localStorage.getItem('mahamee_demo_employees') : null;
        const allEmps: Profile[] = savedEmps ? JSON.parse(savedEmps) : INITIAL_DEMO_EMPLOYEES;
        if (!savedEmps && typeof window !== 'undefined') {
          localStorage.setItem('mahamee_demo_employees', JSON.stringify(INITIAL_DEMO_EMPLOYEES));
        }

        const savedTasks = typeof window !== 'undefined' ? localStorage.getItem('mahamee_demo_tasks') : null;
        const allTasks: Task[] = savedTasks ? JSON.parse(savedTasks) : INITIAL_DEMO_TASKS;

        const empsWithStats: EmployeeWithStats[] = allEmps.map((emp) => {
          const empTasks = allTasks.filter((t) => t.user_id === emp.id);
          return {
            ...emp,
            total_tasks: empTasks.length,
            completed_tasks: empTasks.filter((t) => t.status === 'completed').length,
            in_progress_tasks: empTasks.filter((t) => t.status === 'in_progress').length,
          };
        });

        setEmployees(empsWithStats);
      } catch (e) {
        console.error('Error loading demo employees', e);
      } finally {
        setLoading(false);
      }
      return;
    }

    try {
      const token = await getAuthToken();
      const res = await fetch('/api/admin/users', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'فشل جلب قائمة الموظفات');
      }

      setEmployees(data.profiles || []);
    } catch (err: any) {
      console.error('Error fetching employees:', err);
      setActionError(err.message || 'حدث خطأ في تحميل قائمة الموظفات');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEmployees();
  }, [isDemoMode]);

  // حفظ موظفة جديدة أو تعديل موظفة سابقة
  const handleSaveEmployee = async (employeeData: {
    id?: string;
    name: string;
    email?: string;
    password?: string;
    role: UserRole;
    is_active: boolean;
  }) => {
    setActionError('');
    setActionSuccess('');

    if (isDemoMode) {
      const saved = localStorage.getItem('mahamee_demo_employees');
      const all: Profile[] = saved ? JSON.parse(saved) : INITIAL_DEMO_EMPLOYEES;
      if (employeeData.id) {
        const updated = all.map((e) =>
          e.id === employeeData.id
            ? { ...e, name: employeeData.name, role: employeeData.role, is_active: employeeData.is_active }
            : e
        );
        localStorage.setItem('mahamee_demo_employees', JSON.stringify(updated));
        setActionSuccess('تم تحديث بيانات الموظفة بنجاح');
      } else {
        const newEmp: Profile = {
          id: `demo-emp-${Date.now()}`,
          name: employeeData.name,
          email: employeeData.email || 'employee@mahamee.local',
          role: employeeData.role,
          is_active: employeeData.is_active,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        localStorage.setItem('mahamee_demo_employees', JSON.stringify([...all, newEmp]));
        setActionSuccess('تم إنشاء حساب الموظفة بنجاح ويمكنها الآن الدخول ببياناتها');
      }
      fetchEmployees();
      return;
    }

    const token = await getAuthToken();
    const isEdit = Boolean(employeeData.id);

    const res = await fetch('/api/admin/users', {
      method: isEdit ? 'PUT' : 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(employeeData),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'تعذر حفظ بيانات الموظفة');
    }

    setActionSuccess(isEdit ? 'تم تحديث بيانات الموظفة بنجاح' : 'تم إضافة الموظفة وإنشاء الحساب بنجاح');
    fetchEmployees();
  };

  // تبديل حالة الحساب (تعطيل / تفعيل سريع)
  const handleToggleStatus = async (employee: EmployeeWithStats) => {
    setActionError('');
    setActionSuccess('');

    if (isDemoMode) {
      const saved = localStorage.getItem('mahamee_demo_employees');
      const all: Profile[] = saved ? JSON.parse(saved) : INITIAL_DEMO_EMPLOYEES;
      const updated = all.map((e) =>
        e.id === employee.id ? { ...e, is_active: !e.is_active } : e
      );
      localStorage.setItem('mahamee_demo_employees', JSON.stringify(updated));
      setActionSuccess(
        !employee.is_active
          ? `تم تفعيل حساب الموظفة (${employee.name}) بنجاح`
          : `تم تعطيل حساب الموظفة (${employee.name}) ومنعها من الدخول`
      );
      fetchEmployees();
      return;
    }

    try {
      const token = await getAuthToken();
      const res = await fetch('/api/admin/users', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          id: employee.id,
          is_active: !employee.is_active,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'تعذر تغيير حالة الحساب');

      setActionSuccess(
        !employee.is_active
          ? `تم تفعيل حساب الموظفة (${employee.name}) بنجاح`
          : `تم تعطيل حساب الموظفة (${employee.name}) ومنعها من الدخول`
      );
      fetchEmployees();
    } catch (err: any) {
      setActionError(err.message);
    }
  };

  // تأكيد حذف الموظفة
  const confirmDeleteEmployee = async () => {
    if (!employeeToDelete) return;
    setActionError('');
    setActionSuccess('');

    if (isDemoMode) {
      const saved = localStorage.getItem('mahamee_demo_employees');
      const all: Profile[] = saved ? JSON.parse(saved) : INITIAL_DEMO_EMPLOYEES;
      const updated = all.filter((e) => e.id !== employeeToDelete.id);
      localStorage.setItem('mahamee_demo_employees', JSON.stringify(updated));
      setActionSuccess(`تم حذف حساب الموظفة (${employeeToDelete.name}) بنجاح`);
      setEmployeeToDelete(null);
      fetchEmployees();
      return;
    }

    try {
      const token = await getAuthToken();
      const res = await fetch(`/api/admin/users?id=${employeeToDelete.id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'تعذر حذف الموظفة');

      setActionSuccess(`تم حذف حساب الموظفة (${employeeToDelete.name}) بنجاح`);
      setEmployeeToDelete(null);
      fetchEmployees();
    } catch (err: any) {
      setActionError(err.message);
    }
  };

  const filteredEmployees = employees.filter(
    (e) =>
      e.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <AuthGuard requireRole="manager">
      <div className="min-h-screen bg-background">
        <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />

        <Header
          onOpenMobileMenu={() => setIsSidebarOpen(true)}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          title="إدارة الموظفات"
        />

        <main className="lg:pr-72 pt-20 p-4 lg:p-space-xl flex flex-col gap-6">
          {/* رأس الصفحة مع زر إضافة موظفة */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <h1 className="text-2xl lg:text-3xl font-bold text-primary">إدارة الموظفات</h1>
                <span className="px-2.5 py-0.5 rounded-full bg-secondary-container text-on-secondary-container text-xs font-semibold">
                  {employees.length} مسجلة
                </span>
              </div>
              <p className="text-xs lg:text-sm text-on-surface-variant">
                لوحة حصرية للمديرة لإضافة، تعديل، تعطيل، وحذف حسابات الموظفات ومتابعة نشاطهن.
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                setSelectedEmployee(null);
                setIsModalOpen(true);
              }}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary hover:bg-secondary text-white rounded-xl text-xs font-bold shadow-md shadow-primary/10 transition-all transform active:scale-95"
            >
              <span className="material-symbols-outlined text-[20px]">person_add</span>
              <span>إضافة موظفة جديدة</span>
            </button>
          </div>

          {/* تنبيهات النجاح والخطأ */}
          {actionSuccess && (
            <div className="p-3.5 rounded-2xl bg-secondary-container/40 border border-secondary/30 text-secondary text-xs flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[20px]">check_circle</span>
                <span>{actionSuccess}</span>
              </div>
              <button onClick={() => setActionSuccess('')} className="p-1 hover:opacity-75">
                <span className="material-symbols-outlined text-[16px]">close</span>
              </button>
            </div>
          )}

          {actionError && (
            <div className="p-3.5 rounded-2xl bg-error-container/30 border border-error/20 text-on-error-container text-xs flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[20px] text-error">error</span>
                <span>{actionError}</span>
              </div>
              <button onClick={() => setActionError('')} className="p-1 hover:opacity-75">
                <span className="material-symbols-outlined text-[16px]">close</span>
              </button>
            </div>
          )}

          {/* جدول وبطاقات الموظفات */}
          {loading ? (
            <div className="py-16 flex flex-col items-center justify-center gap-3">
              <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin"></div>
              <span className="text-xs text-outline font-medium">جاري تحميل بيانات الموظفات...</span>
            </div>
          ) : filteredEmployees.length === 0 ? (
            <div className="py-16 bg-surface-container-lowest rounded-2xl border border-surface-variant/40 flex flex-col items-center justify-center p-8 text-center gap-3">
              <span className="material-symbols-outlined text-outline text-5xl">group_off</span>
              <h3 className="font-bold text-primary text-base">لا توجد نتائج مطابقة</h3>
              <p className="text-xs text-on-surface-variant">لم نتمكن من العثور على أي موظفة تطابق كلمة البحث.</p>
            </div>
          ) : (
            <div className="bg-surface-container-lowest rounded-2xl border border-surface-variant/40 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead className="bg-surface-container-low text-primary font-bold border-b border-surface-variant/40">
                    <tr>
                      <th className="py-3.5 px-4">اسم الموظفة</th>
                      <th className="py-3.5 px-4">البريد الإلكتروني</th>
                      <th className="py-3.5 px-4">الدور</th>
                      <th className="py-3.5 px-4">حالة الحساب</th>
                      <th className="py-3.5 px-4">المهام (منجزة / كل)</th>
                      <th className="py-3.5 px-4 text-center">الإجراءات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-variant/30">
                    {filteredEmployees.map((emp) => {
                      const isCurrentUser = emp.id === user?.id;

                      return (
                        <tr
                          key={emp.id}
                          className="hover:bg-surface-container-low/40 transition-colors"
                        >
                          {/* الاسم */}
                          <td className="py-3.5 px-4 font-semibold text-on-surface">
                            <div className="flex items-center gap-2.5">
                              <div className="w-8 h-8 rounded-full bg-primary-container text-on-primary flex items-center justify-center font-bold text-xs shadow-sm">
                                {emp.name.charAt(0)}
                              </div>
                              <div className="flex flex-col">
                                <span className="text-primary font-bold">{emp.name}</span>
                                {isCurrentUser && (
                                  <span className="text-[10px] text-secondary font-medium">
                                    (حسابكِ الحالي)
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>

                          {/* البريد الإلكتروني */}
                          <td className="py-3.5 px-4 text-on-surface-variant font-mono text-[11px]" dir="ltr">
                            {emp.email}
                          </td>

                          {/* الدور */}
                          <td className="py-3.5 px-4">
                            <span
                              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full font-semibold text-[11px] ${
                                emp.role === 'manager'
                                  ? 'bg-primary-container text-on-primary'
                                  : 'bg-surface-container text-on-surface-variant'
                              }`}
                            >
                              <span className="material-symbols-outlined text-[14px]">
                                {emp.role === 'manager' ? 'shield_person' : 'badge'}
                              </span>
                              <span>{emp.role === 'manager' ? 'مديرة' : 'موظفة'}</span>
                            </span>
                          </td>

                          {/* حالة الحساب: نشط / غير نشط */}
                          <td className="py-3.5 px-4">
                            <span
                              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full font-semibold text-[11px] ${
                                emp.is_active
                                  ? 'bg-secondary-container text-on-secondary-container'
                                  : 'bg-error-container text-on-error-container'
                              }`}
                            >
                              <span
                                className={`w-1.5 h-1.5 rounded-full ${
                                  emp.is_active ? 'bg-secondary' : 'bg-error'
                                }`}
                              ></span>
                              <span>{emp.is_active ? 'نشط' : 'معطل'}</span>
                            </span>
                          </td>

                          {/* إحصائيات المهام */}
                          <td className="py-3.5 px-4">
                            <span className="font-semibold text-primary">
                              {emp.completed_tasks ?? 0}
                            </span>
                            <span className="text-outline"> / {emp.total_tasks ?? 0}</span>
                          </td>

                          {/* أزرار الإجراءات */}
                          <td className="py-3.5 px-4">
                            <div className="flex items-center justify-center gap-1">
                              {/* زر التعديل */}
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedEmployee(emp);
                                  setIsModalOpen(true);
                                }}
                                className="p-1.5 text-on-surface-variant hover:text-primary hover:bg-surface-container rounded-lg transition-colors"
                                title="تعديل بيانات الموظفة"
                              >
                                <span className="material-symbols-outlined text-[18px]">edit</span>
                              </button>

                              {/* زر التعطيل / التفعيل */}
                              {!isCurrentUser && (
                                <button
                                  type="button"
                                  onClick={() => handleToggleStatus(emp)}
                                  className={`p-1.5 rounded-lg transition-colors ${
                                    emp.is_active
                                      ? 'text-amber-600 hover:bg-amber-100'
                                      : 'text-secondary hover:bg-secondary-container/40'
                                  }`}
                                  title={emp.is_active ? 'تعطيل الحساب' : 'تفعيل الحساب'}
                                >
                                  <span className="material-symbols-outlined text-[18px]">
                                    {emp.is_active ? 'block' : 'check_circle'}
                                  </span>
                                </button>
                              )}

                              {/* زر الحذف */}
                              {!isCurrentUser && (
                                <button
                                  type="button"
                                  onClick={() => setEmployeeToDelete(emp)}
                                  className="p-1.5 text-outline hover:text-error hover:bg-error-container/30 rounded-lg transition-colors"
                                  title="حذف الموظفة نهائياً"
                                >
                                  <span className="material-symbols-outlined text-[18px]">delete</span>
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </main>

        {/* نافذة إضافة / تعديل موظفة */}
        <EmployeeModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onSave={handleSaveEmployee}
          initialEmployee={selectedEmployee}
        />

        {/* نافذة تأكيد حذف الموظفة */}
        {employeeToDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <div className="bg-surface-container-lowest rounded-2xl max-w-sm w-full p-6 shadow-xl border border-outline-variant/30 flex flex-col items-center text-center gap-4 animate-in fade-in zoom-in-95 duration-200">
              <div className="w-12 h-12 rounded-full bg-error-container/30 text-error flex items-center justify-center">
                <span className="material-symbols-outlined text-2xl">person_remove</span>
              </div>
              <div className="flex flex-col gap-1">
                <h3 className="text-base font-bold text-primary">
                  حذف حساب الموظفة ({employeeToDelete.name})؟
                </h3>
                <p className="text-xs text-on-surface-variant">
                  سيتم إزالة حساب تسجيل الدخول وجميع المهام المسندة إليها نهائياً ولا يمكن استرجاعها.
                </p>
              </div>
              <div className="flex items-center gap-2 w-full pt-2">
                <button
                  type="button"
                  onClick={() => setEmployeeToDelete(null)}
                  className="flex-1 py-2 px-4 rounded-xl border border-surface-variant text-xs font-semibold text-on-surface-variant hover:bg-surface-container transition-colors"
                >
                  إلغاء
                </button>
                <button
                  type="button"
                  onClick={confirmDeleteEmployee}
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
