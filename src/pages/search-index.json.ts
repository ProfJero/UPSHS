import type { APIRoute } from 'astro';
import { getContent, plain, fmtDate } from '../lib/content';
import { FAQ, PROGRAMMES, CLUBS } from '../data/school';

// Compact client-side search index: t=title, u=url, d=description, k=keywords, g=group
export const GET: APIRoute = async () => {
  const c = await getContent();
  const items = [
    { t: 'Home', u: '/', d: 'University Practice Senior High School, Cape Coast', k: 'upshs unipra home', g: 'Pages' },
    { t: 'About UNIPRA — our story', u: '/about/', d: 'History since 1976, mission, vision, motto and crest', k: 'history crest motto floreat gye nyame mission vision values', g: 'Pages' },
    { t: 'Leadership & staff', u: '/about/leadership/', d: 'Headteacher, administration, heads of department, PTA', k: 'headmaster headmistress headteacher staff teachers board pta', g: 'Pages' },
    { t: 'Achievements', u: '/about/achievements/', d: 'Awards, results and honours', k: 'awards trophies results honours', g: 'Pages' },
    { t: 'Academics', u: '/academics/', d: 'Programmes, core subjects, facilities and learning support', k: `programmes subjects courses wassce ${PROGRAMMES.map((p) => p.title + ' ' + p.subjects.join(' ')).join(' ')}`, g: 'Pages' },
    { t: 'Student life', u: '/student-life/', d: 'Clubs, sports, culture and student leadership', k: `clubs societies sports src prefects ${CLUBS.map((x) => x.title).join(' ')}`, g: 'Pages' },
    { t: 'Events calendar', u: '/events/', d: 'Term dates, PTA meetings, sports and more', k: 'calendar term dates vacation reopening pta speech day', g: 'Pages' },
    { t: 'Notice board', u: '/announcements/', d: 'Official announcements', k: 'announcements notices news', g: 'Pages' },
    { t: 'Downloads', u: '/downloads/', d: 'Forms, prospectus, timetables, newsletters', k: 'prospectus forms documents pdf timetable', g: 'Pages' },
    { t: 'Gallery', u: '/gallery/', d: 'Photos of school life', k: 'photos pictures images', g: 'Pages' },
    { t: 'Alumni network', u: '/alumni/', d: 'Join the alumni register, reunions', k: 'old students alumni reunion register unipran', g: 'Pages' },
    { t: 'Contact & directions', u: '/contact/', d: 'Phone, email, office hours and map', k: 'phone email address location map directions', g: 'Pages' },
    { t: 'FAQs', u: '/faq/', d: 'Placement, reporting, fees, results', k: 'questions help admission placement cssps', g: 'Pages' },
    ...FAQ.map((f) => ({ t: f.q, u: `/faq/#${f.id}`, d: f.a.slice(0, 140), k: f.id === 'admissions' ? 'admission admissions apply enrol cssps placement bece form 1' : f.id, g: 'FAQ' })),
    ...c.news.map((n) => ({ t: n.title, u: `/news/${n.slug}/`, d: n.excerpt || plain(n.body, 140), k: [n.category, ...(n.tags || []), plain(n.body, 600)].join(' '), g: 'News' })),
    ...c.events.map((e) => ({ t: e.title, u: `/events/${e.slug}/`, d: `${fmtDate(e.startsAt)}${e.location ? ` · ${e.location}` : ''}`, k: [e.category, e.summary, e.location].join(' '), g: 'Events' })),
    ...c.announcements.map((a) => ({ t: a.title, u: `/announcements/#${a.id}`, d: plain(a.body, 140), k: a.body, g: 'Notices' })),
    ...c.downloads.map((d) => ({ t: d.title, u: d.file.url, d: d.description || d.category || 'Document', k: d.category || '', g: 'Downloads' })),
    ...c.albums.map((a) => ({ t: a.title, u: `/gallery/${a.slug}/`, d: a.description || `${a.images?.length || 0} photos`, k: '', g: 'Gallery' })),
    ...c.leadership.map((p) => ({ t: p.name, u: '/about/leadership/', d: p.role, k: p.group || '', g: 'People' })),
  ];
  return new Response(JSON.stringify(items), { headers: { 'Content-Type': 'application/json' } });
};
