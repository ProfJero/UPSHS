# University Practice Senior High School — Website

The complete initial source snapshot is included in **[UPSHS-project.zip](./UPSHS-project.zip)**.

## Restore the project files

Download or clone this repository, then extract the source archive into the repository root:

```bash
unzip -o UPSHS-project.zip -d .
npm install
npm run check
npm run build
```

Requirements: Node.js 22.12 or newer, a Supabase project and a Cloudflare account.

## Configure services

1. Create a Supabase project controlled by the school.
2. Run `supabase/migrations/202611030001_initial_schema.sql` in the Supabase SQL Editor.
3. Create the first authorised staff account and promote it to `super_admin` using the SQL instructions in the full project README.
4. Configure the Cloudflare Worker bindings and secrets listed in `.dev.vars.example` and the full README.
5. Add a Cloudflare Turnstile widget and configure its public site key and server-side secret.
6. Replace placeholder branding and school information with material approved by school management before public launch.

## Important

This is an initial implementation, **not a deployed or officially approved school website**. The project archive contains the full setup guide, architecture notes, public website, staff CMS, Supabase migration, Cloudflare configuration and CI workflow. No live Supabase project, service credentials, domain or school-owned image assets were supplied, so those services have not been connected or deployed.

The school should own its domain, Supabase project, Cloudflare account, credentials and content. Do not commit real secrets.
