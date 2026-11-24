import { Hono, type Context } from 'hono';
import { cors } from 'hono/cors';
import { COLLECTIONS, INBOXES, SETTINGS_FIELDS, ROLES, can, findCollection, slugify, type Role } from '../../shared/collections';
import { Firestore, NotFoundError, type Doc, type Json } from './firestore';
import { cloudinarySignature, parseServiceAccount, verifyFirebaseToken, type FirebaseUser } from './google';
import { sanitize, ValidationError } from './sanitize';

export interface Env {
  FIREBASE_PROJECT_ID: string;
  FIREBASE_SERVICE_ACCOUNT?: string;
  CLOUDINARY_CLOUD_NAME: string;
  CLOUDINARY_API_KEY: string;
  CLOUDINARY_API_SECRET?: string;
  CLOUDINARY_FOLDER: string;
  ALLOWED_ORIGINS: string;
  SUPER_ADMIN_EMAILS: string;
  TURNSTILE_SECRET_KEY?: string;
  REBUILD_HOOK_URL?: string;
}

type Vars = { user: FirebaseUser; role: Role; db: Firestore };
type C = Context<{ Bindings: Env; Variables: Vars }>;

const app = new Hono<{ Bindings: Env; Variables: Vars }>();
const SYSTEM_FIELDS = ['createdAt', 'updatedAt', 'createdBy', 'updatedBy'];
const BUNDLE_CACHE_KEY = 'https://upshs-api.internal/v1/public/bundle';

// ---------- helpers ----------

function allowedOrigin(origin: string | undefined, env: Env): boolean {
  if (!origin) return false;
  const list = env.ALLOWED_ORIGINS.split(',').map((s) => s.trim()).filter(Boolean);
  if (list.includes(origin)) return true;
  // Cloudflare Pages preview deployments, e.g. https://abc123.upshs.pages.dev
  return /^https:\/\/[a-z0-9-]+\.upshs\.pages\.dev$/.test(origin);
}

function getDb(env: Env): Firestore | null {
  const sa = parseServiceAccount(env.FIREBASE_SERVICE_ACCOUNT);
  return sa ? new Firestore(sa, env.FIREBASE_PROJECT_ID || sa.project_id) : null;
}

function projectId(env: Env): string {
  return env.FIREBASE_PROJECT_ID || parseServiceAccount(env.FIREBASE_SERVICE_ACCOUNT)?.project_id || '';
}

const err = (c: C | Context, message: string, status: 400 | 401 | 403 | 404 | 409 | 413 | 415 | 429 | 500 | 502 | 503) =>
  c.json({ error: message }, status);

function publicView(doc: Doc): Doc {
  const out = { ...doc };
  for (const k of ['createdBy', 'updatedBy']) delete out[k];
  return out;
}

const time = (v: Json | undefined) => (typeof v === 'string' ? new Date(v).getTime() || 0 : typeof v === 'number' ? v : 0);

function isLive(collection: string, d: Doc, now: number): boolean {
  if (d.status !== 'published') return false;
  if (d.publishedAt && time(d.publishedAt) > now) return false;
  if (collection === 'announcements' && d.expiresAt && time(d.expiresAt) <= now) return false;
  return true;
}

function sortDocs(collection: string, docs: Doc[]): Doc[] {
  const def = findCollection(collection);
  const field = def?.sortField || 'createdAt';
  const asc = field === 'order' || field === 'startsAt';
  return docs.sort((a, b) => {
    const av = field === 'order' || field === 'year' ? Number(a[field] ?? 9999) : time(a[field] ?? a.createdAt);
    const bv = field === 'order' || field === 'year' ? Number(b[field] ?? 9999) : time(b[field] ?? b.createdAt);
    if (collection === 'news' && a.featured !== b.featured) return a.featured ? -1 : 1;
    return asc ? av - bv : bv - av;
  });
}

