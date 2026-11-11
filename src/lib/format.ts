export function formatDate(value: string | null | undefined, options: Intl.DateTimeFormatOptions = {}) {
  if (!value) return 'Date to be announced';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Date to be announced';
  return new Intl.DateTimeFormat('en-GH', { day: 'numeric', month: 'short', year: 'numeric', ...options }).format(date);
}

export function readingTime(content: string) {
  return Math.max(1, Math.ceil((content || '').trim().split(/\s+/).length / 220));
}

export function slugify(value: string) {
  return value.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

export function safeHttpUrl(value: string | null | undefined) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : null;
  } catch {
    return null;
  }
}
