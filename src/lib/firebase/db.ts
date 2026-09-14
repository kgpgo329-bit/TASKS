import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  addDoc,
  onSnapshot,
  arrayUnion,
  limit,
  writeBatch,
} from 'firebase/firestore';
import { db } from './config';
import {
  Profile,
  Task,
  UserRole,
  TaskAttachment,
  TaskMessage,
  TaskActivity,
  AppNotification,
  TaskStatus,
  ActivityType,
} from './types';

// دالة أمان لمنع تعليق وعود Firestore في حال بطء أو انقطاع الشبكة
export function withTimeout<T>(
  promise: Promise<T>,
  ms = 10000,
  errorMessage = 'انتهت مهلة استجابة قاعدة البيانات (Timeout)'
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(errorMessage)), ms)
    ),
  ]);
}

// ==============================================================================
// Profiles (المستخدمات / الموظفات)
// ==============================================================================

export async function getProfile(userId: string): Promise<Profile | null> {
  return withTimeout(
    (async () => {
      // 1. قراءة مستند المستخدم أولاً من مجموعة users/{uid} كما هو مطلوب بدقة
      const userRef = doc(db, 'users', userId);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        const data = userSnap.data();
        return {
          id: userId,
          name: data.name || data.displayName || data.email?.split('@')[0] || 'مستخدم',
          email: data.email || '',
          role: data.role as UserRole,
          is_active: data.is_active !== undefined ? data.is_active : (data.isActive !== undefined ? data.isActive : true),
          created_at: data.created_at || data.createdAt || new Date().toISOString(),
          updated_at: data.updated_at || data.updatedAt || new Date().toISOString(),
        };
      }

      // 2. كخيار احتياطي قراءة profiles/{uid}
      const profRef = doc(db, 'profiles', userId);
      const profSnap = await getDoc(profRef);
      if (profSnap.exists()) {
        const data = profSnap.data();
        return {
          id: userId,
          name: data.name || data.displayName || data.email?.split('@')[0] || 'مستخدم',
          email: data.email || '',
          role: data.role as UserRole,
          is_active: data.is_active !== undefined ? data.is_active : (data.isActive !== undefined ? data.isActive : true),
          created_at: data.created_at || data.createdAt || new Date().toISOString(),
          updated_at: data.updated_at || data.updatedAt || new Date().toISOString(),
        };
      }

      return null;
    })(),
    10000,
    'تعذر قراءة بيانات المستخدم: انتهت مهلة الاتصال'
  );
}

export const getUserDocument = getProfile;

export async function setProfile(profile: Profile): Promise<void> {
  const userRef = doc(db, 'users', profile.id);
  const profRef = doc(db, 'profiles', profile.id);
  await Promise.all([
    setDoc(userRef, profile, { merge: true }),
    setDoc(profRef, profile, { merge: true }),
  ]);
}

export async function getAllProfiles(): Promise<Profile[]> {
  return withTimeout(
    (async () => {
      const usersCol = collection(db, 'users');
      const userSnap = await getDocs(usersCol);
      if (!userSnap.empty) {
        return userSnap.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            name: data.name || data.displayName || data.email?.split('@')[0] || 'مستخدم',
            email: data.email || '',
            role: data.role as UserRole,
            is_active: data.is_active !== undefined ? data.is_active : (data.isActive !== undefined ? data.isActive : true),
            created_at: data.created_at || data.createdAt || new Date().toISOString(),
            updated_at: data.updated_at || data.updatedAt || new Date().toISOString(),
          };
        });
      }

      const profCol = collection(db, 'profiles');
      const profSnap = await getDocs(profCol);
      return profSnap.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          name: data.name || data.displayName || data.email?.split('@')[0] || 'مستخدم',
          email: data.email || '',
          role: data.role as UserRole,
          is_active: data.is_active !== undefined ? data.is_active : true,
          created_at: data.created_at || new Date().toISOString(),
          updated_at: data.updated_at || new Date().toISOString(),
        };
      });
    })(),
    10000,
    'تعذر جلب قائمة الموظفات: انتهت مهلة الاتصال'
  );
}

