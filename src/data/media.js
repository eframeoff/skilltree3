import { supabase } from './supabase.js';
import { uuid } from './treeUtils.js';

const BUCKET = 'attempts';

export function partKind(file) {
  if (file.type.startsWith('video')) return 'video';
  if (file.type.startsWith('image')) return 'photo';
  if (file.type.startsWith('audio')) return 'audio';
  return 'file';
}

// Downscale + re-encode photos before upload — a phone photo is often several MB
// at full resolution, which uploads and renders slowly. ~1600px JPEG is plenty
// for review and a fraction of the size. Non-images pass through untouched.
async function compressImage(file, maxDim = 1600, quality = 0.82) {
  if (!file.type.startsWith('image/')) return file;
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, maxDim / Math.max(bmp.width, bmp.height));
    const w = Math.round(bmp.width * scale);
    const h = Math.round(bmp.height * scale);
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    canvas.getContext('2d').drawImage(bmp, 0, 0, w, h);
    const blob = await new Promise((res) => canvas.toBlob(res, 'image/jpeg', quality));
    if (!blob || blob.size >= file.size) return file; // keep original if no win
    return new File([blob], file.name.replace(/\.\w+$/, '.jpg'), { type: 'image/jpeg' });
  } catch {
    return file;
  }
}

const MAX_BYTES = 50 * 1024 * 1024; // matches the bucket's fileSizeLimit

// Upload a file into a folder of the (private) bucket; returns the storage path.
async function uploadTo(file, folder) {
  const toUpload = await compressImage(file);
  if (toUpload.size > MAX_BYTES) {
    throw new Error('Файл больше 50 МБ — снимите ролик короче или сожмите.');
  }
  const ext = (toUpload.name.split('.').pop() || 'bin').toLowerCase();
  const path = `${folder}/${uuid()}.${ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, toUpload, { contentType: toUpload.type });
  if (error) throw error;
  return path;
}

// Student attempt media → stored under the student's folder.
export const uploadAttemptFile = (file, studentId) => uploadTo(file, studentId);

// Coach guide media (photo/video/file embedded in a node's instruction).
export const uploadGuideFile = (file, treeId) => uploadTo(file, `guides/${treeId}`);

// Short-lived signed URL for viewing a private object.
export async function signedUrl(path) {
  if (!path) return null;
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 3600);
  if (error) { console.error('[media] signedUrl:', error.message); return null; }
  return data.signedUrl;
}
