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
 * رفع ملف إلى Firebase Storage وحفظه في مسار المهمة
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

  return new Promise((resolve, reject) => {
    uploadTask.on(
      'state_changed',
      (snapshot) => {
        const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
        if (onProgress) {
          onProgress(Math.round(progress));
        }
      },
      (error) => {
        console.error('Firebase Storage upload error:', error);
        reject(new Error(`فشل رفع الملف: ${error.message}`));
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
          reject(new Error(`فشل استخراج رابط الملف بعد الرفع: ${err.message}`));
        }
      }
    );
  });
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