export async function updateProfile(userId: string, data: Partial<Profile>): Promise<void> {
  const updatedData = {
    ...data,
    updated_at: new Date().toISOString(),
  };
  const userRef = doc(db, 'users', userId);
  const profRef = doc(db, 'profiles', userId);
  await Promise.allSettled([
    setDoc(userRef, updatedData, { merge: true }),
    setDoc(profRef, updatedData, { merge: true }),
  ]);
}

export async function deleteProfile(userId: string): Promise<void> {
  const userRef = doc(db, 'users', userId);
  const profRef = doc(db, 'profiles', userId);
  await Promise.allSettled([
    deleteDoc(userRef),
    deleteDoc(profRef),
  ]);

  // حذف كافة مهام المستخدم
  const tasksCol = collection(db, 'tasks');
  const q = query(tasksCol, where('user_id', '==', userId));
  const snap = await getDocs(q);
  const deletePromises = snap.docs.map((d) => deleteDoc(d.ref));
  await Promise.all(deletePromises);
}

// ==============================================================================
// Helper Labels
// ==============================================================================

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  not_started: 'جديدة',
  in_progress: 'قيد التنفيذ',
  under_review: 'بانتظار المراجعة',
  completed: 'مكتملة',
  cancelled: 'ملغاة',
};

// ==============================================================================
// Tasks (المهام)
// ==============================================================================

export async function getTask(taskId: string): Promise<Task | null> {
  return withTimeout(
    (async () => {
      const docRef = doc(db, 'tasks', taskId);
      const snap = await getDoc(docRef);
      if (!snap.exists()) return null;
      return { ...snap.data(), id: snap.id } as Task;
    })(),
    10000,
    'تعذر قراءة بيانات المهمة: انتهت مهلة الاتصال'
  );
}

export async function getUserTasks(userId: string): Promise<Task[]> {
  return withTimeout(
    (async () => {
      const tasksCol = collection(db, 'tasks');
      const q = query(tasksCol, where('user_id', '==', userId));
      const snap = await getDocs(q);
      const list = snap.docs.map((d) => ({ ...d.data(), id: d.id } as Task));
      return list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    })(),
    10000,
    'تعذر جلب قائمة المهام الخاصة: انتهت مهلة الاتصال'
  );
}

export async function getAllTasks(): Promise<Task[]> {
  return withTimeout(
    (async () => {
      const tasksCol = collection(db, 'tasks');
      const snap = await getDocs(tasksCol);
      const list = snap.docs.map((d) => ({ ...d.data(), id: d.id } as Task));
      return list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    })(),
    10000,
    'تعذر جلب جميع المهام: انتهت مهلة الاتصال'
  );
}

