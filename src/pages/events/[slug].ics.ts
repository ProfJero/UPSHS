import type { APIRoute } from 'astro';
import { getContent, type SchoolEvent } from '../../lib/content';
import { calendar } from '../../lib/ics';

export async function getStaticPaths() {
  const { events } = await getContent();
  return events.map((event) => ({ params: { slug: event.slug }, props: { event } }));
}
export const GET: APIRoute = ({ props }) =>
  new Response(calendar([(props as { event: SchoolEvent }).event]), { headers: { 'Content-Type': 'text/calendar; charset=utf-8' } });
