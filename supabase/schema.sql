-- ==============================================================================
-- نظام "مهامي" - جمعية هاد (Waqar & Injaz)
-- سكربت إعداد قاعدة البيانات الشامل وصلاحيات RLS (Supabase)
-- ==============================================================================

-- تفعيل ملحق UUID إذا لم يكن مفعلاً
create extension if not exists "uuid-ossp";

-- ------------------------------------------------------------------------------
-- 1. إنشاء جدول الملفات الشخصية والأدوار (profiles)
-- ------------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  email text not null,
  name text not null,
  role text not null check (role in ('employee', 'manager')) default 'employee',
  is_active boolean not null default true,
  created_at timestamptz default timezone('utc'::text, now()) not null,
  updated_at timestamptz default timezone('utc'::text, now()) not null
);

-- فهرس لتسريع البحث
create index if not exists idx_profiles_role on public.profiles(role);
create index if not exists idx_profiles_is_active on public.profiles(is_active);

-- ------------------------------------------------------------------------------
-- 2. دالة التحقق من دور المديرة (is_manager) لتفادي التكرار اللانهائي في RLS
-- ------------------------------------------------------------------------------
create or replace function public.is_manager()
returns boolean
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  return exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'manager'
      and is_active = true
  );
end;
$$;

-- ------------------------------------------------------------------------------
-- 3. تفعيل RLS على جدول profiles وسياسات الأمان
-- ------------------------------------------------------------------------------
alter table public.profiles enable row level security;

-- سياسة القراءة: الموظفة تقرأ بياناتها فقط، والمديرة تقرأ بيانات الجميع
create policy "profiles_select_policy"
  on public.profiles for select
  using (
    auth.uid() = id
    or public.is_manager()
  );

-- سياسة التحديث: الموظفة تحدث اسمها فقط، والمديرة تحدث أي حساب
create policy "profiles_update_policy"
  on public.profiles for update
  using (
    auth.uid() = id
    or public.is_manager()
  );

-- سياسة الإدراج: للمديرة أو خدمة النظام
create policy "profiles_insert_policy"
  on public.profiles for insert
  with check (
    auth.uid() = id
    or public.is_manager()
  );

-- سياسة الحذف: للمديرة فقط
create policy "profiles_delete_policy"
  on public.profiles for delete
  using (
    public.is_manager()
  );

-- ------------------------------------------------------------------------------
-- 4. ربط إنشاء المستخدم التلقائي في auth.users بإنشاء ملفه في profiles
-- ------------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, name, role, is_active)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'role', 'employee'),
    coalesce((new.raw_user_meta_data->>'is_active')::boolean, true)
  )
  on conflict (id) do update
  set
    email = excluded.email,
    name = coalesce(excluded.name, profiles.name),
    role = coalesce(excluded.role, profiles.role),
    is_active = coalesce(excluded.is_active, profiles.is_active),
    updated_at = timezone('utc'::text, now());

  return new;
end;
$$;

-- التريجر لربط جدول Auth بـ Profiles
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ------------------------------------------------------------------------------
-- 5. إنشاء جدول المهام (tasks)
-- ------------------------------------------------------------------------------
create table if not exists public.tasks (
  id uuid default gen_random_uuid() primary key,
  title text not null,
  description text,
  status text not null check (status in ('not_started', 'in_progress', 'completed')) default 'not_started',
  priority text not null check (priority in ('low', 'medium', 'high', 'urgent')) default 'medium',
  due_date date,
  category text default 'عام',
  user_id uuid references public.profiles(id) on delete cascade not null,
  created_at timestamptz default timezone('utc'::text, now()) not null,
  updated_at timestamptz default timezone('utc'::text, now()) not null
);

-- فهارس للبحث والفرز السريع
create index if not exists idx_tasks_user_id on public.tasks(user_id);
create index if not exists idx_tasks_status on public.tasks(status);
create index if not exists idx_tasks_due_date on public.tasks(due_date);

-- ------------------------------------------------------------------------------
-- 6. تفعيل RLS على جدول tasks وسياسات الأمان الصارمة
-- ------------------------------------------------------------------------------
alter table public.tasks enable row level security;

-- سياسة الاستعراض (SELECT):
-- الموظفة لا ترى إلا مهامها الخاصة فقط (user_id = auth.uid())
-- المديرة ترى مهام جميع الموظفات
create policy "tasks_select_policy"
  on public.tasks for select
  using (
    user_id = auth.uid()
    or public.is_manager()
  );

-- سياسة الإضافة (INSERT):
-- الموظفة تضيف مهاماً لنفسها فقط (user_id = auth.uid())
-- المديرة يمكنها إضافة مهمة لنفسها أو تعيينها لأي موظفة
create policy "tasks_insert_policy"
  on public.tasks for insert
  with check (
    user_id = auth.uid()
    or public.is_manager()
  );

-- سياسة التعديل (UPDATE):
-- الموظفة تعدل مهامها الخاصة فقط
-- المديرة يمكنها تعديل مهام أي موظفة
create policy "tasks_update_policy"
  on public.tasks for update
  using (
    user_id = auth.uid()
    or public.is_manager()
  );

-- سياسة الحذف (DELETE):
-- الموظفة تحذف مهامها الخاصة فقط
-- المديرة يمكنها حذف أي مهمة
create policy "tasks_delete_policy"
  on public.tasks for delete
  using (
    user_id = auth.uid()
    or public.is_manager()
  );

-- ------------------------------------------------------------------------------
-- 7. تحديث حقل updated_at تلقائياً عند أي تعديل
-- ------------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$;

drop trigger if exists set_tasks_updated_at on public.tasks;
create trigger set_tasks_updated_at
  before update on public.tasks
  for each row execute function public.set_updated_at();

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- ------------------------------------------------------------------------------
-- 8. طريقة إنشاء حساب المديرة الأولى (Super Admin Manager)
-- ------------------------------------------------------------------------------
-- يمكنك إما إنشاء مستخدم من خلال لوحة Supabase Authentication أو تنفيذ أمر مباشر
-- ثم تعيين دوره كمديرة بالاستعلام التالي (قم باستبدال البريد ببريدك):
/*
update public.profiles
set role = 'manager', is_active = true
where email = 'manager@mahamee.local';
*/