export async function createTask(
  taskData: Omit<Task, 'id' | 'created_at' | 'updated_at'>,
  actor?: { id: string; name: string; role: UserRole }
): Promise<Task> {
  const tasksCol = collection(db, 'tasks');
  const now = new Date().toISOString();
  const payload = {
    ...taskData,
    status: taskData.status || 'not_started',
    is_locked: taskData.is_locked !== undefined ? taskData.is_locked : true,
    attachments: taskData.attachments || [],
    created_at: now,
    updated_at: now,
  };

  const docRef = await addDoc(tasksCol, payload);
  const taskId = docRef.id;

  // تسجيل النشاط الأولي: إنشاء المهمة
  if (actor) {
    await logTaskActivity(taskId, {
      task_id: taskId,
      user_id: actor.id,
      user_name: actor.name,
      user_role: actor.role,
      type: 'task_created',
      details: `تم إنشاء المهمة: "${taskData.title}"`,
    });

    if (taskData.user_id && taskData.user_id !== actor.id) {
      // تسجيل نشاط الإسناد
      await logTaskActivity(taskId, {
        task_id: taskId,
        user_id: actor.id,
        user_name: actor.name,
        user_role: actor.role,
        type: 'task_assigned',
        details: `تم إرسال وتكليف المهمة للموظفة`,
      });

      // إرسال إشعار للموظفة المكلفة
      await createNotification({
        user_id: taskData.user_id,
        actor_id: actor.id,
        actor_name: actor.name,
        task_id: taskId,
        task_title: taskData.title,
        type: 'new_task',
        title: 'مهمة جديدة أُسندت إليك',
        message: `أرسلت لك ${actor.name} مهمة: "${taskData.title}"`,
        is_read: false,
      });
    }

    // إذا كانت هناك مرفقات مبدئية مسجلة
    if (taskData.attachments && taskData.attachments.length > 0) {
      await logTaskActivity(taskId, {
        task_id: taskId,
        user_id: actor.id,
        user_name: actor.name,
        user_role: actor.role,
        type: 'attachment_added',
        details: `تم إرفاق ${taskData.attachments.length} ملف/صورة مع المهمة`,
      });
    }
  }

  return {
    ...payload,
    id: taskId,
  };
}

export async function updateTask(
  taskId: string,
  data: Partial<Task>,
  actor?: { id: string; name: string; role: UserRole }
): Promise<void> {
  const docRef = doc(db, 'tasks', taskId);
  const now = new Date().toISOString();
  await updateDoc(docRef, {
    ...data,
    updated_at: now,
  });

  if (actor) {
    await logTaskActivity(taskId, {
      task_id: taskId,
      user_id: actor.id,
      user_name: actor.name,
      user_role: actor.role,
      type: 'task_updated',
      details: `تم تعديل بيانات المهمة بواسطة ${actor.name}`,
    });
  }
}

export async function deleteTask(taskId: string): Promise<void> {
  const docRef = doc(db, 'tasks', taskId);
  await deleteDoc(docRef);
}

// ==============================================================================
// Task Attachments & Execution Proofs (المرفقات وإثباتات التنفيذ)
// ==============================================================================

export async function addAttachmentToTask(
  taskId: string,
  attachment: TaskAttachment,
  actor: { id: string; name: string; role: UserRole },
  taskTitle: string,
  recipientUserId?: string
): Promise<void> {
  const docRef = doc(db, 'tasks', taskId);
  const now = new Date().toISOString();

  await updateDoc(docRef, {
    attachments: arrayUnion(attachment),
    updated_at: now,
  });

  // تسجيل النشاط
  await logTaskActivity(taskId, {
    task_id: taskId,
    user_id: actor.id,
    user_name: actor.name,
    user_role: actor.role,
    type: 'attachment_added',
    details: `أرفق ملفاً: "${attachment.name}"`,
  });

  // إرسال إشعار للطرف الآخر إن وجد
  if (recipientUserId && recipientUserId !== actor.id) {
    await createNotification({
      user_id: recipientUserId,
      actor_id: actor.id,
      actor_name: actor.name,
      task_id: taskId,
      task_title: taskTitle,
      type: 'attachment_added',
      title: 'مرفق جديد في المهمة',
      message: `أضافت ${actor.name} مرفقاً جديداً: "${attachment.name}"`,
      is_read: false,
    });
  }
}

