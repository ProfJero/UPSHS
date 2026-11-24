import type { Field } from '../../shared/collections';
import { slugify } from '../../shared/collections';
import type { Json } from './firestore';

const str = (v: unknown, max = 2000) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

function safeUrl(v: unknown): string {
  const s = str(v, 2000);
  if (!s) return '';
  try {
    const u = new URL(s);
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.toString() : '';
  } catch {
    return '';
  }
}

function isoDate(v: unknown): string | null {
  if (typeof v !== 'string' || !v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function image(v: unknown): Json {
  if (!v || typeof v !== 'object') return null;
  const o = v as Record<string, unknown>;
  const url = safeUrl(o.url);
  if (!url) return null;
  return {
    url,
    publicId: str(o.publicId, 300),
    alt: str(o.alt, 300),
    caption: str(o.caption, 500),
    width: typeof o.width === 'number' ? o.width : null,
    height: typeof o.height === 'number' ? o.height : null,
  };
}

export class ValidationError extends Error {}

/** Coerces input to the schema, dropping unknown fields. */
export function sanitize(fields: Field[], input: Record<string, unknown>, opts: { partial?: boolean } = {}): Record<string, Json> {
  const out: Record<string, Json> = {};
  for (const f of fields) {
    if (opts.partial && !(f.name in input)) continue;
    const v = input[f.name];
    let val: Json;
    switch (f.type) {
      case 'text': case 'textarea': case 'markdown':
        val = str(v, f.max || (f.type === 'markdown' ? 60000 : f.type === 'textarea' ? 4000 : 300));
        break;
      case 'slug':
        val = slugify(str(v, 120));
        break;
      case 'email': {
        const e = str(v, 254).toLowerCase();
        val = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) ? e : '';
        break;
      }
      case 'url': val = safeUrl(v); break;
      case 'datetime': case 'date': val = isoDate(v); break;
      case 'select': {
        const s = str(v, 80);
        val = f.options?.includes(s) ? s : f.options?.[0] ?? '';
        if (!s && f.name !== 'status') val = '';
        break;
      }
      case 'boolean': val = v === true || v === 'true'; break;
      case 'number': {
        const n = typeof v === 'number' ? v : Number(v);
        val = v === '' || v === null || v === undefined || Number.isNaN(n) ? null : n;
        break;
      }
      case 'tags':
        val = (Array.isArray(v) ? v : typeof v === 'string' ? v.split(',') : [])
          .map((t) => str(t, 40)).filter(Boolean).slice(0, 20);
        break;
      case 'image': val = image(v); break;
      case 'gallery':
        val = (Array.isArray(v) ? v : []).map(image).filter((x) => x !== null).slice(0, 300);
        break;
      case 'file': {
        if (!v || typeof v !== 'object') { val = null; break; }
        const o = v as Record<string, unknown>;
        const url = safeUrl(o.url);
        val = url ? { url, name: str(o.name, 200), bytes: typeof o.bytes === 'number' ? o.bytes : null, format: str(o.format, 20), publicId: str(o.publicId, 300) } : null;
        break;
      }
    }
    if (f.required && (val === '' || val === null || (Array.isArray(val) && !val.length))) {
      throw new ValidationError(`${f.label} is required.`);
    }
    out[f.name] = val;
  }
  return out;
}
