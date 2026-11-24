import type { APIRoute } from 'astro';
import { getContent } from '../../lib/content';
import { calendar } from '../../lib/ics';

export const GET: APIRoute = async () => {
  const { events } = await getContent();
  return new Response(calendar(events, 'University Practice SHS — School Calendar'), { headers: { 'Content-Type': 'text/calendar; charset=utf-8' } });
};