async function readJson(c: C | Context, limit = 200_000): Promise<Record<string, unknown> | Response> {
  if (!c.req.header('content-type')?.includes('application/json')) return err(c, 'JSON body required.', 415);
  const text = await c.req.text();
  if (text.length > limit) return err(c, 'Request is too large.', 413);
  try {
    const parsed: unknown = JSON.parse(text);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return err(c, 'Invalid request.', 400);
    return parsed as Record<string, unknown>;
  } catch {
    return err(c, 'Invalid JSON.', 400);
  }
}

async function verifyTurnstile(env: Env, token: unknown, ip: string | undefined): Promise<boolean> {
  if (!env.TURNSTILE_SECRET_KEY) return true; // Turnstile optional
  if (typeof token !== 'string' || !token) return false;
  const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    body: new URLSearchParams({ secret: env.TURNSTILE_SECRET_KEY, response: token, remoteip: ip || '' }),
  });
  const data = (await res.json()) as { success?: boolean };
  return data.success === true;
}

let lastRebuild = 0;
async function requestRebuild(env: Env, force = false): Promise<boolean> {
  if (!env.REBUILD_HOOK_URL) return false;
  if (!force && Date.now() - lastRebuild < 20_000) return true;
  lastRebuild = Date.now();
  const res = await fetch(env.REBUILD_HOOK_URL, { method: 'POST' });
  return res.ok;
}

async function invalidatePublicCache() {
  try { await caches.default.delete(BUNDLE_CACHE_KEY); } catch { /* not available in all runtimes */ }
}

async function buildBundle(db: Firestore) {
  const now = Date.now();
  const entries = await Promise.all(
    COLLECTIONS.map(async (def) => {
      const docs = await db.where(def.key, 'status', 'published');
      return [def.key, sortDocs(def.key, docs.filter((d) => isLive(def.key, d, now)).map(publicView))] as const;
    }),
  );
  const settings = await db.get('site', 'settings');
  return { generatedAt: new Date(now).toISOString(), settings: settings ? publicView(settings) : {}, ...Object.fromEntries(entries) };
}

// ---------- middleware ----------

app.use('*', async (c, next) => {
  await next();
  c.header('X-Content-Type-Options', 'nosniff');
  c.header('Referrer-Policy', 'strict-origin-when-cross-origin');
});

app.use('/v1/*', cors({
  origin: (origin, c) => (allowedOrigin(origin, c.env) ? origin : null),
  allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowHeaders: ['authorization', 'content-type'],
  maxAge: 86400,
}));

app.onError((e, c) => {
  if (e instanceof ValidationError) return c.json({ error: e.message }, 400);
  if (e instanceof NotFoundError) return c.json({ error: 'Not found.' }, 404);
  console.error(e);
  return c.json({ error: 'Something went wrong on the server.' }, 500);
});

// ---------- public ----------

app.get('/', (c) =>
  c.json({
    name: 'University Practice Senior High School API',
    website: 'https://upshs.pages.dev',
    endpoints: ['/v1/health', '/v1/public/bundle', '/v1/public/:collection', '/v1/public/:collection/:slug'],
  }),
);

app.get('/v1/health', (c) =>
  c.json({
    ok: true,
    firestore: Boolean(getDb(c.env)),
    cloudinary: Boolean(c.env.CLOUDINARY_CLOUD_NAME && c.env.CLOUDINARY_API_KEY && c.env.CLOUDINARY_API_SECRET),
    turnstile: Boolean(c.env.TURNSTILE_SECRET_KEY),
    rebuildHook: Boolean(c.env.REBUILD_HOOK_URL),
  }),
);

app.get('/v1/public/bundle', async (c) => {
  const db = getDb(c.env);
  if (!db) return err(c, 'Content service is not configured yet.', 503);
  const cache = caches.default;
  const hit = await cache.match(BUNDLE_CACHE_KEY);
  if (hit) return new Response(hit.body, hit);
  const res = c.json(await buildBundle(db));
  res.headers.set('Cache-Control', 'public, max-age=30, s-maxage=60');
  c.executionCtx.waitUntil(cache.put(BUNDLE_CACHE_KEY, res.clone()));
  return res;
});

