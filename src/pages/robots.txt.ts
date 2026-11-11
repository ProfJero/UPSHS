import type { APIRoute } from 'astro';
import { getRuntimeConfig } from '../lib/server';

export const GET: APIRoute = ({ url }) => {
  const origin = getRuntimeConfig().siteUrl || url.origin;
  return new Response(`User-agent: *\nAllow: /\nDisallow: /admin/\nDisallow: /api/\nSitemap: ${new URL('/sitemap.xml', origin).toString()}\n`, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'public, max-age=3600' },
  });
};
