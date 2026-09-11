'use client';

import React, { useState } from 'react';
import { auth } from '@/lib/firebase/config';

interface AddEmployeeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onEmployeeCreated?: (employee: { uid: string; name: string; email: string }) => void;
}

export const AddEmployeeModal: React.FC<AddEmployeeModalProps> = ({
  isOpen,
  onClose,
  onEmployeeCreated,
}) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successData, setSuccessData] = useState<{
    uid: string;
    name: string;
    email: string;
    password?: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleResetAndClose = () => {
    setName('');
    setEmail('');
    setPassword('');
    setError('');
    setSuccessData(null);
    setCopied(false);
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!name.trim()) {
      setError('يرجى إدخال اسم الموظف');
      return;
    }

    if (!email.trim()) {
      setError('يرجى إدخال البريد الإلكتروني للموظف');
      return;
    }

    if (!password || password.length < 6) {
      setError('يجب ألا تقل كلمة المرور المؤقتة عن 6 خانات');
      return;
    }

    const currentUser = auth.currentUser;
    if (!currentUser) {
      setError('جلسة تسجيل الدخول غير متوفرة، يرجى إعادة تسجيل الدخول أولاً');
      return;
    }

    setLoading(true);

    try {
      const idToken = await currentUser.getIdToken(true);

      const res = await fetch('/api/admin/create-employee', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim().toLowerCase(),
          password: password,
        }),
      });

      const result = await res.json();

      if (!res.ok) {
        throw new Error(result.error || 'فشل إضافة الموظف، يرجى المحاولة لاحقاً');
      }

      // نجاح العملية
      setSuccessData({
        uid: result.employee.uid,
        name: result.employee.name,
        email: result.employee.email,
        password: password,
      });

      if (onEmployeeCreated) {
        onEmployeeCreated(result.employee);
      }
    } catch (err: any) {
      console.error('Error in AddEmployeeModal:', err);
      setError(err.message || 'حدث خطأ أثناء إضافة الموظف');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyCredentials = () => {
    if (!successData) return;
    const text = `بيانات الدخول لمنصة مهامي:\nالاسم: ${successData.name}\nالبريد الإلكتروني: ${successData.email}\nكلمة المرور المؤقتة: ${successData.password}\nرابط الدخول: ${window.location.origin}/login`;
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-surface-container-lowest rounded-3xl w-full max-w-lg shadow-2xl border border-outline-variant/30 overflow-hidden animate-in zoom-in-95 duration-200">
        {/* رأس النافذة */}
        <div className="px-6 py-4 bg-gradient-to-l from-primary/10 via-surface-container-low to-surface-container-low border-b border-surface-variant/40 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
              <span className="material-symbols-outlined text-[22px]">person_add</span>
            </div>
            <div className="flex flex-col">
              <h2 className="font-bold text-primary text-base">إضافة موظف جديد</h2>
              <span className="text-[11px] text-on-surface-variant">
                إنشاء حساب موظف في النظام وتحديد صلاحياته
              </span>
            </div>
          </div>
          <button
            onClick={handleResetAndClose}
            type="button"
            className="text-on-surface-variant hover:text-on-surface p-1.5 rounded-xl hover:bg-surface-container transition-colors"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* جسم النافذة: إما نموذج الإدخال أو شاشة النجاح */}
        {successData ? (
          <div className="p-6 flex flex-col gap-5">
            <div className="flex flex-col items-center text-center gap-2 py-2">
              <div className="w-14 h-14 rounded-full bg-secondary-container/60 text-secondary flex items-center justify-center">
                <span className="material-symbols-outlined text-3xl">check_circle</span>
              </div>
              <h3 className="text-lg font-bold text-primary">تم إنشاء حساب الموظف بنجاح!</h3>
              <p className="text-xs text-on-surface-variant max-w-xs">
                تم حفظ بيانات الموظف وإنشاء حسابه في النظام، ويمكنه الآن تسجيل الدخول فوراً بالبيانات التالية:
              </p>
            </div>

            {/* تفاصيل الحساب */}
            <div className="p-4 rounded-2xl bg-surface-container-low border border-surface-variant/50 flex flex-col gap-3 text-xs">
              <div className="flex items-center justify-between py-1 border-b border-surface-variant/40">
                <span className="text-on-surface-variant">اسم الموظف:</span>
                <span className="font-bold text-primary">{successData.name}</span>
              </div>
              <div className="flex items-center justify-between py-1 border-b border-surface-variant/40">
                <span className="text-on-surface-variant">البريد الإلكتروني:</span>
                <span className="font-mono text-on-surface font-semibold" dir="ltr">
                  {successData.email}
                </span>
              </div>
              <div className="flex items-center justify-between py-1 border-b border-surface-variant/40">
                <span className="text-on-surface-variant">كلمة المرور المؤقتة:</span>
                <span className="font-mono font-bold text-secondary text-sm" dir="ltr">
                  {successData.password}
                </span>
              </div>
              <div className="flex items-center justify-between py-1">
                <span className="text-on-surface-variant">الدور والصلاحية:</span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-secondary-container text-on-secondary-container text-[11px] font-bold">
                  <span className="material-symbols-outlined text-[13px]">badge</span>
                  <span>موظف (Employee)</span>
                </span>
              </div>
            </div>

            {/* زر نسخ البيانات */}
            <button
              type="button"
              onClick={handleCopyCredentials}
              className={`w-full py-2.5 px-4 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                copied
                  ? 'bg-secondary text-white'
                  : 'bg-surface-container text-primary hover:bg-surface-container-high border border-surface-variant/40'
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">
                {copied ? 'done' : 'content_copy'}
              </span>
              <span>{copied ? 'تم نسخ بيانات الحساب بنجاح' : 'نسخ بيانات الدخول للموظف'}</span>
            </button>

            {/* أزرار إنهاء أو إضافة موظف آخر */}
            <div className="flex items-center gap-2 pt-2 border-t border-surface-variant/30">
              <button
                type="button"
                onClick={() => {
                  setName('');
                  setEmail('');
                  setPassword('');
                  setSuccessData(null);
                  setCopied(false);
                }}
                className="flex-1 py-2.5 rounded-xl border border-primary text-primary hover:bg-primary/5 text-xs font-bold transition-colors"
              >
                + إضافة موظف آخر
              </button>
              <button
                type="button"
                onClick={handleResetAndClose}
                className="flex-1 py-2.5 bg-primary hover:bg-secondary text-white rounded-xl text-xs font-bold transition-colors"
              >
                تم والعودة للوحة
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-4">
            {error && (
              <div className="p-3.5 rounded-2xl bg-error-container/40 text-on-error-container text-xs flex items-center gap-2 border border-error/20 animate-in fade-in duration-200">
                <span className="material-symbols-outlined text-[18px] text-error shrink-0">
                  error
                </span>
                <span className="leading-relaxed">{error}</span>
              </div>
            )}

            {/* اسم الموظف */}
            <div>
              <label className="block text-xs font-bold text-primary mb-1.5">
                اسم الموظف <span className="text-error">*</span>
              </label>
              <div className="relative">
                <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-outline text-[18px]">
                  person
                </span>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="مثال: عبد الله أحمد"
                  required
                  disabled={loading}
                  className="w-full pr-10 pl-4 py-2.5 rounded-xl border border-surface-variant focus:border-secondary focus:ring-2 focus:ring-secondary/20 text-sm outline-none transition-all disabled:opacity-50"
                />
              </div>
            </div>

            {/* البريد الإلكتروني */}
            <div>
              <label className="block text-xs font-bold text-primary mb-1.5">
                البريد الإلكتروني <span className="text-error">*</span>
              </label>
              <div className="relative">
                <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-outline text-[18px]">
                  mail
                </span>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="employee@example.com"
                  required
                  disabled={loading}
                  dir="ltr"
                  className="w-full pr-10 pl-4 py-2.5 rounded-xl border border-surface-variant focus:border-secondary focus:ring-2 focus:ring-secondary/20 text-sm outline-none transition-all text-right disabled:opacity-50"
                />
              </div>
              <p className="text-[11px] text-on-surface-variant mt-1">
                سيكون هذا البريد هو اسم المستخدم لتسجيل الدخول.
              </p>
            </div>

            {/* كلمة المرور المؤقتة */}
            <div>
              <label className="block text-xs font-bold text-primary mb-1.5">
                كلمة المرور المؤقتة <span className="text-error">*</span>
              </label>
              <div className="relative">
                <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-outline text-[18px]">
                  lock
                </span>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="٦ خانات أو أرقام على الأقل"
                  required
                  disabled={loading}
                  dir="ltr"
                  className="w-full pr-10 pl-10 py-2.5 rounded-xl border border-surface-variant focus:border-secondary focus:ring-2 focus:ring-secondary/20 text-sm outline-none transition-all text-right disabled:opacity-50"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-outline hover:text-primary transition-colors"
                >
                  <span className="material-symbols-outlined text-[18px]">
                    {showPassword ? 'visibility_off' : 'visibility'}
                  </span>
                </button>
              </div>
              <p className="text-[11px] text-on-surface-variant mt-1">
                يستطيع الموظف استخدامها للدخول فوراً بنفس رابط المنصة.
              </p>
            </div>

            {/* الصلاحية والدور */}
            <div className="p-3 rounded-2xl bg-surface-container-low border border-surface-variant/40 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[20px]">badge</span>
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-primary">الدور والصلاحيات</span>
                  <span className="text-[10px] text-on-surface-variant">
                    حساب موظف (عرض وإدارة مهامه الخاصة فقط)
                  </span>
                </div>
              </div>
              <span className="px-2.5 py-1 rounded-full bg-secondary-container text-on-secondary-container text-[11px] font-bold">
                موظف (Employee)
              </span>
            </div>

            {/* أزرار الإجراءات */}
            <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-surface-variant/30">
              <button
                type="button"
                onClick={handleResetAndClose}
                disabled={loading}
                className="px-4 py-2.5 rounded-xl text-xs font-semibold text-on-surface-variant hover:bg-surface-container transition-colors disabled:opacity-50"
              >
                إلغاء
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-5 py-2.5 bg-primary hover:bg-secondary text-white rounded-xl text-xs font-bold shadow-md shadow-primary/10 transition-all disabled:opacity-50 flex items-center gap-2 transform active:scale-95"
              >
                {loading ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>جاري إنشاء الحساب...</span>
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-[18px]">person_add</span>
                    <span>إضافة الموظف وإنشاء الحساب</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
