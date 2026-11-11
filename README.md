# University Practice Senior High School (UPSHS) — Official Website

A responsive, content-managed institutional website for University Practice Senior High School (UNIPRA), Cape Coast. The application is built with Astro, React and TypeScript; Supabase provides PostgreSQL, authentication and media storage; Cloudflare Workers provides the production runtime.

> **Project status:** Initial implementation. It is not yet an approved or launched official school website. The school crest, official brand colours, current programme information, official contacts, campus photographs, historical copy and privacy notice must be reviewed and approved by school management before launch.

## Features

### Public website

- Responsive, mobile-first homepage and school identity pages.
- About, history, academics, admissions, news, events, gallery, alumni, contact and privacy pages.
- Database-driven news, announcements, events, gallery albums and custom CMS pages.
- SEO metadata, canonical links, Open Graph tags, educational organisation structured data, `robots.txt` and a database-aware XML sitemap.
- Contact form protected by Cloudflare Turnstile and a server-side submission endpoint.
- Custom 404 page and baseline security headers.

### Staff CMS

- Supabase email/password authentication; there is no public sign-up form.
- Dashboard overview and management for news, announcements, events, website pages, gallery albums, gallery images, categories and school settings.
- Contact enquiry inbox with status updates.
- Super-admin role assignment for staff profiles.
- Supabase Storage uploads for approved media.
- Content roles: `super_admin`, `admin`, `editor`, `media` and `viewer`.
- Database Row Level Security (RLS) is the security boundary; hiding a control in the dashboard is not treated as authorisation.
- Media users can submit news, events and gallery content as drafts or for review, but cannot publish or delete those records.

## Technology

| Layer | Technology |
|---|---|
| Public website | Astro 7, server rendering |
| Interactive UI / staff CMS | React 19 + TypeScript |
| Styling | CSS design system |
| Database | Supabase PostgreSQL |
| Staff authentication | Supabase Auth |
| Images and documents | Supabase Storage |
| Server runtime / hosting | Cloudflare Workers + Wrangler |
| Form abuse protection | Cloudflare Turnstile |
| CI | GitHub Actions |

The public pages are server-rendered so school information and published stories can be indexed by search engines. Supabase's browser-safe publishable/anon key is used only with RLS enabled. The Supabase service-role key is used exclusively by the contact endpoint on the Worker and must never be exposed to the browser.

## Requirements

- Node.js 22.12 or newer.
- npm 10 or newer.
- A Supabase project.
- A Cloudflare account with permission to deploy Workers.
- A Cloudflare Turnstile site/widget for the live domain and local development hostnames.

## 1. Install locally

```bash
npm install
cp .dev.vars.example .dev.vars
```

Edit `.dev.vars` with the real configuration values. Do not commit `.dev.vars` or paste secret keys into source files.

```dotenv
PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
PUBLIC_SUPABASE_ANON_KEY=YOUR_SUPABASE_PUBLISHABLE_OR_ANON_KEY
PUBLIC_SITE_URL=http://localhost:4321
PUBLIC_TURNSTILE_SITE_KEY=YOUR_TURNSTILE_SITE_KEY
SUPABASE_SERVICE_ROLE_KEY=YOUR_SUPABASE_SECRET_OR_SERVICE_ROLE_KEY
TURNSTILE_SECRET_KEY=YOUR_TURNSTILE_SECRET_KEY
```

For local Turnstile testing, use Cloudflare's documented test keys or a test widget that explicitly allows `localhost`. Do not use production secrets in a shared development environment.

Start the development server:

```bash
npm run dev
```

The Cloudflare adapter uses the Workers runtime for development. The `predev`, `precheck`, `prebuild`, `prepreview` and `predeploy` scripts run `wrangler types` to keep Worker binding types aligned with `wrangler.jsonc`.

## 2. Configure Supabase

1. Create a Supabase project in the school-controlled account.
2. Open **SQL Editor** in the Supabase Dashboard.
3. Run the complete migration in [`supabase/migrations/202611030001_initial_schema.sql`](supabase/migrations/202611030001_initial_schema.sql).
4. In **Authentication → Settings**, disable public sign-ups. Staff accounts should be invited or created by the authorised administrator only. Require verified email addresses where practical.
5. In **Project Settings → API**, copy the project URL and the publishable key (or legacy anon key). Put these in the Worker configuration as `PUBLIC_SUPABASE_URL` and `PUBLIC_SUPABASE_ANON_KEY`.
6. The migration creates the `upshs-media` Storage bucket, starter news categories, profiles trigger, RLS policies and the base tables.

### First super administrator

Create the first authorised staff user in **Authentication → Users**. The database trigger automatically creates a `viewer` profile for each Auth user. Then run this statement in the SQL Editor, replacing the email with the exact administrator account you created:

```sql
update public.profiles p
set role = 'super_admin'
from auth.users u
where p.id = u.id
  and lower(u.email) = lower('admin@example.edu.gh');
```

The first super administrator can then update roles from **Staff Portal → Team & access**. New staff accounts should still be created by an authorised Supabase administrator; there is deliberately no public registration workflow.

### Role guide

| Role | Intended access |
|---|---|
| `super_admin` | Full CMS access, website settings and staff roles |
| `admin` | Site settings and operational content management |
| `editor` | Review and publish content; manage public pages and enquiries |
| `media` | Prepare news, event and gallery submissions for editorial review |
| `viewer` | Dashboard overview only |

