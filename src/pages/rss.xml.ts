import type { APIRoute } from 'astro';
import { getContent, plain, SITE_URL, school } from '../lib/content';
const x = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export const GET: APIRoute = async () => {
  const { news } = await getContent();
  const s = await school();
  const items = news.slice(0, 40).map((n) => `<item><title>${x(n.title)}</title><link>${SITE_URL}/news/${n.slug}/</link><guid isPermaLink="true">${SITE_URL}/news/${n.slug}/</guid><pubDate>${new Date(n.publishedAt || n.createdAt || Date.now()).toUTCString()}</pubDate>${n.category ? `<category>${x(n.category)}</category>` : ''}<description>${x(n.excerpt || plain(n.body, 300))}</description></item>`).join('');
  const body = `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom"><channel><title>${x(s.name)} — News</title><link>${SITE_URL}/news/</link><atom:link href="${SITE_URL}/rss.xml" rel="self" type="application/rss+xml"/><description>News and stories from ${x(s.name)}, Cape Coast.</description><language>en-gh</language>${items}</channel></rss>`;
  return new Response(body, { headers: { 'Content-Type': 'application/rss+xml; charset=utf-8' } });
};
