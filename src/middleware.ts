import { defineMiddleware } from 'astro:middleware';

export const onRequest = defineMiddleware(async (context, next) => {
  const response = await next();
  const headers = new Headers(response.headers);
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  headers.set('X-Frame-Options', 'DENY');
  headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  if (context.url.protocol === 'https:') headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');

  if (context.url.pathname.startsWith('/admin/') || context.url.pathname.startsWith('/api/')) {
    headers.set('Cache-Control', 'private, no-store, max-age=0');
  } else if (response.status === 200 && context.request.method === 'GET') {
    headers.set('Cache-Control', 'public, max-age=0, s-maxage=60, stale-while-revalidate=300');
  }

  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
});
