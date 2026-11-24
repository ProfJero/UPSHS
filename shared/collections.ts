// Single source of truth for content collections.
// Used by the API Worker (validation) and the admin CMS (form generation).

export type FieldType =
  | 'text' | 'textarea' | 'markdown' | 'slug' | 'email' | 'url'
  | 'datetime' | 'date' | 'select' | 'boolean' | 'number' | 'tags'
  | 'image' | 'gallery' | 'file';

export interface Field {
  name: string;
  label: string;
  type: FieldType;
  required?: boolean;
  options?: string[];
  help?: string;
  max?: number;
  /** Show this field in the CMS list table. */
  list?: boolean;
  /** Half-width in the CMS form grid. */
  half?: boolean;
}

export type Role = 'super_admin' | 'admin' | 'editor' | 'media';
export const ROLES: Role[] = ['super_admin', 'admin', 'editor', 'media'];
export const ROLE_LABELS: Record<Role, string> = {
  super_admin: 'Super admin',
  admin: 'Administrator',
  editor: 'Editor',
  media: 'Media team',
};

export const STATUS = ['draft', 'review', 'published', 'archived'] as const;
export type Status = (typeof STATUS)[number];

export interface CollectionDef {
  key: string;
  label: string;
  singular: string;
  icon: string;
  description: string;
  /** Has draft/review/published workflow and appears on the public site. */
  publishable: boolean;
  titleField: string;
  sortField: string;
  fields: Field[];
}

const statusField: Field = { name: 'status', label: 'Status', type: 'select', options: [...STATUS], required: true, list: true, half: true };
const publishedAt: Field = { name: 'publishedAt', label: 'Publish date', type: 'datetime', half: true, list: true, help: 'Leave empty to use the time you publish.' };

