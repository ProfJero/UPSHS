# University Practice Senior High School — Website

Official website and staff CMS for **University Practice Senior High School (UPSHS / UNIPRA), Cape Coast**.

| | URL | What it is |
|---|---|---|
| Website | https://upshs.pages.dev | Astro static site on **Cloudflare Pages** (auto-deploys from `main`) |
| API | https://upshs.profjero947.workers.dev | **Cloudflare Worker** (`api/`): content API, forms, staff auth, upload signing |
| Data | Firebase **Cloud Firestore** | News, events, notices, gallery, downloads, staff, enquiries |
| Staff sign-in | Firebase **Authentication** | Email/password and Google sign-in |
| Media | **Cloudinary** | Photos and documents, delivered with automatic format/size optimisation |

```text
Browser ──► upshs.pages.dev (pre-rendered HTML, fast & indexable)
              │  build time: GET /v1/public/bundle
              ▼
           API Worker ──► Firestore (service account)
              ▲   │
   /admin ────┘   └──► Pages deploy hook (rebuild after publishing)
   (Firebase ID token)          Cloudinary ◄── direct signed uploads from /admin
```

The public site is fully pre-rendered, so it is fast, works on slow connections and is easy for Google to index. When staff publish something in the portal, the API calls a Pages **deploy hook** and the site rebuilds in about 1–2 minutes.

## Features

**Public site**: homepage with audience quick links, welcome message, programmes, news, events and notice board, gallery and achievements. Also About (history timeline, crest symbolism, values), Leadership, Achievements, Academics, Student Life, News, Events calendar (Google Calendar, .ics download and a subscribable calendar feed), Notice board, Gallery with lightbox, Downloads, Alumni register, FAQ (including how placement works through the GES CSSPS), Contact with map, Privacy, Search and a 404 page.

**UX**: four colour themes (Royal, Coastal, Flame, Forest; Coastal also switches to the blue crest), Light / Dark / Auto mode, a "reduce motion" switch, ⌘K / `/` site search, page transitions, scroll reveals, counters, animated waves, a mega-menu, a full-screen mobile menu, a scrolling announcement ticker and a back-to-top button. It is accessible: skip link, focus styles, ARIA labels, and `prefers-reduced-motion` is respected.

**SEO**: per-page titles and descriptions, canonical URLs, Open Graph and Twitter cards, and JSON-LD for `HighSchool`, `WebSite` + `SearchAction`, `BreadcrumbList`, `NewsArticle`, `Event`, `FAQPage`, `ImageGallery` and `EducationalOccupationalProgram`. Also `sitemap.xml` with image entries, `robots.txt`, `rss.xml`, a web app manifest, Google and Bing verification tags, and a 301 redirect from `/admissions/`.

**Staff portal** (`/admin/`): dashboard, editors for every collection (Markdown with preview, drag-and-drop Cloudinary uploads, gallery reordering), draft → review → published workflow, enquiry, alumni and newsletter inboxes with CSV export, site settings, team and roles, an activity log, and a "Publish site" button.

Roles: **Super admin** (everything, including staff access) · **Administrator** (content, settings, inboxes) · **Editor** (create, publish, delete) · **Media team** (drafts and submit for review).

## Setup

### 1. Firebase (Firestore + Auth)

1. Create a project at https://console.firebase.google.com.
2. **Firestore Database → Create database** (production mode). Then **Rules**: paste [`firestore.rules`](firestore.rules) and publish. It denies all direct browser access; only the API's service account can read or write.
3. **Authentication → Sign-in method**: enable **Email/Password** and **Google**. Under **Settings → Authorized domains**, add `upshs.pages.dev`.
4. **Project settings → Service accounts → Generate new private key**. This downloads a JSON file for the API. Keep it secret and never commit it.
5. **Project settings → General → Your apps → Add web app**. Copy `apiKey`, `authDomain`, `projectId` and `appId` for the website.

### 2. Cloudinary

From the Cloudinary dashboard, copy the **Cloud name**, **API key** and **API secret**. To let documents (PDFs) be downloaded on a free plan, enable **Settings → Security → Allow delivery of PDF and ZIP files**.

