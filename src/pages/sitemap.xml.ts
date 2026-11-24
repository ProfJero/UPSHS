import type { APIRoute } from 'astro';
import { getContent, cld, SITE_URL } from '../lib/content';

const STATIC: [string, string, number][] = [
  ['/', 'daily', 1.0], ['/about/', 'monthly', 0.9], ['/academics/', 'monthly', 0.9], ['/student-life/', 'monthly', 0.8],
  ['/news/', 'daily', 0.9], ['/events/', 'daily', 0.8], ['/announcements/', 'daily', 0.8], ['/gallery/', 'weekly', 0.7],
  ['/downloads/', 'weekly', 0.7], ['/alumni/', 'monthly', 0.7], ['/faq/', 'monthly', 0.7], ['/contact/', 'yearly', 0.8],
  ['/about/leadership/', 'monthly', 0.7], ['/about/achievements/', 'monthly', 0.6], ['/privacy/', 'yearly', 0.3],
];
const x = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export const GET: APIRoute = async () => {
  const c = await getContent();
  const today = new Date().toISOString();
  const urls: string[] = STATIC.map(([p, f, pr]) => `<url><loc>${SITE_URL}${p}</loc><lastmod>${today}</lastmod><changefreq>${f}</changefreq><priority>${pr.toFixed(1)}</priority></url>`);
  for (const n of c.news) {
    const img = n.coverImage?.url ? `<image:image><image:loc>${x(cld(n.coverImage.url, { w: 1600 }))}</image:loc></image:image>` : '';
    urls.push(`<url><loc>${SITE_URL}/news/${n.slug}/</loc><lastmod>${n.updatedAt || n.publishedAt || today}</lastmod><changefreq>monthly</changefreq><priority>0.7</priority>${img}</url>`);
  }
  for (const e of c.events) urls.push(`<url><loc>${SITE_URL}/events/${e.slug}/</loc><lastmod>${e.updatedAt || today}</lastmod><changefreq>weekly</changefreq><priority>0.6</priority></url>`);
  for (const a of c.albums) {
    const imgs = (a.images || []).slice(0, 50).map((i) => `<image:image><image:loc>${x(cld(i.url, { w: 1600 }))}</image:loc></image:image>`).join('');
    urls.push(`<url><loc>${SITE_URL}/gallery/${a.slug}/</loc><lastmod>${a.updatedAt || today}</lastmod><changefreq>monthly</changefreq><priority>0.5</priority>${imgs}</url>`);
  }
  const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n${urls.join('\n')}\n</urlset>`;
  return new Response(body, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
};
