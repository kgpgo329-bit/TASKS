import { createClient, User } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'placeholder-service-role-key';

// عميل الخادم بصلاحيات كاملة للعمليات الإدارية الخاصة بالمديرة فقط
export const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

type VerifyResult =
  | { authorized: false; error: string; user?: undefined; profile?: undefined }
  | { authorized: true; user: User; profile: any; error?: undefined };

// دالة فحص وتوثيق طلبات المديرة القادمة إلى الـ API
export async function verifyManagerSession(authHeader: string | null): Promise<VerifyResult> {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { authorized: false, error: 'غير مصرح بالدخول، يرجى تسجيل الدخول أولاً' };
  }

  const token = authHeader.replace('Bearer ', '');
  const anonClient = createClient(supabaseUrl, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-anon-key');
  
  const { data: { user }, error: userError } = await anonClient.auth.getUser(token);
  if (userError || !user) {
    return { authorized: false, error: 'جلسة المستخدم غير صالحة أو منتهية' };
  }

  // التحقق من دور المستخدم في جدول profiles
  const { data: profile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('role, is_active')
    .eq('id', user.id)
    .single();

  if (profileError || !profile) {
    return { authorized: false, error: 'تعذر العثور على الملف الشخصي' };
  }

  if (!profile.is_active) {
    return { authorized: false, error: 'هذا الحساب معطل حالياً' };
  }

  if (profile.role !== 'manager') {
    return { authorized: false, error: 'عذراً، هذه العملية مخصصة للمديرة فقط' };
  }

  return { authorized: true, user, profile };
}
