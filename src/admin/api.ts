import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth, type User } from 'firebase/auth';

export const API_URL = (import.meta.env.PUBLIC_API_URL || 'https://upshs.profjero947.workers.dev').replace(/\/$/, '');

const firebaseConfig = {
  apiKey: import.meta.env.PUBLIC_FIREBASE_API_KEY,
  authDomain: import.meta.env.PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.PUBLIC_FIREBASE_PROJECT_ID,
  appId: import.meta.env.PUBLIC_FIREBASE_APP_ID,
};
export const firebaseConfigured = Boolean(firebaseConfig.apiKey && firebaseConfig.authDomain && firebaseConfig.projectId);

let app: FirebaseApp | null = null;
export function auth(): Auth {
  app ??= getApps()[0] || initializeApp(firebaseConfig);
  return getAuth(app);
}

export class ApiError extends Error {
  constructor(message: string, public status: number) { super(message); }
}

let currentUser: User | null = null;
export const setApiUser = (u: User | null) => { currentUser = u; };

export async function api<T = unknown>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const token = await currentUser?.getIdToken();
  let res: Response;
  try {
    res = await fetch(`${API_URL}/v1/admin${path}`, {
      method: init.method || 'GET',
      headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), ...(init.body !== undefined ? { 'content-type': 'application/json' } : {}) },
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
    });
  } catch {
    throw new ApiError(`Could not reach the API at ${API_URL}. Check your connection or the API deployment.`, 0);
  }
  const data = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) throw new ApiError(data.error || `Request failed (${res.status})`, res.status);
  return data as T;
}

export interface UploadResult { url: string; publicId: string; width?: number; height?: number; bytes?: number; format?: string; name?: string }

/** Signed direct upload to Cloudinary, with progress. */
export async function upload(file: File, folder: string, onProgress?: (pct: number) => void): Promise<UploadResult> {
  const sig = await api<{ cloudName: string; apiKey: string; signature: string; timestamp: number; folder: string }>('/media/sign', { method: 'POST', body: { folder } });
  const isImage = file.type.startsWith('image/');
  const fd = new FormData();
  fd.append('file', file);
  fd.append('api_key', sig.apiKey);
  fd.append('timestamp', String(sig.timestamp));
  fd.append('signature', sig.signature);
  fd.append('folder', sig.folder);
  const endpoint = `https://api.cloudinary.com/v1_1/${sig.cloudName}/${isImage ? 'image' : 'raw'}/upload`;
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', endpoint);
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress?.(Math.round((e.loaded / e.total) * 100));
    xhr.onload = () => {
      const r = JSON.parse(xhr.responseText || '{}');
      if (xhr.status >= 300) return reject(new Error(r.error?.message || 'Upload failed'));
      resolve({ url: r.secure_url, publicId: r.public_id, width: r.width, height: r.height, bytes: r.bytes, format: r.format || file.name.split('.').pop(), name: file.name });
    };
    xhr.onerror = () => reject(new Error('Upload failed — check your connection.'));
    xhr.send(fd);
  });
}

export function thumb(url: string, w = 240, h = 160): string {
  return url.includes('res.cloudinary.com') && url.includes('/image/upload/') ? url.replace('/upload/', `/upload/f_auto,q_auto,w_${w},h_${h},c_fill,g_auto/`) : url;
}