app.get('/v1/public/:collection', async (c) => {
  const def = COLLECTIONS.find((d) => d.key === c.req.param('collection'));
  if (!def) return err(c, 'Unknown collection.', 404);
  const db = getDb(c.env);
  if (!db) return err(c, 'Content service is not configured yet.', 503);
  const limit = Math.min(Number(c.req.query('limit') || 100), 500);
  const docs = sortDocs(def.key, (await db.where(def.key, 'status', 'published')).filter((d) => isLive(def.key, d, Date.now())));
  c.header('Cache-Control', 'public, max-age=30, s-maxage=60');
  return c.json({ items: docs.slice(0, limit).map(publicView) });
});

app.get('/v1/public/:collection/:slug', async (c) => {
  const def = COLLECTIONS.find((d) => d.key === c.req.param('collection'));
  if (!def) return err(c, 'Unknown collection.', 404);
  const db = getDb(c.env);
  if (!db) return err(c, 'Content service is not configured yet.', 503);
  const slug = c.req.param('slug');
  const docs = await db.where(def.key, 'slug', slug, 5);
  const doc = docs.find((d) => isLive(def.key, d, Date.now())) || (await db.get(def.key, slug));
  if (!doc || !isLive(def.key, doc, Date.now())) return err(c, 'Not found.', 404);
  c.header('Cache-Control', 'public, max-age=30, s-maxage=60');
  return c.json(publicView(doc));
});

/** Shared guard for public form submissions. */
async function publicForm(c: C | Context<{ Bindings: Env }>) {
  const env = c.env as Env;
  if (!allowedOrigin(c.req.header('origin'), env)) return err(c, 'Request origin was not accepted.', 403);
  const db = getDb(env);
  if (!db) return err(c, 'This service is not configured yet. Please use the school’s phone or email.', 503);
  const body = await readJson(c, 12_000);
  if (body instanceof Response) return body;
  if (typeof body.website === 'string' && body.website.trim()) return c.json({ success: true }); // honeypot
  if (!(await verifyTurnstile(env, body.turnstileToken, c.req.header('cf-connecting-ip')))) return err(c, 'Verification failed. Please try again.', 400);
  return { db, body };
}

app.post('/v1/public/contact', async (c) => {
  const r = await publicForm(c);
  if (r instanceof Response) return r;
  const name = String(r.body.name || '').trim().slice(0, 100);
  const email = String(r.body.email || '').trim().toLowerCase().slice(0, 254);
  const subject = String(r.body.subject || '').trim().slice(0, 160);
  const message = String(r.body.message || '').trim().slice(0, 4000);
  if (name.length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || subject.length < 3 || message.length < 10) {
    return err(c, 'Please complete your name, a valid email, a subject and a message of at least 10 characters.', 400);
  }
  await r.db.set('messages', crypto.randomUUID(), {
    name, email, subject, message,
    phone: String(r.body.phone || '').trim().slice(0, 40),
    audience: String(r.body.audience || '').trim().slice(0, 40),
    status: 'new', createdAt: new Date().toISOString(),
  });
  return c.json({ success: true });
});

app.post('/v1/public/alumni', async (c) => {
  const r = await publicForm(c);
  if (r instanceof Response) return r;
  const s = (k: string, max = 120) => String(r.body[k] || '').trim().slice(0, max);
  const fullName = s('fullName');
  const email = s('email', 254).toLowerCase();
  const year = Number(r.body.yearCompleted);
  if (fullName.length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !(year >= 1976 && year <= new Date().getFullYear() + 1)) {
    return err(c, 'Please give your name, a valid email and your year group.', 400);
  }
  if (r.body.consent !== true) return err(c, 'Please agree to the school storing your details.', 400);
  await r.db.set('alumni', crypto.randomUUID(), {
    fullName, email, yearCompleted: year,
    phone: s('phone', 40), programme: s('programme'), house: s('house'), occupation: s('occupation'), location: s('location'),
    status: 'new', createdAt: new Date().toISOString(),
  });
  return c.json({ success: true });
});

