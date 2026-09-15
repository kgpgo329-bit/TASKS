import { NextRequest, NextResponse } from 'next/server';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db, firebaseConfig } from '@/lib/firebase/config';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    // 1. التحقق من وجود رمز المصادقة في ترويسة الطلب
    const authHeader = req.headers.get('authorization') || req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'غير مصرح: يرجى تسجيل الدخول أولاً كمسؤول للنظام' },
        { status: 401 }
      );
    }

    const idToken = authHeader.replace(/^Bearer\s+/i, '').trim();
    if (!idToken) {
      return NextResponse.json(
        { error: 'رمز المصادقة غير صالح أو مفقود' },
        { status: 401 }
      );
    }

    // 2. التحقق من صحة رمز Firebase ID Token من جهة الخادم عبر Google Identity Toolkit
    const apiKey = firebaseConfig.apiKey;
    const lookupRes = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      }
    );

    if (!lookupRes.ok) {
      const errData = await lookupRes.json().catch(() => ({}));
      console.error('[CreateEmployee API] Token verification failed:', errData);
      return NextResponse.json(
        { error: 'انتهت صلاحية جلسة تسجيل الدخول، يرجى إعادة الدخول والمحاولة ثانية' },
        { status: 401 }
      );
    }

    const lookupData = await lookupRes.json();
    const callerUid = lookupData.users?.[0]?.localId;

    if (!callerUid) {
      return NextResponse.json(
        { error: 'تعذر التحقق من هوية المستخدم' },
        { status: 401 }
      );
    }

    // 3. التحقق من صلاحيات المسؤول في Firestore
    let isManager = false;
    const userDocRef = doc(db, 'users', callerUid);
    const userDocSnap = await getDoc(userDocRef);

    if (userDocSnap.exists() && userDocSnap.data()?.role === 'manager') {
      isManager = true;
    } else {
      // فحص احتياطي في profiles
      const profDocRef = doc(db, 'profiles', callerUid);
      const profDocSnap = await getDoc(profDocRef);
      if (profDocSnap.exists() && profDocSnap.data()?.role === 'manager') {
        isManager = true;
      }
    }

    if (!isManager) {
      return NextResponse.json(
        { error: 'صلاحية مرفوضة: إضافة الموظفين مقتصرة حصرياً على المسؤول' },
        { status: 403 }
      );
    }

    // 4. قراءة بيانات الموظف الجديد من جسم الطلب
    const body = await req.json();
    const { name, email, password } = body;

    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json(
        { error: 'يرجى إدخال اسم الموظف' },
        { status: 400 }
      );
    }

    if (!email || typeof email !== 'string' || !email.trim()) {
      return NextResponse.json(
        { error: 'يرجى إدخال البريد الإلكتروني للموظف' },
        { status: 400 }
      );
    }

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(email.trim())) {
      return NextResponse.json(
        { error: 'صيغة البريد الإلكتروني غير صالحة' },
        { status: 400 }
      );
    }

    if (!password || typeof password !== 'string' || password.length < 6) {
      return NextResponse.json(
        { error: 'يجب ألا تقل كلمة المرور المؤقتة عن 6 خانات' },
        { status: 400 }
      );
    }

    // 5. إنشاء حساب الموظف في Firebase Authentication من الخادم
    const createAuthRes = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          password: password,
          returnSecureToken: true,
        }),
      }
    );

    if (!createAuthRes.ok) {
      const authErr = await createAuthRes.json().catch(() => ({}));
      const rawMsg = authErr.error?.message || '';
      console.error('[CreateEmployee API] Auth user creation failed:', authErr);

      if (rawMsg.includes('EMAIL_EXISTS')) {
        return NextResponse.json(
          { error: 'هذا البريد الإلكتروني مسجل مسبقاً في النظام' },
          { status: 400 }
        );
      } else if (rawMsg.includes('WEAK_PASSWORD')) {
        return NextResponse.json(
          { error: 'كلمة المرور المؤقتة ضعيفة، يرجى كتابة 6 خانات أو أرقام على الأقل' },
          { status: 400 }
        );
      } else if (rawMsg.includes('OPERATION_NOT_ALLOWED')) {
        return NextResponse.json(
          { error: 'تسجيل الدخول بالبريد وكلمة المرور غير مفعّل في مشروع Firebase' },
          { status: 500 }
        );
      } else {
        return NextResponse.json(
          { error: `تعذر إنشاء الحساب: ${rawMsg || 'خطأ غير معروف'}` },
          { status: 400 }
        );
      }
    }

    const authData = await createAuthRes.json();
    const employeeUid = authData.localId;

    // تحديث الاسم الظاهر في Firebase Auth إن أمكن
    if (authData.idToken) {
      try {
        await fetch(
          `https://identitytoolkit.googleapis.com/v1/accounts:update?key=${apiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              idToken: authData.idToken,
              displayName: name.trim(),
              returnSecureToken: false,
            }),
          }
        );
      } catch (e) {
        console.warn('[CreateEmployee API] Non-fatal error updating displayName:', e);
      }
    }

    // 6. إنشاء مستند الموظف في Firestore
    // المطلوب بدقة: users/{employeeUID}
    // الحقول: name, email, role: "employee"
    const now = new Date().toISOString();
    const employeeData = {
      name: name.trim(),
      email: email.trim().toLowerCase(),
      role: 'employee',
      is_active: true,
      created_at: now,
      updated_at: now,
    };

    // حفظ في users/{employeeUID}
    await setDoc(doc(db, 'users', employeeUid), employeeData);

    // حفظ مطابق في profiles/{employeeUID} لضمان التوافقية الكاملة
    await setDoc(doc(db, 'profiles', employeeUid), {
      id: employeeUid,
      ...employeeData,
    });

    console.log('[CreateEmployee API] Successfully created employee:', {
      uid: employeeUid,
      name: name.trim(),
      email: email.trim().toLowerCase(),
    });

    return NextResponse.json(
      {
        success: true,
        message: 'تم إضافة الموظف وإنشاء حسابه في النظام بنجاح',
        employee: {
          uid: employeeUid,
          name: name.trim(),
          email: email.trim().toLowerCase(),
          role: 'employee',
        },
      },
      { status: 201 }
    );
  } catch (err: any) {
    console.error('[CreateEmployee API] Server error:', err);
    return NextResponse.json(
      { error: err.message || 'حدث خطأ غير متوقع في الخادم أثناء إضافة الموظف' },
      { status: 500 }
    );
  }
}
