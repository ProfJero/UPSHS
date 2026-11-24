// Build-time content loader. The site is pre-rendered on Cloudflare Pages and pulls
// published content from the UPSHS API Worker (Firestore). If the API is unreachable
// the site still builds, showing friendly empty states.

import { marked } from 'marked';

export const API_URL = (import.meta.env.PUBLIC_API_URL || 'https://upshs.profjero947.workers.dev').replace(/\/$/, '');
export const SITE_URL = (import.meta.env.PUBLIC_SITE_URL || 'https://upshs.pages.dev').replace(/\/$/, '');

export interface Media { url: string; alt?: string; caption?: string; width?: number | null; height?: number | null; publicId?: string }
export interface FileRef { url: string; name?: string; bytes?: number | null; format?: string }

interface Base { id: string; slug?: string; status?: string; createdAt?: string; updatedAt?: string; publishedAt?: string | null }
export interface NewsPost extends Base { title: string; slug: string; excerpt?: string; body: string; coverImage?: Media | null; category?: string; author?: string; tags?: string[]; featured?: boolean }
export interface Announcement extends Base { title: string; body: string; priority?: 'normal' | 'important' | 'urgent'; pinned?: boolean; linkUrl?: string; linkLabel?: string; expiresAt?: string | null }
export interface SchoolEvent extends Base { title: string; slug: string; summary?: string; body?: string; startsAt: string; endsAt?: string | null; allDay?: boolean; location?: string; category?: string; coverImage?: Media | null }
export interface Album extends Base { title: string; slug: string; description?: string; date?: string | null; coverImage?: Media | null; images?: Media[] }
export interface Download extends Base { title: string; category?: string; file: FileRef; description?: string }
export interface Person extends Base { name: string; role: string; group?: string; order?: number | null; photo?: Media | null; bio?: string }
export interface Achievement extends Base { title: string; year?: number | null; category?: string; description?: string; image?: Media | null }

export interface Settings {
  schoolName?: string; shortName?: string; motto?: string; heroTitle?: string; heroSubtitle?: string; heroImage?: Media | null;
  headName?: string; headTitle?: string; headPhoto?: Media | null; headMessage?: string;
  studentCount?: number | null; staffCount?: number | null; alumniCount?: number | null; clubCount?: number | null;
  address?: string; phone?: string; email?: string; whatsapp?: string; officeHours?: string;
  facebook?: string; instagram?: string; x?: string; youtube?: string; tiktok?: string; linkedin?: string;
}

export interface Bundle {
  generatedAt: string;
  online: boolean;
  settings: Settings;
  news: NewsPost[];
  announcements: Announcement[];
  events: SchoolEvent[];
  albums: Album[];
  downloads: Download[];
  leadership: Person[];
  achievements: Achievement[];
}

const empty: Bundle = {
  generatedAt: new Date().toISOString(), online: false, settings: {},
  news: [], announcements: [], events: [], albums: [], downloads: [], leadership: [], achievements: [],
};

let bundlePromise: Promise<Bundle> | null = null;

export function getContent(): Promise<Bundle> {
  bundlePromise ??= (async () => {
    try {
      const res = await fetch(`${API_URL}/v1/public/bundle`, { signal: AbortSignal.timeout(20_000), headers: { accept: 'application/json' } });
      if (!res.ok || !res.headers.get('content-type')?.includes('json')) throw new Error(`API responded ${res.status}`);
      const data = (await res.json()) as Partial<Bundle>;
      const merged = { ...empty, ...data, online: true } as Bundle;
      for (const k of ['news', 'announcements', 'events', 'albums', 'downloads', 'leadership', 'achievements'] as const) {
        if (!Array.isArray(merged[k])) (merged as unknown as Record<string, unknown[]>)[k] = [];
      }
      merged.settings = merged.settings || {};
      return merged;
    } catch (e) {
      console.warn(`[content] Could not load content from ${API_URL} — building with empty collections. (${(e as Error).message})`);
      return empty;
    }
  })();
  return bundlePromise;
}

export const school = async () => {
  const { settings } = await getContent();
  return {
    name: settings.schoolName || 'University Practice Senior High School',
    shortName: settings.shortName || 'UPSHS',
    motto: settings.motto || 'Service to the Community',
    ...settings,
  };
};

// ---------- media ----------

