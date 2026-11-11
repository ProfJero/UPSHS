import type { APIRoute } from 'astro';
import { getRuntimeConfig, getServerSupabase } from '../lib/server';

export const GET: APIRoute = async (context) => {
  const origin = getRuntimeConfig().siteUrl || context.url.origin;
  const staticPaths = ['/', '/about/', '/academics/', '/admissions/', '/news/', '/announcements/', '/events/', '/gallery/', '/alumni/', '/contact/', '/privacy/'];
  const supabase = getServerSupabase();
  let dynamicPaths: string[] = [];
  if (supabase) {
    const [news, pages, events, albums] = await Promise.all([
      supabase.from('news_posts').select('slug,published_at').eq('status','published'),
      supabase.from('pages').select('slug,updated_at').eq('status','published'),
      supabase.from('events').select('slug').eq('status','published'),
      supabase.from('gallery_albums').select('slug').eq('status','published'),
    ]);
    dynamicPaths = [
      ...(news.data || []).map((row) => `/news/${row.slug}/`),
      ...(pages.data || []).map((row) => `/pages/${row.slug}/`),
      ...(events.data || []).map((row) => `/events/${row.slug}/`),
      ...(albums.data || []).map((row) => `/gallery/${row.slug}/`),
    ];
  }
  const urls = [...staticPaths,...dynamicPaths].map((path) => `<url><loc>${new URL(path,origin).toString()}</loc></url>`).join('');
  return new Response(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`, { headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=300' } });
};
