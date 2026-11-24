import type { APIRoute } from 'astro';

export const GET: APIRoute = () =>
  new Response(JSON.stringify({
    name: 'University Practice Senior High School',
    short_name: 'UPSHS',
    description: 'Official website of University Practice Senior High School, Cape Coast.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#0b1240',
    theme_color: '#16226b',
    lang: 'en-GH',
    categories: ['education'],
    icons: [
      { src: '/images/brand/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/images/brand/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/images/brand/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    shortcuts: [
      { name: 'Events calendar', url: '/events/' },
      { name: 'Notice board', url: '/announcements/' },
      { name: 'News', url: '/news/' },
    ],
  }), { headers: { 'Content-Type': 'application/manifest+json' } });
