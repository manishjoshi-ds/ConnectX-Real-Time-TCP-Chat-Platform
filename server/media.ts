import fs from 'node:fs';
import path from 'node:path';
import type { MediaCategory } from '../src/types/chat.ts';

export const UPLOADS_ROOT = path.resolve(process.cwd(), 'uploads');
export const MEDIA_DIR = path.join(UPLOADS_ROOT, 'media');
export const AVATARS_DIR = path.join(UPLOADS_ROOT, 'avatars');

export const MAX_MEDIA_BYTES = 50 * 1024 * 1024; // 50 MB ceiling for multer

interface MediaSpec {
  extensions: Set<string>;
  mimes: Set<string>;
  maxBytes: number;
  label: string;
}

export const MEDIA_RULES: Record<MediaCategory, MediaSpec> = {
  image: {
    extensions: new Set(['.jpg', '.jpeg', '.png', '.webp']),
    mimes: new Set(['image/jpeg', 'image/png', 'image/webp']),
    maxBytes: 10 * 1024 * 1024,
    label: 'Images (JPG, JPEG, PNG, WEBP up to 10 MB)',
  },
  video: {
    extensions: new Set(['.mp4', '.webm']),
    mimes: new Set(['video/mp4', 'video/webm']),
    maxBytes: 50 * 1024 * 1024,
    label: 'Videos (MP4, WEBM up to 50 MB)',
  },
  document: {
    extensions: new Set(['.pdf', '.doc', '.docx', '.txt', '.ppt', '.pptx', '.xls', '.xlsx']),
    mimes: new Set([
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/octet-stream',
    ]),
    maxBytes: 20 * 1024 * 1024,
    label: 'Documents (PDF, DOC, DOCX, TXT, PPT, PPTX, XLS, XLSX up to 20 MB)',
  },
  audio: {
    extensions: new Set(['.mp3', '.wav', '.ogg', '.m4a', '.webm']),
    mimes: new Set([
      'audio/mpeg',
      'audio/mp3',
      'audio/wav',
      'audio/x-wav',
      'audio/wave',
      'audio/vnd.wave',
      'audio/ogg',
      'audio/mp4',
      'audio/x-m4a',
      'audio/webm',
      'video/webm',
    ]),
    maxBytes: 20 * 1024 * 1024,
    label: 'Audio (MP3, WAV, OGG, M4A, WEBM up to 20 MB)',
  },
  avatar: {
    extensions: new Set(['.jpg', '.jpeg', '.png', '.webp']),
    mimes: new Set(['image/jpeg', 'image/png', 'image/webp']),
    maxBytes: 5 * 1024 * 1024,
    label: 'Profile or Group Photo (JPG, JPEG, PNG, WEBP up to 5 MB)',
  },
};

export function ensureUploadDirs() {
  fs.mkdirSync(MEDIA_DIR, { recursive: true });
  fs.mkdirSync(AVATARS_DIR, { recursive: true });
}

export function sanitizeOriginalFilename(rawName: string): string {
  const base = path.basename(rawName || 'attachment');
  const cleaned = base
    .replace(/[\x00-\x1f\x7f<>:"/\\|?*]+/g, '_')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned) return 'attachment';
  return cleaned.slice(0, 120);
}

export function detectAndValidateMedia(
  originalName: string,
  mimeType: string,
  sizeBytes: number,
  requestedCategory?: string,
): { valid: boolean; category?: MediaCategory; ext?: string; error?: string } {
  const ext = path.extname(originalName || '').toLowerCase();
  const normalizedMime = (mimeType || '').toLowerCase().split(';')[0].trim();

  if (!ext) {
    return { valid: false, error: 'File must have a valid extension.' };
  }

  let category: MediaCategory | undefined;
  if (
    requestedCategory === 'image' ||
    requestedCategory === 'video' ||
    requestedCategory === 'document' ||
    requestedCategory === 'audio' ||
    requestedCategory === 'avatar'
  ) {
    category = requestedCategory;
  } else {
    for (const key of ['image', 'video', 'document', 'audio'] as const) {
      if (MEDIA_RULES[key].extensions.has(ext)) {
        category = key;
        break;
      }
    }
  }

  if (!category) {
    return {
      valid: false,
      error: `Unsupported file type "${ext}". Allowed: JPG, PNG, WEBP, MP4, WEBM, PDF, DOC/DOCX, TXT, PPT/PPTX, XLS/XLSX, MP3, WAV.`,
    };
  }

  const rule = MEDIA_RULES[category];
  if (!rule.extensions.has(ext)) {
    return {
      valid: false,
      error: `Invalid file extension "${ext}" for ${category}. Expected ${rule.label}.`,
    };
  }

  if (normalizedMime && !rule.mimes.has(normalizedMime)) {
    return {
      valid: false,
      error: `Unsupported MIME type "${normalizedMime}" for ${category}.`,
    };
  }

  if (sizeBytes <= 0) {
    return { valid: false, error: 'Uploaded file cannot be empty.' };
  }

  if (sizeBytes > rule.maxBytes) {
    const maxMb = Math.round(rule.maxBytes / (1024 * 1024));
    return {
      valid: false,
      error: `File exceeds the ${maxMb} MB limit for ${category}.`,
    };
  }

  return { valid: true, category, ext };
}

export function resolveSafeStoragePath(storedFilename: string, isAvatar: boolean): string | null {
  const baseDir = isAvatar ? AVATARS_DIR : MEDIA_DIR;
  const safeName = path.basename(storedFilename);
  if (!safeName || safeName !== storedFilename) return null;
  const resolved = path.resolve(baseDir, safeName);
  if (!resolved.startsWith(baseDir + path.sep)) return null;
  return resolved;
}
