# University Practice Senior High School — Website

This repository contains the initial implementation source bundle for the proposed UNIPRA official website and staff content-management system.

## Restore the full source tree

The Brotli-compressed source archive is stored as seven base64 text parts under `source-parts/` so it can be committed through GitHub's text-file interface. Requirements: Node.js 22.12+ and a system `tar` executable.

```bash
node restore-source.mjs
npm install
npm run check
npm run build
```

The restore script joins the parts, reconstructs the archive and extracts the complete project into the repository root.

## Architecture

- Public website: Astro with React components and TypeScript.
- Admin CMS: React, Supabase Auth and role-aware content workflows.
- Database: Supabase PostgreSQL with SQL migrations, Row Level Security and least-privilege grants.
- Media: Supabase Storage.
- Hosting/API: Cloudflare Workers and the Astro Cloudflare adapter.
- Public features: homepage, school profile, academics, admissions guidance, news, announcements, events, gallery, alumni information, contact, privacy, sitemap and robots routes.
- CMS: news, announcements, events, custom pages, gallery albums/items, categories, school settings, contact enquiries, staff roles and audit history.

## Configure services

1. Create a Supabase project controlled by the school.
2. Apply `supabase/migrations/202611030001_initial_schema.sql` using the Supabase SQL Editor or Supabase CLI.
3. Create the initial authorised staff account and promote it to `super_admin` using the documented bootstrap procedure.
4. Configure Cloudflare Worker variables and secrets using `.dev.vars.example` and the full project README.
5. Configure Cloudflare Turnstile and its server-side secret.
6. Replace placeholder branding, contact details, programmes, history and photographs with information approved by school management.
7. Run the checks and build, then deploy to a school-controlled Cloudflare account and domain.

## Important project status

This is an initial source implementation, **not a deployed or officially approved school website**. No live Supabase project, service credentials, official domain or school-owned image assets were supplied, so database provisioning, production authentication, domain setup and deployment have not been completed.

The development environment could validate TypeScript/TSX syntax and configuration parsing, but a full Astro check/build could not run because npm registry access failed with a DNS `EAI_AGAIN` error.

The school should own its domain, Supabase project, Cloudflare account, credentials and website content. Never commit real secrets. Obtain management approval and verify all school information before public launch.