RLS policies in the migration should be reviewed by the school's technical owner before the project is used with real information. The public website can only read rows whose publication status is `published` (and announcements that have not expired). Private enquiries and staff profiles are not available to anonymous visitors.

## 3. Configure Cloudflare

The app deploys as a Cloudflare Worker. The supplied `wrangler.jsonc` config uses the current Astro Cloudflare adapter entrypoint and serves generated assets from `./dist`.

Set the following Worker secrets from the project root. Wrangler will prompt for each value:

```bash
npx wrangler secret put PUBLIC_SUPABASE_URL
npx wrangler secret put PUBLIC_SUPABASE_ANON_KEY
npx wrangler secret put PUBLIC_SITE_URL
npx wrangler secret put PUBLIC_TURNSTILE_SITE_KEY
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
npx wrangler secret put TURNSTILE_SECRET_KEY
```

Although the first four values are not privileged database secrets, they are stored as Worker secrets here so the same deployed configuration can be read at runtime. The service-role key and Turnstile secret are server-only and must never be exposed in browser code, page source, GitHub Actions logs or public repository files.

Create a Cloudflare Turnstile widget and allow the final school domain. The public site key is `PUBLIC_TURNSTILE_SITE_KEY`; the private Siteverify secret is `TURNSTILE_SECRET_KEY`. The enquiry endpoint rejects submissions if the origin, Turnstile response or hostname does not match the configured site.

Build and deploy:

```bash
npm run check
npm run build
npm run preview
npm run deploy
```

`npm run deploy` builds the application first, then invokes Wrangler. Wrangler authentication is required. The Worker name is currently `upshs-official-website`; change it in `wrangler.jsonc` only after the school agrees on the production account and naming.

### Custom domain

Attach the school-approved domain to the deployed Worker from Cloudflare **Workers & Pages → your Worker → Settings → Domains & Routes**. The school should own the domain registrar, Cloudflare account and Worker. Set `PUBLIC_SITE_URL` to the canonical HTTPS origin (for example `https://www.school-domain.example`, without a path) and add that exact hostname to the Turnstile widget.

## 4. GitHub deployment / CI

The repository includes a GitHub Actions workflow at `.github/workflows/ci.yml`. It installs dependencies and runs the Astro check and Cloudflare build for pushes and pull requests targeting `main`.

For automated production deployment, configure Cloudflare Workers Builds or add a separate deployment workflow with a scoped Cloudflare API token and the required Worker secrets. Do not store Supabase service-role or Turnstile secrets in the repository. If using GitHub Actions for deployment, add secrets in GitHub repository settings and restrict the token to this Worker.

## 5. Content and branding before public launch

The current implementation intentionally avoids inventing school contact details, programme offerings or student imagery. Before launch, the designated school representative should supply or approve:

- The official crest/logo in SVG or high-resolution transparent PNG.
- The school's official colour palette and brand usage rules.
- Current campus photographs and approved images of school life.
- School history, dates, leadership names and institutional descriptions.
- Current academic programmes, elective combinations and departmental information.
- Admissions and reporting guidance for the current academic year.
- Official telephone, email, postal address, location pin and social media URLs.
- The school-approved privacy notice, enquiry retention schedule and content publication policy.
- The staff list, initial roles and named content approvers.

The geometric crest-like mark and illustrated campus artwork are temporary design placeholders, not the official school crest or photographs. The history page contains a note that its historical facts were carried forward from the school's earlier published website and need formal confirmation. Programme and contact information is deliberately described as awaiting verification.

## 6. Operational guidance

- Use only school-approved photographs, especially where students can be identified. The school should establish the consent and lawful-basis process before publishing them.
- Keep the `upshs-media` bucket for images that have already been approved for public display. The bucket is public so published image URLs can load without signed links; anyone who receives an uploaded object's URL may be able to view that object. Do not upload unapproved or sensitive material.
- Set a retention schedule for contact messages and delete records once no longer required, subject to school policy and legal obligations.
- Enable Supabase point-in-time recovery or scheduled backups according to the project's budget and recovery needs. Test a restore procedure before launch.
- Review Supabase Auth users, role assignments, Cloudflare secrets, DNS and domain ownership periodically.
- Keep a named school administrator responsible for routine content review and updates. A website that is not maintained will quickly become unreliable.
- This starter project does not process admissions applications, student records or payments.

## Repository structure

```text
src/
  components/       Reusable Astro components and React islands
  layouts/          Shared site layout and metadata
  lib/              Supabase clients, helpers and shared types
  pages/             Public routes and server endpoints
  styles/            Global design system
  middleware.ts      Response security and cache headers
supabase/
  migrations/        PostgreSQL schema, RLS and Storage setup
docs/                Architecture and operational notes
public/              Static assets, icons and social preview graphic
wrangler.jsonc       Cloudflare Worker configuration
```

## License and ownership

This codebase is delivered for the proposed UNIPRA website project. Before official use, the school and developer should agree in writing on source-code ownership, domain and Cloudflare ownership, data-controller responsibilities, content permissions, support and maintenance arrangements. Do not publish the site as the school's official website until management has formally authorised it.
