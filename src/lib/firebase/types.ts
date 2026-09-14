export type UserRole = 'employee' | 'manager';

export type TaskStatus =
  | 'not_started'     // جديدة / لم تبدأ
  | 'in_progress'     // قيد التنفيذ
  | 'under_review'    // بانتظار المراجعة
  | 'completed'       // مكتملة
  | 'cancelled';      // ملغاة

export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface Profile {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface TaskAttachment {
  id: string;
  name: string;
  url: string;
  storage_path: string;
  size: number; // بالبايت
  type: string; // نوع MIME
  uploader_id: string;
  uploader_name: string;
  uploader_role: UserRole;
  created_at: string;
}

export interface TaskMessage {
  id: string;
  task_id: string;
  sender_id: string;
  sender_name: string;
  sender_role: UserRole;
  content: string;
  attachments?: TaskAttachment[];
  read_by: string[]; // معرّفات المستخدمين الذين قرأوا الرسالة
  created_at: string;
}

export type ActivityType =
  | 'task_created'
  | 'task_assigned'
  | 'task_updated'
  | 'status_changed'
  | 'message_sent'
  | 'attachment_added'
  | 'task_completed';

export interface TaskActivity {
  id: string;
  task_id: string;
  user_id: string;
  user_name: string;
  user_role: UserRole;
  type: ActivityType;
  details: string;
  created_at: string;
}

export type NotificationType =
  | 'new_task'
  | 'new_message'
  | 'attachment_added'
  | 'status_changed';

export interface AppNotification {
  id: string;
  user_id: string; // المستخدم المستلم للإشعار
  actor_id: string;
  actor_name: string;
  task_id: string;
  task_title: string;
  type: NotificationType;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
}

export interface Task {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  due_date: string | null;
  category: string;
  user_id: string; // الموظفة المكلفة
  created_by?: string; // معرّف المسؤولة التي أنشأت المهمة
  creator_name?: string; // اسم المسؤولة
  manager_note?: string | null; // ملاحظة المسؤولة الأصلية
  employee_note?: string | null; // ملاحظة الموظفة عند التنفيذ أو الإنجاز
  is_locked?: boolean; // قفل المهمة بعد الإرسال
  attachments?: TaskAttachment[];
  created_at: string;
  updated_at: string;
  profiles?: Profile;
  unread_messages_count?: number;
}

