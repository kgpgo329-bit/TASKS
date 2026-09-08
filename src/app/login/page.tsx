'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Logo } from '@/components/Logo';
import { isSupabaseConfigured } from '@/lib/supabase/client';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const { user, profile, isManager, signIn } = useAuth();
  const router = useRouter();

  // إذا كان المستخدم مسجل دخول بالفعل، نوجهه تلقائياً
  useEffect(() => {
    if (user && profile) {
      if (isManager) {
        router.replace('/dashboard');
      } else {
        router.replace('/my-tasks');
      }
    }
  }, [user, profile, isManager, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setErrorMessage('يرجى إدخال البريد الإلكتروني وكلمة المرور');
      return;
    }

    setLoading(true);
    setErrorMessage('');

    const res = await signIn(email, password);
    if (res.error) {
      setErrorMessage(res.error);
      setLoading(false);
    }
  };

  const configured = isSupabaseConfigured();

  return (
    <div className="min-h-screen bg-background flex flex-col justify-center items-center p-4">
      {/* بطاقة تسجيل الدخول الرئيسية */}
      <div className="w-full max-w-md bg-surface-container-lowest rounded-3xl shadow-[0_8px_30px_rgba(27,67,50,0.06)] border border-surface-variant/40 p-8 flex flex-col gap-6">
        {/* الشعار والترحيب */}
        <div className="flex flex-col items-center text-center gap-3">
          <Logo size={60} showText={false} />
          <div className="flex flex-col">
            <h1 className="text-2xl font-bold text-primary">منصة مهامي</h1>
            <p className="text-xs text-on-surface-variant mt-0.5">
              جمعية إرشاد الجاليات - بوابة المتابعة والإنجاز
            </p>
          </div>
        </div>

        {/* تنبيه إذا لم تكن متغيرات البيئة معدة بعد */}
        {!configured && (
          <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex flex-col gap-1">
            <div className="flex items-center gap-1.5 font-bold">
              <span className="material-symbols-outlined text-[18px] text-amber-600">info</span>
              <span>تنبيه تهيئة Supabase:</span>
            </div>
            <p className="text-[11px] leading-relaxed">
              يرجى إضافة مفاتيح Supabase في ملف <code className="bg-amber-100 px-1 py-0.5 rounded text-amber-800">.env.local</code> أو في إعدادات مشروعك على Vercel للاتصال بقاعدة البيانات.
            </p>
          </div>
        )}

        {/* رسائل الخطأ */}
        {errorMessage && (
          <div className="p-3.5 rounded-2xl bg-error-container/30 border border-error/20 text-on-error-container text-xs flex items-center gap-2">
            <span className="material-symbols-outlined text-error text-[20px]">error</span>
            <span>{errorMessage}</span>
          </div>
        )}

        {/* نموذج تسجيل الدخول */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="block text-xs font-semibold text-primary mb-1.5">
              البريد الإلكتروني
            </label>
            <div className="relative">
              <span className="material-symbols-outlined absolute right-3.5 top-1/2 -translate-y-1/2 text-outline text-[20px]">
                mail
              </span>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                dir="ltr"
                className="w-full bg-surface-container-low text-on-surface placeholder:text-outline pr-11 pl-3.5 py-3 rounded-2xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-secondary/40 border border-transparent focus:border-secondary transition-all"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-primary mb-1.5">
              كلمة المرور
            </label>
            <div className="relative">
              <span className="material-symbols-outlined absolute right-3.5 top-1/2 -translate-y-1/2 text-outline text-[20px]">
                lock
              </span>
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                dir="ltr"
                className="w-full bg-surface-container-low text-on-surface placeholder:text-outline pr-11 pl-11 py-3 rounded-2xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-secondary/40 border border-transparent focus:border-secondary transition-all"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-outline hover:text-on-surface transition-colors"
                title={showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
              >
                <span className="material-symbols-outlined text-[20px]">
                  {showPassword ? 'visibility_off' : 'visibility'}
                </span>
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="mt-2 w-full py-3 px-4 bg-primary-container hover:bg-secondary text-on-primary rounded-2xl font-bold text-sm shadow-md shadow-primary/10 hover:shadow-lg transition-all transform active:scale-98 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                <span>جاري التحقق من الحساب...</span>
              </>
            ) : (
              <>
                <span>تسجيل الدخول</span>
                <span className="material-symbols-outlined text-[18px]">arrow_back</span>
              </>
            )}
          </button>
        </form>

        {/* إشعار الأمان */}
        <div className="pt-2 border-t border-surface-variant/30 text-center">
          <p className="text-[11px] text-outline flex items-center justify-center gap-1">
            <span className="material-symbols-outlined text-[15px] text-secondary">verified_user</span>
            <span>بوابة موحدة آمنة بنظام الصلاحيات RLS للموظفات والإدارة</span>
          </p>
        </div>
      </div>
    </div>
  );
}
