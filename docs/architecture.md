# Architecture and data model

## Request flow

```text
Visitor browser
   |
   v
Cloudflare Worker (Astro SSR)
   |-- Public page rendering
   |-- Public Supabase client using the publishable/anon key
   |-- /api/contact uses a server-only service-role client after Turnstile
   |
   +--> Supabase PostgreSQL (content + RLS)
   +--> Supabase Auth (staff sessions)
   +--> Supabase Storage (publicly approved media only)
```

The public application is rendered by Astro on the Cloudflare Worker. React is used for interactive components, especially the staff CMS. Public pages use a read-only Supabase client and rely on database RLS to restrict returned records to published content. The CMS uses the signed-in user's Supabase session and is authorised by table-level grants and RLS policies.

The contact form is deliberately not allowed to insert rows directly through the anonymous Supabase key. A Cloudflare rate-limiting rule should also be configured on `/api/contact` before production launch. It posts to the Worker endpoint, which validates the origin, validates the fields, verifies a Cloudflare Turnstile token against Siteverify, checks the hostname and inserts the enquiry using a server-only service-role key. The service-role key is never sent to the browser.

## Database tables

| Table | Purpose | Public access |
|---|---|---|
| `profiles` | Staff profile and CMS role linked to `auth.users` | Authenticated owner / editorial management only |
| `site_settings` | School name, motto, location, approved contact and social links | Read-only |
| `news_categories` | Categories for articles | Read-only |
| `news_posts` | Editorial stories and school news | Published rows only |
| `announcements` | Time-sensitive notices | Published, non-expired rows only |
| `events` | School calendar and event information | Published rows only |
| `pages` | Editable information pages | Published rows only |
| `gallery_albums` | Approved school photo albums | Published rows only |
| `gallery_items` | Photos within albums | Published items in published albums only |
| `contact_messages` | Public enquiries | No public read; submissions go through the Worker endpoint |
| `audit_logs` | Metadata about selected content changes | Senior administrators only |

## Publication permissions

- `media`: create and update draft/review news, events, albums and gallery images; cannot publish or delete these content rows.
- `editor`: manage and publish editorial content, pages, categories and enquiries.
- `admin`: operational content, site settings and enquiries.
- `super_admin`: all application permissions, including role management.
- `viewer`: dashboard overview only.

The browser dashboard adapts its visible controls, but the SQL RLS policies are the enforcement layer. Do not remove RLS or grant anonymous write permissions to simplify the interface.

## Data relationships

- A `news_posts.category_id` references `news_categories.id`.
- A `news_posts.author_id` references `profiles.id`.
- `announcements.created_by`, `events.created_by`, `pages.created_by` and `gallery_albums.created_by` reference `profiles.id`.
- A `gallery_items.album_id` references `gallery_albums.id` and cascades on album deletion.
- `profiles.id` references the matching Supabase Auth user.

## Runtime configuration

Cloudflare Worker bindings are read through `cloudflare:workers`. Keep local Worker values in `.dev.vars` and production values in Worker settings / secrets. Never commit real secrets.

## Known initial implementation decisions

- Supabase Storage bucket `upshs-media` is public so approved image URLs can be rendered directly. Treat an uploaded object URL as public and upload only approved content.
- Contact messages are inserted with service role only after Turnstile verification. Production should also configure Cloudflare rate limiting on `/api/contact`.
- The public site uses a CSS illustration and temporary monogram until the school supplies approved crest and photographs.
- The first iteration does not contain student information systems, admissions processing, payment processing or private student portals.
