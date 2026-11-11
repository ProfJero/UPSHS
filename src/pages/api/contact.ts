import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';
import { getServerSecrets } from '../../lib/server';

export const POST: APIRoute = async ({ request, url }) => {
  const secrets = getServerSecrets();
  const siteUrl = secrets.siteUrl || url.origin;
  const origin = request.headers.get('origin');
  const acceptedOrigins = new Set([url.origin, new URL(siteUrl).origin]);
  if (!origin || !acceptedOrigins.has(origin)) return Response.json({ error: 'Request origin was not accepted.' }, { status: 403 });

  const supabaseUrl = secrets.supabaseUrl;
  const serviceKey = secrets.serviceRoleKey;
  const turnstileSecret = secrets.turnstileSecret;
  if (!supabaseUrl || !serviceKey || !turnstileSecret) {
    return Response.json({ error: 'The enquiry service has not been configured. Please use the school’s verified contact channels.' }, { status: 503 });
  }

  if (!request.headers.get('content-type')?.toLowerCase().includes('application/json')) {
    return Response.json({ error: 'JSON is required.' }, { status: 415 });
  }
  const contentLength = Number(request.headers.get('content-length') || 0);
  if (contentLength > 12_000) return Response.json({ error: 'Request is too large.' }, { status: 413 });
  let body: Record<string, unknown>;
  try {
    const rawBody = await request.text();
    if (rawBody.length > 12_000) return Response.json({ error: 'Request is too large.' }, { status: 413 });
    const parsed: unknown = JSON.parse(rawBody);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return Response.json({ error: 'Invalid request.' }, { status: 400 });
    body = parsed as Record<string, unknown>;
  } catch { return Response.json({ error: 'Invalid request.' }, { status: 400 }); }
  if (typeof body.website === 'string' && body.website.trim()) return Response.json({ success: true });

  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const subject = typeof body.subject === 'string' ? body.subject.trim() : '';
  const message = typeof body.message === 'string' ? body.message.trim() : '';
  const token = typeof body.turnstileToken === 'string' ? body.turnstileToken : '';
  if (name.length < 2 || name.length > 100 || email.length < 5 || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || subject.length < 3 || subject.length > 160 || message.length < 10 || message.length > 4000) {
    return Response.json({ error: 'Please review the form fields and try again.' }, { status: 400 });
  }
  if (!token) return Response.json({ error: 'Please complete the verification check.' }, { status: 400 });

  let result: { success?: boolean; hostname?: string };
  try {
    const verification = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ secret: turnstileSecret, response: token, remoteip: request.headers.get('cf-connecting-ip') || '' }),
    });
    if (!verification.ok) return Response.json({ error: 'Verification could not be completed. Please try again.' }, { status: 502 });
    result = await verification.json() as { success?: boolean; hostname?: string };
  } catch {
    return Response.json({ error: 'Verification service is temporarily unavailable.' }, { status: 502 });
  }
  if (!result.success) return Response.json({ error: 'Verification failed. Please refresh the check and try again.' }, { status: 400 });

  const allowedHost = new URL(siteUrl).hostname;
  if (result.hostname !== allowedHost) {
    return Response.json({ error: 'Verification host did not match this website.' }, { status: 403 });
  }

  const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error } = await supabase.from('contact_messages').insert({ name, email, subject, message, status: 'new' });
  if (error) return Response.json({ error: 'Your message could not be saved. Please try again later.' }, { status: 500 });
  return Response.json({ success: true }, { status: 200, headers: { 'Cache-Control': 'no-store' } });
};
