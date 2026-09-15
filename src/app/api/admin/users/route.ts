import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin, verifyManagerSession } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

// GET: استرجاع جميع الموظفات مع عدد المهام
export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('Authorization');
    const authResult = await verifyManagerSession(authHeader);
    if (!authResult.authorized) {
      return NextResponse.json({ error: authResult.error }, { status: 403 });
    }

    const { data: profiles, error: profilesError } = await supabaseAdmin
      .from('profiles')
      .select(`
        id,
        email,
        name,
        role,
        is_active,
        created_at,
        updated_at
      `)
      .order('created_at', { ascending: false });

    if (profilesError) {
      return NextResponse.json({ error: profilesError.message }, { status: 400 });
    }

    // جلب عدد المهام لكل موظفة
    const { data: tasks } = await supabaseAdmin
      .from('tasks')
      .select('id, user_id, status');

    const profilesWithStats = (profiles || []).map((p) => {
      const userTasks = (tasks || []).filter((t) => t.user_id === p.id);
      return {
        ...p,
        total_tasks: userTasks.length,
        completed_tasks: userTasks.filter((t) => t.status === 'completed').length,
        in_progress_tasks: userTasks.filter((t) => t.status === 'in_progress').length,
      };
    });

    return NextResponse.json({ profiles: profilesWithStats });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'حدث خطأ في الخادم' }, { status: 500 });
  }
}

// POST: إضافة موظفة جديدة مع حساب Auth وكلمة مرور مؤقتة
export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('Authorization');
    const authResult = await verifyManagerSession(authHeader);
    if (!authResult.authorized) {
      return NextResponse.json({ error: authResult.error }, { status: 403 });
    }

    const body = await req.json();
    const { name, email, password, role = 'employee', is_active = true } = body;

    if (!name || !email || !password) {
      return NextResponse.json({ error: 'يرجى إدخال الاسم، البريد الإلكتروني، وكلمة المرور' }, { status: 400 });
    }

    if (password.length < 6) {
      return NextResponse.json({ error: 'يجب ألا تقل كلمة المرور عن 6 خانات' }, { status: 400 });
    }

    // إنشاء المستخدم في Supabase Auth عبر Admin API
    const { data: authData, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        name,
        role,
        is_active,
      },
    });

    if (createError) {
      return NextResponse.json({ error: createError.message }, { status: 400 });
    }

    // التأكد من تسجيل أو تحديث السجل في profiles
    const userId = authData.user.id;
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .upsert({
        id: userId,
        email,
        name,
        role,
        is_active,
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (profileError) {
      return NextResponse.json({ error: profileError.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, profile }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'حدث خطأ في الخادم' }, { status: 500 });
  }
}

// PUT: تعديل بيانات موظفة (الاسم، الدور، حالة الحساب، أو تغيير كلمة المرور)
export async function PUT(req: NextRequest) {
  try {
    const authHeader = req.headers.get('Authorization');
    const authResult = await verifyManagerSession(authHeader);
    if (!authResult.authorized) {
      return NextResponse.json({ error: authResult.error }, { status: 403 });
    }

    const body = await req.json();
    const { id, name, role, is_active, password } = body;

    if (!id) {
      return NextResponse.json({ error: 'معرّف الموظفة مطلوب' }, { status: 400 });
    }

    // تحديث بيانات الملف الشخصي
    const updatePayload: any = { updated_at: new Date().toISOString() };
    if (name !== undefined) updatePayload.name = name;
    if (role !== undefined) updatePayload.role = role;
    if (is_active !== undefined) updatePayload.is_active = is_active;

    const { data: updatedProfile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .update(updatePayload)
      .eq('id', id)
      .select()
      .single();

    if (profileError) {
      return NextResponse.json({ error: profileError.message }, { status: 400 });
    }

    // إذا طُلب تغيير كلمة المرور للموظفة
    if (password && password.length >= 6) {
      await supabaseAdmin.auth.admin.updateUserById(id, { password });
    }

    // مزامنة حالة المستخدم في Auth metadata
    await supabaseAdmin.auth.admin.updateUserById(id, {
      user_metadata: {
        name: updatedProfile.name,
        role: updatedProfile.role,
        is_active: updatedProfile.is_active,
      },
    });

    return NextResponse.json({ success: true, profile: updatedProfile });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'حدث خطأ في الخادم' }, { status: 500 });
  }
}

// DELETE: حذف حساب موظفة بالكامل
export async function DELETE(req: NextRequest) {
  try {
    const authHeader = req.headers.get('Authorization');
    const authResult = await verifyManagerSession(authHeader);
    if (!authResult.authorized) {
      return NextResponse.json({ error: authResult.error }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'معرّف الموظفة مطلوب' }, { status: 400 });
    }

    // منع المسؤول من حذف حسابه الشخصي عن طريق الخطأ
    if (authResult.user && id === authResult.user.id) {
      return NextResponse.json({ error: 'لا يمكنك حذف حسابك الشخصي' }, { status: 400 });
    }

    // حذف المستخدم من Supabase Auth (سيتم الحذف التلقائي من profiles و tasks بفضل CASCADE)
    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(id);
    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'حدث خطأ في الخادم' }, { status: 500 });
  }
}