app.post('/v1/public/subscribe', async (c) => {
  const r = await publicForm(c);
  if (r instanceof Response) return r;
  const email = String(r.body.email || '').trim().toLowerCase().slice(0, 254);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return err(c, 'Please enter a valid email address.', 400);
  const id = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(email)).then((b) => [...new Uint8Array(b)].slice(0, 16).map((x) => x.toString(16).padStart(2, '0')).join(''));
  await r.db.set('subscribers', id, { email, createdAt: new Date().toISOString() });
  return c.json({ success: true });
});

// ---------- admin ----------

const admin = new Hono<{ Bindings: Env; Variables: Vars }>();

admin.use('*', async (c, next) => {
  const db = getDb(c.env);
  if (!db) return err(c, 'Firestore is not configured on the API. Set FIREBASE_SERVICE_ACCOUNT.', 503);
  const token = c.req.header('authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return err(c, 'Sign in required.', 401);
  const user = await verifyFirebaseToken(token, projectId(c.env));
  if (!user) return err(c, 'Your session has expired. Please sign in again.', 401);
  if (!user.emailVerified) return err(c, 'Please verify your email address before using the staff portal.', 403);
  const supers = c.env.SUPER_ADMIN_EMAILS.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
  let role: Role | null = supers.includes(user.email) ? 'super_admin' : null;
  if (!role) {
    const staff = await db.get('staff', user.email);
    if (staff && ROLES.includes(staff.role as Role) && staff.active !== false) role = staff.role as Role;
  }
  if (!role) return err(c, 'Your account has not been given access to the staff portal yet. Ask a school administrator to add you.', 403);
  c.set('user', user);
  c.set('role', role);
  c.set('db', db);
  await next();
  c.header('Cache-Control', 'private, no-store');
});

async function audit(c: C, action: string, collection: string, id: string) {
  c.executionCtx.waitUntil(
    c.var.db.set('audit', crypto.randomUUID(), { action, collection, docId: id, by: c.var.user.email, at: new Date().toISOString() }).catch(() => undefined),
  );
}

function afterPublicChange(c: C) {
  c.executionCtx.waitUntil(Promise.all([invalidatePublicCache(), requestRebuild(c.env).catch(() => false)]));
}

admin.get('/me', async (c) => {
  const counts: Record<string, number> = {};
  if (c.req.query('stats') === '1') {
    const keys = [...COLLECTIONS.map((d) => d.key), ...(can(c.var.role, 'inbox') ? INBOXES.map((d) => d.key) : [])];
    const lists = await Promise.all(keys.map((k) => c.var.db.list(k).catch(() => [])));
    keys.forEach((k, i) => (counts[k] = lists[i]!.length));
    if (can(c.var.role, 'inbox')) counts.newMessages = lists[keys.indexOf('messages')]?.filter((m) => m.status === 'new').length || 0;
  }
  return c.json({
    user: c.var.user,
    role: c.var.role,
    counts,
    services: { cloudinary: Boolean(c.env.CLOUDINARY_API_SECRET && c.env.CLOUDINARY_CLOUD_NAME), rebuildHook: Boolean(c.env.REBUILD_HOOK_URL) },
  });
});

admin.get('/c/:col', async (c) => {
  const def = findCollection(c.req.param('col'));
  if (!def) return err(c, 'Unknown collection.', 404);
  if (!def.publishable && !can(c.var.role, 'inbox')) return err(c, 'You do not have access to this inbox.', 403);
  return c.json({ items: sortDocs(def.key, await c.var.db.list(def.key)) });
});

admin.get('/c/:col/:id', async (c) => {
  const def = findCollection(c.req.param('col'));
  if (!def) return err(c, 'Unknown collection.', 404);
  if (!def.publishable && !can(c.var.role, 'inbox')) return err(c, 'You do not have access to this inbox.', 403);
  const doc = await c.var.db.get(def.key, c.req.param('id'));
  return doc ? c.json(doc) : err(c, 'Not found.', 404);
});

async function uniqueSlug(db: Firestore, col: string, base: string, selfId?: string): Promise<string> {
  let slug = base || crypto.randomUUID().slice(0, 8);
  for (let i = 2; i < 50; i++) {
    const clash = (await db.where(col, 'slug', slug, 2)).some((d) => d.id !== selfId);
    if (!clash) return slug;
    slug = `${base}-${i}`;
  }
  return `${base}-${crypto.randomUUID().slice(0, 6)}`;
}

async function saveContent(c: C, id: string | null) {
  const def = COLLECTIONS.find((d) => d.key === c.req.param('col'));
  if (!def) return err(c, 'Unknown or read-only collection.', 404);
  const body = await readJson(c);
  if (body instanceof Response) return body;
  const data = sanitize(def.fields, body);

  const existing = id ? await c.var.db.get(def.key, id) : null;
  if (id && !existing) return err(c, 'Not found.', 404);
  if (!can(c.var.role, 'publish')) {
    if (existing?.status === 'published') return err(c, 'Published items can only be changed by an editor.', 403);
    if (data.status === 'published') data.status = 'review';
  }

  if (def.fields.some((f) => f.type === 'slug')) {
    const title = String(data[def.titleField] || '');
    data.slug = await uniqueSlug(c.var.db, def.key, slugify(String(data.slug || '')) || slugify(title), id || undefined);
  }
  if (data.status === 'published' && def.fields.some((f) => f.name === 'publishedAt') && !data.publishedAt) {
    data.publishedAt = (existing?.publishedAt as string) || new Date().toISOString();
  }
  const now = new Date().toISOString();
  const docId = id || crypto.randomUUID().replace(/-/g, '').slice(0, 20);
  const saved = await c.var.db.set(def.key, docId, {
    ...data,
    createdAt: (existing?.createdAt as string) || now,
    createdBy: (existing?.createdBy as string) || c.var.user.email,
    updatedAt: now,
    updatedBy: c.var.user.email,
  });
  await audit(c, id ? 'update' : 'create', def.key, docId);
  if (data.status === 'published' || existing?.status === 'published') afterPublicChange(c);
  return c.json(saved, id ? 200 : 201);
}

admin.post('/c/:col', (c) => saveContent(c, null));
admin.put('/c/:col/:id', (c) => saveContent(c, c.req.param('id')));

admin.patch('/c/:col/:id', async (c) => {
  // Inbox status updates only.
  const def = INBOXES.find((d) => d.key === c.req.param('col'));
  if (!def) return err(c, 'Use PUT for content collections.', 400);
  if (!can(c.var.role, 'inbox')) return err(c, 'You do not have access to this inbox.', 403);
  const body = await readJson(c);
  if (body instanceof Response) return body;
  const statusField = def.fields.find((f) => f.name === 'status');
  if (!statusField || !statusField.options?.includes(String(body.status))) return err(c, 'Invalid status.', 400);
  const doc = await c.var.db.update(def.key, c.req.param('id'), { status: String(body.status), updatedAt: new Date().toISOString() });
  return c.json(doc);
});

admin.delete('/c/:col/:id', async (c) => {
  const def = findCollection(c.req.param('col'));
  if (!def) return err(c, 'Unknown collection.', 404);
  if (def.publishable ? !can(c.var.role, 'delete') : !can(c.var.role, 'inbox')) return err(c, 'You cannot delete this item.', 403);
  const existing = await c.var.db.get(def.key, c.req.param('id'));
  await c.var.db.delete(def.key, c.req.param('id'));
  await audit(c, 'delete', def.key, c.req.param('id'));
  if (existing?.status === 'published') afterPublicChange(c);
  return c.json({ success: true });
});

admin.get('/settings', async (c) => c.json((await c.var.db.get('site', 'settings')) || {}));

admin.put('/settings', async (c) => {
  if (!can(c.var.role, 'settings')) return err(c, 'Only administrators can change site settings.', 403);
  const body = await readJson(c);
  if (body instanceof Response) return body;
  const data = sanitize(SETTINGS_FIELDS, body);
  const saved = await c.var.db.set('site', 'settings', { ...data, updatedAt: new Date().toISOString(), updatedBy: c.var.user.email });
  await audit(c, 'update', 'settings', 'settings');
  afterPublicChange(c);
  return c.json(saved);
});

admin.get('/staff', async (c) => {
  if (!can(c.var.role, 'staff')) return err(c, 'Only super admins can manage staff.', 403);
  return c.json({ items: await c.var.db.list('staff') });
});

admin.put('/staff/:email', async (c) => {
  if (!can(c.var.role, 'staff')) return err(c, 'Only super admins can manage staff.', 403);
  const email = decodeURIComponent(c.req.param('email')).trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return err(c, 'Invalid email.', 400);
  const body = await readJson(c);
  if (body instanceof Response) return body;
  if (!ROLES.includes(body.role as Role)) return err(c, 'Invalid role.', 400);
  const existing = await c.var.db.get('staff', email);
  const saved = await c.var.db.set('staff', email, {
    email, role: String(body.role), name: String(body.name || '').slice(0, 120), active: body.active !== false,
    createdAt: (existing?.createdAt as string) || new Date().toISOString(), updatedBy: c.var.user.email,
  });
  await audit(c, 'staff', 'staff', email);
  return c.json(saved);
});

admin.delete('/staff/:email', async (c) => {
  if (!can(c.var.role, 'staff')) return err(c, 'Only super admins can manage staff.', 403);
  const email = decodeURIComponent(c.req.param('email')).toLowerCase();
  if (email === c.var.user.email) return err(c, 'You cannot remove your own access.', 400);
  await c.var.db.delete('staff', email);
  await audit(c, 'staff-remove', 'staff', email);
  return c.json({ success: true });
});

admin.get('/audit', async (c) => {
  if (!can(c.var.role, 'settings')) return err(c, 'Only administrators can view activity.', 403);
  const items = (await c.var.db.list('audit', 600)).sort((a, b) => time(b.at) - time(a.at)).slice(0, 100);
  return c.json({ items });
});

admin.post('/media/sign', async (c) => {
  const { CLOUDINARY_CLOUD_NAME: cloudName, CLOUDINARY_API_KEY: apiKey, CLOUDINARY_API_SECRET: secret, CLOUDINARY_FOLDER } = c.env;
  if (!cloudName || !apiKey || !secret) return err(c, 'Cloudinary is not configured on the API.', 503);
  const body = await readJson(c, 2000);
  if (body instanceof Response) return body;
  const sub = slugify(String(body.folder || 'general')) || 'general';
  const params = { folder: `${CLOUDINARY_FOLDER || 'upshs'}/${sub}`, timestamp: Math.floor(Date.now() / 1000) };
  const signature = await cloudinarySignature(params, secret);
  return c.json({ cloudName, apiKey, signature, ...params });
});

admin.post('/rebuild', async (c) => {
  if (!can(c.var.role, 'publish')) return err(c, 'Only editors can republish the site.', 403);
  if (!c.env.REBUILD_HOOK_URL) return err(c, 'No rebuild hook is configured. Set REBUILD_HOOK_URL on the API.', 503);
  await invalidatePublicCache();
  const ok = await requestRebuild(c.env, true);
  return ok ? c.json({ success: true }) : err(c, 'Cloudflare Pages did not accept the rebuild request.', 502);
});

app.route('/v1/admin', admin);
app.notFound((c) => c.json({ error: 'Not found.' }, 404));

export default app;