export const COLLECTIONS: CollectionDef[] = [
  {
    key: 'news', label: 'News & stories', singular: 'Story', icon: 'newspaper', publishable: true, titleField: 'title', sortField: 'publishedAt',
    description: 'Articles about school life, achievements and the community.',
    fields: [
      { name: 'title', label: 'Headline', type: 'text', required: true, max: 160, list: true },
      { name: 'slug', label: 'URL slug', type: 'slug', half: true, help: 'Generated from the headline if left blank.' },
      { name: 'category', label: 'Category', type: 'select', half: true, list: true, options: ['General', 'Academics', 'Sports', 'Arts & Culture', 'Achievements', 'Community', 'Alumni', 'Clubs & Societies'] },
      { name: 'excerpt', label: 'Summary', type: 'textarea', max: 320, help: 'One or two sentences shown on cards and in Google results.' },
      { name: 'body', label: 'Story', type: 'markdown', required: true, max: 60000 },
      { name: 'coverImage', label: 'Cover image', type: 'image' },
      { name: 'author', label: 'Author / byline', type: 'text', half: true, max: 100 },
      { name: 'tags', label: 'Tags', type: 'tags', half: true },
      { name: 'featured', label: 'Feature on homepage', type: 'boolean', half: true },
      statusField, publishedAt,
    ],
  },
  {
    key: 'announcements', label: 'Announcements', singular: 'Announcement', icon: 'megaphone', publishable: true, titleField: 'title', sortField: 'publishedAt',
    description: 'Short, time-sensitive notices shown in the site banner and notice board.',
    fields: [
      { name: 'title', label: 'Title', type: 'text', required: true, max: 140, list: true },
      { name: 'body', label: 'Notice', type: 'textarea', required: true, max: 1200 },
      { name: 'priority', label: 'Priority', type: 'select', options: ['normal', 'important', 'urgent'], half: true, list: true },
      { name: 'pinned', label: 'Show in top banner', type: 'boolean', half: true },
      { name: 'linkUrl', label: 'Link URL', type: 'url', half: true },
      { name: 'linkLabel', label: 'Link label', type: 'text', half: true, max: 40 },
      { name: 'expiresAt', label: 'Expires', type: 'datetime', half: true, help: 'Hidden automatically after this time.' },
      statusField, publishedAt,
    ],
  },
  {
    key: 'events', label: 'Events & calendar', singular: 'Event', icon: 'calendar', publishable: true, titleField: 'title', sortField: 'startsAt',
    description: 'School calendar: terms, PTA meetings, sports, speech day, reunions.',
    fields: [
      { name: 'title', label: 'Event name', type: 'text', required: true, max: 160, list: true },
      { name: 'slug', label: 'URL slug', type: 'slug', half: true },
      { name: 'category', label: 'Category', type: 'select', half: true, list: true, options: ['Academic', 'Sports', 'Cultural', 'PTA', 'Alumni', 'Religious', 'Holiday', 'Other'] },
      { name: 'startsAt', label: 'Starts', type: 'datetime', required: true, half: true, list: true },
      { name: 'endsAt', label: 'Ends', type: 'datetime', half: true },
      { name: 'allDay', label: 'All-day event', type: 'boolean', half: true },
      { name: 'location', label: 'Venue', type: 'text', half: true, max: 160 },
      { name: 'summary', label: 'Summary', type: 'textarea', max: 320 },
      { name: 'body', label: 'Details', type: 'markdown', max: 20000 },
      { name: 'coverImage', label: 'Cover image', type: 'image' },
      statusField,
    ],
  },
  {
    key: 'albums', label: 'Gallery albums', singular: 'Album', icon: 'images', publishable: true, titleField: 'title', sortField: 'date',
    description: 'Photo albums of school life. Only upload images approved for public display.',
    fields: [
      { name: 'title', label: 'Album title', type: 'text', required: true, max: 140, list: true },
      { name: 'slug', label: 'URL slug', type: 'slug', half: true },
      { name: 'date', label: 'Date', type: 'date', half: true, list: true },
      { name: 'description', label: 'Description', type: 'textarea', max: 600 },
      { name: 'coverImage', label: 'Cover image', type: 'image', help: 'Defaults to the first photo.' },
      { name: 'images', label: 'Photos', type: 'gallery' },
      statusField,
    ],
  },
  {
    key: 'downloads', label: 'Downloads', singular: 'Document', icon: 'download', publishable: true, titleField: 'title', sortField: 'publishedAt',
    description: 'Forms, prospectus, academic calendar, timetables, newsletters and policies.',
    fields: [
      { name: 'title', label: 'Title', type: 'text', required: true, max: 160, list: true },
      { name: 'category', label: 'Category', type: 'select', half: true, list: true, options: ['Academic calendar', 'Forms', 'Prospectus & handbooks', 'Timetables', 'Newsletters', 'Policies', 'Other'] },
      { name: 'file', label: 'File', type: 'file', required: true },
      { name: 'description', label: 'Description', type: 'textarea', max: 400 },
      statusField, publishedAt,
    ],
  },
  {
    key: 'leadership', label: 'Leadership & staff', singular: 'Profile', icon: 'users', publishable: true, titleField: 'name', sortField: 'order',
    description: 'Headteacher, assistant heads, heads of department, board and PTA executives.',
    fields: [
      { name: 'name', label: 'Full name', type: 'text', required: true, max: 120, list: true },
      { name: 'role', label: 'Position', type: 'text', required: true, max: 120, list: true, half: true },
      { name: 'group', label: 'Group', type: 'select', half: true, list: true, options: ['Administration', 'Heads of Department', 'Board of Governors', 'PTA Executive', 'Student Leadership'] },
      { name: 'order', label: 'Display order', type: 'number', half: true, help: 'Lower numbers appear first.' },
      { name: 'photo', label: 'Photo', type: 'image' },
      { name: 'bio', label: 'Short bio', type: 'textarea', max: 800 },
      statusField,
    ],
  },
  {
    key: 'achievements', label: 'Achievements', singular: 'Achievement', icon: 'trophy', publishable: true, titleField: 'title', sortField: 'year',
    description: 'Awards, competition results and honours.',
    fields: [
      { name: 'title', label: 'Achievement', type: 'text', required: true, max: 160, list: true },
      { name: 'year', label: 'Year', type: 'number', half: true, list: true },
      { name: 'category', label: 'Category', type: 'select', half: true, list: true, options: ['Academic', 'Sports', 'Arts & Culture', 'Quiz & Debate', 'Science & Technology', 'Leadership', 'Other'] },
      { name: 'description', label: 'Description', type: 'textarea', max: 600 },
      { name: 'image', label: 'Image', type: 'image' },
      statusField,
    ],
  },
];

