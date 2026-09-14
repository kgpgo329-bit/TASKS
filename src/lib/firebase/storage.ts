import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage';
import { storage } from './config';
import { TaskAttachment, UserRole } from './types';

// الصيغ المسموحة للملفات والصور
export const ALLOWED_FILE_EXTENSIONS = [
  'pdf',
  'doc',
  'docx',
  'xls',
  'xlsx',
  'png',
  'jpg',
  'jpeg',
  'webp',
];

// الحد الأقصى لحجم الملف (15 ميغابايت)
export const MAX_FILE_SIZE_BYTES = 15 * 1024 * 1024;

/**
 * تنسيق حجم الملف للعرض المريح (مثل: 2.4 MB أو 450 KB)
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

/**
 * فحص صلاحية امتداد وحجم الملف
 */
export function validateFile(file: File): { valid: boolean; error?: string } {
  const extension = file.name.split('.').pop()?.toLowerCase() || '';
  if (!ALLOWED_FILE_EXTENSIONS.includes(extension)) {
    return {
      valid: false,
      error: `نوع الملف (.${extension}) غير مدعوم. الأنواع المدعومة: PDF, Word, Excel, والصور (PNG, JPG, WebP).`,
    };
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    return {
      valid: false,
      error: `حجم الملف (${formatFileSize(file.size)}) يتجاوز الحد الأقصى المسموح به (15 ميغابايت).`,
    };
  }

  return { valid: true };
}

/**
 * تحويل الملف إلى رابط بيانات Base64 محلي كحل احتياطي سريع ومضمون 100% في حال بطء أو توقف التخزين السحابي
 */
export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('فشل قراءة الملف محلياً'));
    reader.readAsDataURL(file);
  });
}

/**
 * رفع ملف إلى Firebase Storage وحفظه في مسار المهمة مع حماية من التعليق
 */
export async function uploadTaskFile(
  taskId: string,
  file: File,
  uploader: { id: string; name: string; role: UserRole },
  onProgress?: (progressPercent: number) => void
): Promise<TaskAttachment> {
  const validation = validateFile(file);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  // تنظيف اسم الملف من الرموز الخاصة لتجنب مشاكل الروابط
  const cleanName = file.name.replace(/[^a-zA-Z0-9._\u0600-\u06FF-]/g, '_');
  const uniquePrefix = `${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const storagePath = `tasks/${taskId}/${uniquePrefix}_${cleanName}`;

  // محاولة الرفع السحابي مع مهلة 6 ثوانٍ كحد أقصى لمنع تعليق واجهة المستخدم
  try {
    const uploadPromise = new Promise<TaskAttachment>((resolve, reject) => {
      try {
        const storageRef = ref(storage, storagePath);
        const uploadTask = uploadBytesResumable(storageRef, file, {
          contentType: file.type || 'application/octet-stream',
          customMetadata: {
            originalName: file.name,
            uploaderId: uploader.id,
            uploaderName: uploader.name,
            uploaderRole: uploader.role,
            taskId: taskId,
          },
        });

        uploadTask.on(
          'state_changed',
          (snapshot) => {
            const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
            if (onProgress) {
              onProgress(Math.round(progress));
            }
          },
          (error) => {
            reject(error);
          },
          async () => {
            try {
              const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref);
              const attachment: TaskAttachment = {
                id: uniquePrefix,
                name: file.name,
                url: downloadUrl,
                storage_path: storagePath,
                size: file.size,
                type: file.type || 'application/octet-stream',
                uploader_id: uploader.id,
                uploader_name: uploader.name,
                uploader_role: uploader.role,
                created_at: new Date().toISOString(),
              };
              resolve(attachment);
            } catch (err: any) {
              reject(err);
            }
          }
        );
      } catch (err) {
        reject(err);
      }
    });

    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('TIMEOUT_STORAGE')), 6000)
    );

    return await Promise.race([uploadPromise, timeoutPromise]);
  } catch (err) {
    // في حال تعذر التخزين السحابي والملف 2 ميغابايت أو أقل يتم تحويله فوراً لبيانات مدمجة لضمان إرسال المهمة دون أي تعليق
    if (file.size <= 2 * 1024 * 1024 && typeof window !== 'undefined') {
      console.warn('Firebase Storage unavailable or timed out, using embedded fallback:', err);
      const dataUrl = await fileToDataUrl(file);
      if (onProgress) onProgress(100);
      return {
        id: uniquePrefix,
        name: file.name,
        url: dataUrl,
        storage_path: `embedded/${taskId}/${uniquePrefix}_${cleanName}`,
        size: file.size,
        type: file.type || 'application/octet-stream',
        uploader_id: uploader.id,
        uploader_name: uploader.name,
        uploader_role: uploader.role,
        created_at: new Date().toISOString(),
      };
    }

    throw new Error(
      `تعذر رفع الملف (${file.name}). يرجى التأكد من أن حجم الملف أقل من 2 ميغابايت والمحاولة مجدداً.`
    );
  }
}

/**
 * حذف ملف من Firebase Storage
 */
export async function deleteTaskFile(storagePath: string): Promise<void> {
  try {
    const fileRef = ref(storage, storagePath);
    await deleteObject(fileRef);
  } catch (err) {
    console.error('Error deleting file from storage:', err);
  }
}
