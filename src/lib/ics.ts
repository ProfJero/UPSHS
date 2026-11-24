import type { SchoolEvent } from './content';
import { SITE_URL, plain } from './content';

const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
const stamp = (d: string | Date) => new Date(d).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
const day = (d: string | Date) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Accra' }).format(new Date(d)).replace(/-/g, '');
const fold = (line: string) => line.match(/.{1,73}/g)!.join('\r\n ');

export function vevent(e: SchoolEvent): string[] {
  const lines = ['BEGIN:VEVENT', `UID:${e.id}@upshs.pages.dev`, `DTSTAMP:${stamp(e.updatedAt || e.createdAt || new Date())}`];
  if (e.allDay) {
    const end = new Date(e.endsAt || e.startsAt);
    end.setUTCDate(end.getUTCDate() + 1);
    lines.push(`DTSTART;VALUE=DATE:${day(e.startsAt)}`, `DTEND;VALUE=DATE:${day(end)}`);
  } else {
    lines.push(`DTSTART:${stamp(e.startsAt)}`, `DTEND:${stamp(e.endsAt || new Date(new Date(e.startsAt).getTime() + 2 * 3600_000))}`);
  }
  lines.push(`SUMMARY:${esc(e.title)}`, `URL:${SITE_URL}/events/${e.slug}/`);
  if (e.location) lines.push(`LOCATION:${esc(e.location)}`);
  const desc = e.summary || plain(e.body, 600);
  if (desc) lines.push(`DESCRIPTION:${esc(desc)}`);
  lines.push('END:VEVENT');
  return lines;
}

export function calendar(events: SchoolEvent[], name = 'University Practice SHS'): string {
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//UPSHS//School Calendar//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', `X-WR-CALNAME:${esc(name)}`, 'X-WR-TIMEZONE:Africa/Accra', ...events.flatMap(vevent), 'END:VCALENDAR']
    .map(fold).join('\r\n');
}

export function googleCalendarUrl(e: SchoolEvent): string {
  const dates = e.allDay
    ? `${day(e.startsAt)}/${day(new Date(new Date(e.endsAt || e.startsAt).getTime() + 86400_000))}`
    : `${stamp(e.startsAt)}/${stamp(e.endsAt || new Date(new Date(e.startsAt).getTime() + 2 * 3600_000))}`;
  const q = new URLSearchParams({ action: 'TEMPLATE', text: e.title, dates, details: `${e.summary || ''}\n${SITE_URL}/events/${e.slug}/`.trim(), location: e.location || 'University Practice SHS, Cape Coast' });
  return `https://calendar.google.com/calendar/render?${q}`;
}