/** Adds Cloudinary delivery transformations (auto format/quality, resizing). Non-Cloudinary URLs are returned unchanged. */
export function cld(url: string | undefined | null, opts: { w?: number; h?: number; crop?: 'fill' | 'limit' | 'thumb'; gravity?: string } = {}): string {
  if (!url) return '';
  if (!url.includes('res.cloudinary.com') || !url.includes('/upload/')) return url;
  const t = ['f_auto', 'q_auto', 'dpr_auto'];
  if (opts.w) t.push(`w_${opts.w}`);
  if (opts.h) t.push(`h_${opts.h}`);
  t.push(`c_${opts.crop || (opts.h ? 'fill' : 'limit')}`);
  if (opts.h || opts.crop === 'fill') t.push(`g_${opts.gravity || 'auto'}`);
  return url.replace('/upload/', `/upload/${t.join(',')}/`);
}

export function srcset(url: string | undefined | null, widths: number[], ratio?: number): string | undefined {
  if (!url || !url.includes('res.cloudinary.com')) return undefined;
  return widths.map((w) => `${cld(url, { w, h: ratio ? Math.round(w / ratio) : undefined })} ${w}w`).join(', ');
}

// ---------- text ----------

const renderer = new marked.Renderer();
// Staff-authored Markdown: raw HTML is escaped rather than rendered.
renderer.html = ({ text }: { text: string }) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
renderer.link = ({ href, title, text }: { href: string; title?: string | null; text: string }) => {
  const safe = /^(https?:|mailto:|tel:|\/|#)/i.test(href) ? href : '#';
  const ext = /^https?:/i.test(safe) && !safe.startsWith(SITE_URL);
  return `<a href="${safe}"${title ? ` title="${title}"` : ''}${ext ? ' target="_blank" rel="noopener noreferrer"' : ''}>${text}</a>`;
};
renderer.image = ({ href, title, text }: { href: string; title?: string | null; text: string }) =>
  /^https:/i.test(href) ? `<figure><img src="${cld(href, { w: 1400 })}" alt="${text || ''}" loading="lazy" decoding="async" />${title ? `<figcaption>${title}</figcaption>` : ''}</figure>` : '';

export function markdown(src: string | undefined | null): string {
  if (!src) return '';
  return marked.parse(src, { renderer, gfm: true, breaks: false, async: false }) as string;
}

export function plain(src: string | undefined | null, max = 180): string {
  const text = (src || '').replace(/!\[[^\]]*\]\([^)]*\)/g, '').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').replace(/[#>*_`~\-]+/g, ' ').replace(/\s+/g, ' ').trim();
  return text.length > max ? `${text.slice(0, max - 1).replace(/\s+\S*$/, '')}…` : text;
}

export function readingTime(src: string | undefined | null): number {
  return Math.max(1, Math.round((src || '').split(/\s+/).length / 220));
}

// ---------- dates ----------

const TZ = 'Africa/Accra';
export function fmtDate(v: string | null | undefined, o: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long', year: 'numeric' }): string {
  if (!v) return '';
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? '' : new Intl.DateTimeFormat('en-GB', { timeZone: TZ, ...o }).format(d);
}
export const fmtTime = (v: string | null | undefined) => fmtDate(v, { hour: 'numeric', minute: '2-digit', hour12: true });
export const dayNum = (v: string) => fmtDate(v, { day: '2-digit' });
export const monthShort = (v: string) => fmtDate(v, { month: 'short' });

export function eventWhen(e: SchoolEvent): string {
  const start = fmtDate(e.startsAt, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
  if (e.allDay) {
    if (e.endsAt && fmtDate(e.endsAt) !== fmtDate(e.startsAt)) return `${start} – ${fmtDate(e.endsAt, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}`;
    return `${start} · All day`;
  }
  return `${start} · ${fmtTime(e.startsAt)}${e.endsAt ? ` – ${fmtTime(e.endsAt)}` : ''}`;
}

export function isUpcoming(e: SchoolEvent, now = Date.now()): boolean {
  return new Date(e.endsAt || e.startsAt).getTime() >= now - 12 * 3600_000;
}

export function bytes(n?: number | null): string {
  if (!n) return '';
  const u = ['B', 'KB', 'MB', 'GB'];
  let i = 0, v = n;
  while (v >= 1024 && i < u.length - 1) { v /= 1024; i++; }
  return `${v.toFixed(v < 10 && i ? 1 : 0)} ${u[i]}`;
}

export function socials(s: Settings): { name: string; icon: string; url: string }[] {
  const list: [keyof Settings, string, string][] = [
    ['facebook', 'Facebook', 'facebook'], ['instagram', 'Instagram', 'instagram'], ['x', 'X', 'x-social'],
    ['youtube', 'YouTube', 'youtube'], ['tiktok', 'TikTok', 'tiktok'], ['linkedin', 'LinkedIn', 'linkedin'],
  ];
  return list.filter(([k]) => typeof s[k] === 'string' && /^https?:\/\//.test(s[k] as string)).map(([k, name, icon]) => ({ name, icon, url: s[k] as string }));
}