export async function updateTaskStatusWithProof(
  taskId: string,
  newStatus: TaskStatus,
  actor: { id: string; name: string; role: UserRole },
  taskTitle: string,
  options?: {
    employeeNote?: string;
    newAttachments?: TaskAttachment[];
    recipientUserId?: string;
  }
): Promise<void> {
  const docRef = doc(db, 'tasks', taskId);
  const now = new Date().toISOString();

  const updatePayload: Record<string, any> = {
    status: newStatus,
    updated_at: now,
  };

  if (options?.employeeNote !== undefined) {
    updatePayload.employee_note = options.employeeNote;
  }

  if (options?.newAttachments && options.newAttachments.length > 0) {
    updatePayload.attachments = arrayUnion(...options.newAttachments);
  }

  await updateDoc(docRef, updatePayload);

  const statusName = TASK_STATUS_LABELS[newStatus] || newStatus;
  const isCompletion = newStatus === 'completed';

  // تسجيل نشاط تغيير الحالة
  await logTaskActivity(taskId, {
    task_id: taskId,
    user_id: actor.id,
    user_name: actor.name,
    user_role: actor.role,
    type: isCompletion ? 'task_completed' : 'status_changed',
    details: `تم تغيير حالة المهمة إلى "${statusName}"${
      options?.employeeNote ? ` (ملاحظة: ${options.employeeNote})` : ''
    }`,
  });

  // إرسال إشعار للطرف الآخر
  if (options?.recipientUserId && options.recipientUserId !== actor.id) {
    await createNotification({
      user_id: options.recipientUserId,
      actor_id: actor.id,
      actor_name: actor.name,
      task_id: taskId,
      task_title: taskTitle,
      type: 'status_changed',
      title: isCompletion ? 'تم إنجاز المهمة' : 'تحديث حالة المهمة',
      message: `قامت ${actor.name} بتحديث حالة "${taskTitle}" إلى: ${statusName}`,
      is_read: false,
    });
  }
}

// ==============================================================================
// Task Messages (المحادثة اللحظية المرتبطة بالمهمة)
// ==============================================================================

export function subscribeToTaskMessages(
  taskId: string,
  onUpdate: (messages: TaskMessage[]) => void
): () => void {
  try {
    const messagesCol = collection(db, 'tasks', taskId, 'messages');
    const q = query(messagesCol, orderBy('created_at', 'asc'));

    return onSnapshot(
      q,
      (snap) => {
        const msgs = snap.docs.map((d) => ({ ...d.data(), id: d.id } as TaskMessage));
        onUpdate(msgs);
      },
      (err) => {
        console.warn('subscribeToTaskMessages warning:', err?.message || err);
      }
    );
  } catch (err) {
    console.warn('Failed to subscribe to task messages:', err);
    return () => {};
  }
}

export async function sendTaskMessage(
  taskId: string,
  messageData: Omit<TaskMessage, 'id' | 'created_at'>,
  taskTitle: string,
  recipientUserId?: string
): Promise<TaskMessage> {
  const messagesCol = collection(db, 'tasks', taskId, 'messages');
  const now = new Date().toISOString();

  const payload = {
    ...messageData,
    created_at: now,
  };

  const docRef = await addDoc(messagesCol, payload);

  // تحديث تاريخ تعديل المهمة لفرز المهام النشطة
  await updateDoc(doc(db, 'tasks', taskId), {
    updated_at: now,
  }).catch(() => {});

  // تسجيل النشاط
  await logTaskActivity(taskId, {
    task_id: taskId,
    user_id: messageData.sender_id,
    user_name: messageData.sender_name,
    user_role: messageData.sender_role,
    type: 'message_sent',
    details: `أرسلت رسالة في محادثة المهمة`,
  });

  // إرسال إشعار فوري للطرف الآخر
  if (recipientUserId && recipientUserId !== messageData.sender_id) {
    await createNotification({
      user_id: recipientUserId,
      actor_id: messageData.sender_id,
      actor_name: messageData.sender_name,
      task_id: taskId,
      task_title: taskTitle,
      type: 'new_message',
      title: 'رسالة جديدة في المهمة',
      message: `${messageData.sender_name}: "${messageData.content.substring(0, 60)}${
        messageData.content.length > 60 ? '...' : ''
      }"`,
      is_read: false,
    });
  }

  return {
    ...payload,
    id: docRef.id,
  };
}