### 3. API Worker (`api/`)

Edit `api/wrangler.jsonc` → `vars`:

```jsonc
"FIREBASE_PROJECT_ID": "your-firebase-project-id",
"CLOUDINARY_CLOUD_NAME": "your-cloud-name",
"CLOUDINARY_API_KEY": "your-api-key",
"SUPER_ADMIN_EMAILS": "you@example.com"   // first super admin(s), comma-separated
```

Then deploy the API and set its secrets:

```bash
cd api && npm install
```

```bash
npx wrangler deploy
```

```bash
npx wrangler secret put FIREBASE_SERVICE_ACCOUNT   # paste the whole service-account JSON
```

```bash
npx wrangler secret put CLOUDINARY_API_SECRET
```

```bash
npx wrangler secret put REBUILD_HOOK_URL           # see step 4
```

Optional: `TURNSTILE_SECRET_KEY` (spam protection for forms). Check the setup at https://upshs.profjero947.workers.dev/v1/health.

To have GitHub Actions deploy the API on every push to `main`, add `CLOUDFLARE_API_TOKEN` (and `CLOUDFLARE_ACCOUNT_ID`) as repository secrets.

### 4. Cloudflare Pages (`upshs`)

The Pages project is already connected to this repository (build command `npm run build`, output `dist`).

1. **Settings → Variables and Secrets** (Production and Preview): add the values from [`.env.example`](.env.example), at minimum the four `PUBLIC_FIREBASE_*` values. `PUBLIC_API_URL` and `PUBLIC_SITE_URL` default to the URLs above.
2. **Settings → Builds → Deploy hooks**: create a hook for branch `main` and set its URL as the API's `REBUILD_HOOK_URL` secret.
3. Redeploy.

### 5. First sign-in

Open https://upshs.pages.dev/admin/ and sign in with an email listed in `SUPER_ADMIN_EMAILS` (Google sign-in is easiest; email/password accounts must verify their email first). Add other staff under **Team & access**, then fill in **Site settings**: phone, email, address, social links, the headteacher's message and photo, and the homepage photo.

### 6. Google Search Console

1. Add the property `https://upshs.pages.dev/` (URL prefix) at https://search.google.com/search-console.
2. Choose **HTML tag** verification and copy the `content` value into the Pages variable `PUBLIC_GOOGLE_SITE_VERIFICATION`, then redeploy and click **Verify**.
3. **Sitemaps** → submit `sitemap.xml`.

If you later add a custom domain, set `PUBLIC_SITE_URL` to it, add it to the API's `ALLOWED_ORIGINS` and Firebase's authorised domains, and add the new property in Search Console.

## Development

```bash
npm install
```

```bash
cp .env.example .env
```

```bash
npm run dev          # site on http://localhost:4321
```

```bash
cp api/.dev.vars.example api/.dev.vars && npm run api:dev   # API on http://localhost:8787
```

Point the site at a local API with `PUBLIC_API_URL=http://localhost:8787`. `npm run check` type-checks the site; `npm --prefix api run check` checks the API.

## Where things live

```text
src/pages/          Public routes (+ sitemap, robots, rss, manifest, search index, .ics feeds)
src/components/     Header, footer, cards, hero, crest, search palette
src/layouts/        BaseLayout: SEO head, theme bootstrap, page transitions
src/scripts/site.ts Client behaviour (themes, reveal, search, forms, lightbox, filters)
src/styles/         Design tokens and global styles
src/data/school.ts  Static school info: navigation, history, programmes, clubs, FAQ (edit here)
src/admin/          Staff portal (React)
shared/             Collection schema shared by the portal and the API
api/                Cloudflare Worker API (Hono): Firestore REST, Firebase token checks, Cloudinary signing
```

## Content to confirm with the school

Text in `src/data/school.ts` and the About page draws on the school's published history. Before an official launch, school management should confirm the **mission and vision statements**, the **list of elective programmes and subjects**, **clubs and sports**, and the **crest symbolism** wording. Use only photos of students that have been approved for public display.