/** Inbox collections are written by the public site and read only by staff. */
export const INBOXES: CollectionDef[] = [
  {
    key: 'messages', label: 'Enquiries', singular: 'Enquiry', icon: 'inbox', publishable: false, titleField: 'subject', sortField: 'createdAt',
    description: 'Messages sent through the contact form.',
    fields: [
      { name: 'subject', label: 'Subject', type: 'text', list: true },
      { name: 'name', label: 'Name', type: 'text', list: true, half: true },
      { name: 'email', label: 'Email', type: 'email', half: true },
      { name: 'phone', label: 'Phone', type: 'text', half: true },
      { name: 'audience', label: 'I am a', type: 'text', half: true },
      { name: 'message', label: 'Message', type: 'textarea' },
      { name: 'status', label: 'Status', type: 'select', options: ['new', 'in_progress', 'resolved'], list: true, half: true },
      { name: 'createdAt', label: 'Received', type: 'datetime', list: true, half: true },
    ],
  },
  {
    key: 'alumni', label: 'Alumni register', singular: 'Alumnus', icon: 'graduation', publishable: false, titleField: 'fullName', sortField: 'createdAt',
    description: 'Old students who joined the alumni network through the website.',
    fields: [
      { name: 'fullName', label: 'Name', type: 'text', list: true },
      { name: 'yearCompleted', label: 'Year group', type: 'number', list: true, half: true },
      { name: 'email', label: 'Email', type: 'email', half: true },
      { name: 'phone', label: 'Phone', type: 'text', half: true },
      { name: 'programme', label: 'Programme', type: 'text', half: true },
      { name: 'house', label: 'House', type: 'text', half: true },
      { name: 'occupation', label: 'Occupation', type: 'text', half: true },
      { name: 'location', label: 'Location', type: 'text', half: true },
      { name: 'status', label: 'Status', type: 'select', options: ['new', 'verified', 'archived'], list: true, half: true },
      { name: 'createdAt', label: 'Joined', type: 'datetime', list: true, half: true },
    ],
  },
  {
    key: 'subscribers', label: 'Newsletter', singular: 'Subscriber', icon: 'mail', publishable: false, titleField: 'email', sortField: 'createdAt',
    description: 'People subscribed to school updates.',
    fields: [
      { name: 'email', label: 'Email', type: 'email', list: true },
      { name: 'createdAt', label: 'Subscribed', type: 'datetime', list: true },
    ],
  },
];

export const SETTINGS_FIELDS: Field[] = [
  { name: 'schoolName', label: 'School name', type: 'text', max: 120 },
  { name: 'shortName', label: 'Short name', type: 'text', max: 20, half: true },
  { name: 'motto', label: 'Motto', type: 'text', max: 80, half: true },
  { name: 'heroTitle', label: 'Homepage headline', type: 'text', max: 120 },
  { name: 'heroSubtitle', label: 'Homepage introduction', type: 'textarea', max: 400 },
  { name: 'heroImage', label: 'Homepage hero photo', type: 'image', help: 'A wide, high-quality campus photograph.' },
  { name: 'headName', label: "Headteacher's name", type: 'text', max: 120, half: true },
  { name: 'headTitle', label: "Headteacher's title", type: 'text', max: 120, half: true },
  { name: 'headPhoto', label: "Headteacher's photo", type: 'image' },
  { name: 'headMessage', label: "Headteacher's welcome message", type: 'markdown', max: 6000 },
  { name: 'studentCount', label: 'Number of students', type: 'number', half: true },
  { name: 'staffCount', label: 'Number of teaching staff', type: 'number', half: true },
  { name: 'alumniCount', label: 'Alumni (approx.)', type: 'number', half: true },
  { name: 'clubCount', label: 'Clubs & societies', type: 'number', half: true },
  { name: 'address', label: 'Postal address', type: 'textarea', max: 300 },
  { name: 'phone', label: 'Telephone', type: 'text', max: 40, half: true },
  { name: 'email', label: 'Public email', type: 'email', half: true },
  { name: 'whatsapp', label: 'WhatsApp number', type: 'text', max: 40, half: true },
  { name: 'officeHours', label: 'Office hours', type: 'text', max: 120, half: true },
  { name: 'facebook', label: 'Facebook URL', type: 'url', half: true },
  { name: 'instagram', label: 'Instagram URL', type: 'url', half: true },
  { name: 'x', label: 'X (Twitter) URL', type: 'url', half: true },
  { name: 'youtube', label: 'YouTube URL', type: 'url', half: true },
  { name: 'tiktok', label: 'TikTok URL', type: 'url', half: true },
  { name: 'linkedin', label: 'LinkedIn URL', type: 'url', half: true },
];

export const PUBLIC_COLLECTIONS = COLLECTIONS.map((c) => c.key);
export const findCollection = (key: string) => COLLECTIONS.find((c) => c.key === key) || INBOXES.find((c) => c.key === key);

export function can(role: Role | null | undefined, action: 'edit' | 'publish' | 'delete' | 'inbox' | 'settings' | 'staff'): boolean {
  if (!role) return false;
  switch (action) {
    case 'edit': return true;
    case 'publish':
    case 'delete': return role !== 'media';
    case 'inbox':
    case 'settings': return role === 'admin' || role === 'super_admin';
    case 'staff': return role === 'super_admin';
  }
}

export function slugify(value: string): string {
  return value.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80);
}
