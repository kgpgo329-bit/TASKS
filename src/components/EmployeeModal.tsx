'use client';

import React, { useState, useEffect } from 'react';
import { Profile, UserRole } from '@/lib/firebase/types';

interface EmployeeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (employeeData: {
    id?: string;
    name: string;
    email?: string;
    password?: string;
    role: UserRole;
    is_active: boolean;
  }) => Promise<void>;
  initialEmployee?: Profile | null;
}

export const EmployeeModal: React.FC<EmployeeModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialEmployee,
}) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>('employee');
  const [isActive, setIsActive] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (initialEmployee) {
      setName(initialEmployee.name);
      setEmail(initialEmployee.email);
      setPassword(''); // لا نعرض كلمة المرور الحالية للأمان
      setRole(initialEmployee.role);
      setIsActive(initialEmployee.is_active);
    } else {
      setName('');
      setEmail('');
      setPassword('');
      setRole('employee');
      setIsActive(true);
    }
    setError('');
  }, [initialEmployee, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('يرجى إدخال اسم الموظفة');
      return;
    }

    if (!initialEmployee) {
      if (!email.trim()) {
        setError('يرجى إدخال البريد الإلكتروني');
        return;
      }
      if (!password || password.length < 6) {
        setError('كلمة المرور المؤقتة يجب أن تتكون من 6 خانات على الأقل');
        return;
      }
    } else if (password && password.length < 6) {
      setError('كلمة المرور الجديدة يجب ألا تقل عن 6 خانات');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await onSave({
        id: initialEmployee?.id,
        name: name.trim(),
        email: email.trim(),
        password: password || undefined,
        role,
        is_active: isActive,
      });
      onClose();
    } catch (err: any) {
      setError(err.message || 'حدث خطأ أثناء حفظ بيانات الموظفة');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-surface-container-lowest rounded-2xl w-full max-w-md shadow-xl border border-outline-variant/30 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* رأس النافذة */}
        <div className="px-space-lg py-space-md bg-surface-container-low border-b border-surface-variant/40 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-[24px]">
              {initialEmployee ? 'person_edit' : 'person_add'}
            </span>
            <h2 className="font-bold text-primary text-base">
              {initialEmployee ? 'تعديل بيانات الموظفة' : 'إضافة موظفة جديدة'}
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

          {/* اسم الموظفة */}
          <div>
            <label className="block text-xs font-semibold text-primary mb-1">
              اسم الموظفة <span className="text-error">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="مثال: سارة العتيبي"
              required
              className="w-full px-3.5 py-2.5 rounded-xl border border-surface-variant focus:border-secondary focus:ring-2 focus:ring-secondary/20 text-sm outline-none transition-all"
            />
          </div>

          {/* البريد الإلكتروني */}
          <div>
            <label className="block text-xs font-semibold text-primary mb-1">
              البريد الإلكتروني {initialEmployee ? '(للقراءة فقط)' : <span className="text-error">*</span>}
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="sara@example.com"
              required={!initialEmployee}
              disabled={Boolean(initialEmployee)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-surface-variant focus:border-secondary focus:ring-2 focus:ring-secondary/20 text-sm outline-none transition-all disabled:bg-surface-container-low disabled:text-outline"
            />
          </div>

          {/* كلمة المرور المؤقتة */}
          <div>
            <label className="block text-xs font-semibold text-primary mb-1">
              {initialEmployee ? 'تعيين كلمة مرور جديدة (اختياري)' : 'كلمة المرور المؤقتة'} {!initialEmployee && <span className="text-error">*</span>}
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={initialEmployee ? 'اتركيها فارغة إن لم ترغبي بتغييرها' : '٦ أحرف أو أرقام على الأقل'}
              required={!initialEmployee}
              className="w-full px-3.5 py-2.5 rounded-xl border border-surface-variant focus:border-secondary focus:ring-2 focus:ring-secondary/20 text-sm outline-none transition-all"
            />
            <p className="text-[11px] text-outline mt-1">
              تستطيع الموظفة تسجيل الدخول بهذه البيانات فوراً بنفس رابط المنصة.
            </p>
          </div>

          {/* الدور */}
          <div>
            <label className="block text-xs font-semibold text-primary mb-1">الدور والصلاحيات</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setRole('employee')}
                className={`py-2 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                  role === 'employee'
                    ? 'bg-secondary-container text-on-secondary-container border-secondary'
                    : 'border-surface-variant text-on-surface-variant hover:bg-surface-container-low'
                }`}
              >
                <span className="material-symbols-outlined text-[16px]">badge</span>
                <span>موظفة</span>
              </button>

              <button
                type="button"
                onClick={() => setRole('manager')}
                className={`py-2 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                  role === 'manager'
                    ? 'bg-primary-container text-on-primary border-primary'
                    : 'border-surface-variant text-on-surface-variant hover:bg-surface-container-low'
                }`}
              >
                <span className="material-symbols-outlined text-[16px]">shield_person</span>
                <span>مديرة</span>
              </button>
            </div>
          </div>

          {/* حالة الحساب */}
          <div>
            <label className="block text-xs font-semibold text-primary mb-1">حالة الحساب</label>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="status"
                  checked={isActive}
                  onChange={() => setIsActive(true)}
                  className="text-secondary focus:ring-secondary"
                />
                <span className="text-xs font-medium text-secondary flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-secondary"></span>
                  <span>نشط (يمكنها تسجيل الدخول)</span>
                </span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="status"
                  checked={!isActive}
                  onChange={() => setIsActive(false)}
                  className="text-error focus:ring-error"
                />
                <span className="text-xs font-medium text-error flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-error"></span>
                  <span>معطل (حظر الدخول)</span>
                </span>
              </label>
            </div>
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
              <span>{initialEmployee ? 'تحديث البيانات' : 'إنشاء الحساب'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
