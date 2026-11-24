import type { APIRoute } from 'astro';
import { SITE_URL } from '../lib/content';

export const GET: APIRoute = () =>
  new Response(`User-agent: *\nAllow: /\nDisallow: /admin/\nDisallow: /search/\n\nSitemap: ${SITE_URL}/sitemap.xml\n`, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