export async function markTaskMessagesAsRead(taskId: string, userId: string): Promise<void> {
  try {
    const messagesCol = collection(db, 'tasks', taskId, 'messages');
    const snap = await getDocs(messagesCol);
    const updates = snap.docs
      .filter((d) => {
        const data = d.data();
        return data.sender_id !== userId && (!data.read_by || !data.read_by.includes(userId));
      })
      .map((d) =>
        updateDoc(d.ref, {
          read_by: arrayUnion(userId),
        })
      );

    await Promise.allSettled(updates);
  } catch (err) {
    console.error('Error marking messages as read:', err);
  }
}

// ==============================================================================
// Task Activity Logs (سجل نشاط المهمة)
// ==============================================================================

export function subscribeToTaskActivities(
  taskId: string,
  onUpdate: (activities: TaskActivity[]) => void
): () => void {
  try {
    const activitiesCol = collection(db, 'tasks', taskId, 'activities');
    const q = query(activitiesCol, orderBy('created_at', 'desc'));

    return onSnapshot(
      q,
      (snap) => {
        const acts = snap.docs.map((d) => ({ ...d.data(), id: d.id } as TaskActivity));
        onUpdate(acts);
      },
      (err) => {
        console.warn('subscribeToTaskActivities warning:', err?.message || err);
      }
    );
  } catch (err) {
    console.warn('Failed to subscribe to task activities:', err);
    return () => {};
  }
}

export async function logTaskActivity(
  taskId: string,
  activityData: Omit<TaskActivity, 'id' | 'created_at'>
): Promise<void> {
  try {
    const activitiesCol = collection(db, 'tasks', taskId, 'activities');
    const now = new Date().toISOString();
    await addDoc(activitiesCol, {
      ...activityData,
      created_at: now,
    });
  } catch (err) {
    console.error('Error logging task activity:', err);
  }
}

// ==============================================================================
// Notifications (الإشعارات الداخلية)
// ==============================================================================

export function subscribeToUserNotifications(
  userId: string,
  onUpdate: (notifications: AppNotification[]) => void
): () => void {
  try {
    const notifsCol = collection(db, 'notifications');
    // استعلام بسيط بدون orderBy على حقل مركب لتفادي اشتراط وجود Composite Index في Firestore
    const q = query(notifsCol, where('user_id', '==', userId));

    return onSnapshot(
      q,
      (snap) => {
        const list = snap.docs.map((d) => ({ ...d.data(), id: d.id } as AppNotification));
        // ترتيب الإشعارات زمنياً من الأحدث إلى الأقدم في الذاكرة
        list.sort(
          (a, b) =>
            new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
        );
        onUpdate(list.slice(0, 30));
      },
      (err) => {
        console.warn('subscribeToUserNotifications warning:', err?.message || err);
      }
    );
  } catch (err) {
    console.warn('Failed to subscribe to user notifications:', err);
    return () => {};
  }
}

export async function createNotification(
  data: Omit<AppNotification, 'id' | 'created_at'>
): Promise<void> {
  try {
    const notifsCol = collection(db, 'notifications');
    const now = new Date().toISOString();
    await addDoc(notifsCol, {
      ...data,
      created_at: now,
    });
  } catch (err) {
    console.error('Error creating notification:', err);
  }
}

export async function markNotificationAsRead(notificationId: string): Promise<void> {
  try {
    const docRef = doc(db, 'notifications', notificationId);
    await updateDoc(docRef, { is_read: true });
  } catch (err) {
    console.error('Error marking notification as read:', err);
  }
}

export async function markAllNotificationsAsRead(userId: string): Promise<void> {
  try {
    const notifsCol = collection(db, 'notifications');
    const q = query(
      notifsCol,
      where('user_id', '==', userId),
      where('is_read', '==', false)
    );
    const snap = await getDocs(q);
    const batch = writeBatch(db);
    snap.docs.forEach((d) => {
      batch.update(d.ref, { is_read: true });
    });
    await batch.commit();
  } catch (err) {
    console.error('Error marking all notifications as read:', err);
  }
}

