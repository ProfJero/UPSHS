-- University Practice Senior High School official website
-- Initial schema: public CMS, controlled publishing, enquiries and public media.
-- Run with Supabase CLI or paste into the Supabase SQL Editor.

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  role text not null default 'viewer' check (role in ('super_admin','admin','editor','media','viewer')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.has_role(allowed_roles text[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid())
      and p.role = any(allowed_roles)
  );
$$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, role)
  values (new.id, nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''), 'viewer')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

create table if not exists public.site_settings (
  id boolean primary key default true check (id = true),
  school_name text not null default 'University Practice Senior High School',
  short_name text not null default 'UPSHS',
  motto text not null default 'Service to the Community',
  location text not null default 'Cape Coast, Central Region, Ghana',
  public_email text,
  public_phone text,
  postal_address text,
  social_links jsonb not null default '{}'::jsonb,
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);
insert into public.site_settings (id) values (true) on conflict (id) do nothing;

create table if not exists public.news_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text not null unique,
  description text,
  created_at timestamptz not null default now()
);

create table if not exists public.news_posts (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text not null unique,
  excerpt text,
  content text not null,
  category_id uuid references public.news_categories(id) on delete set null,
  cover_image_url text,
  author_id uuid references public.profiles(id) on delete set null,
  status text not null default 'draft' check (status in ('draft','review','published','archived')),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint news_title_length check (char_length(title) between 3 and 180),
  constraint news_slug_format check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$')
);

create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  link_url text,
  priority text not null default 'normal' check (priority in ('normal','important','urgent')),
  status text not null default 'draft' check (status in ('draft','published','archived')),
  created_by uuid references public.profiles(id) on delete set null,
  published_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint announcement_title_length check (char_length(title) between 3 and 180),
  constraint announcement_expiry check (expires_at is null or published_at is null or expires_at > published_at)
);

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text not null unique,
  description text,
  location text,
  starts_at timestamptz not null,
  ends_at timestamptz,
  cover_image_url text,
  status text not null default 'draft' check (status in ('draft','review','published','archived')),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint event_time_order check (ends_at is null or ends_at >= starts_at),
  constraint event_slug_format check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$')
);

create table if not exists public.pages (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text not null unique,
  summary text,
  content text not null,
  hero_image_url text,
  meta_description text,
  status text not null default 'draft' check (status in ('draft','review','published','archived')),
  created_by uuid references public.profiles(id) on delete set null,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint page_slug_format check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$')
);

create table if not exists public.gallery_albums (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text not null unique,
  description text,
  cover_image_url text,
  status text not null default 'draft' check (status in ('draft','review','published','archived')),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint album_slug_format check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$')
);

create table if not exists public.gallery_items (
  id uuid primary key default gen_random_uuid(),
  album_id uuid not null references public.gallery_albums(id) on delete cascade,
  image_url text not null,
  caption text,
  alt_text text,
  status text not null default 'draft' check (status in ('draft','review','published','archived')),
  display_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  subject text not null,
  message text not null,
  status text not null default 'new' check (status in ('new','read','replied','closed')),
  created_at timestamptz not null default now(),
  constraint contact_name_length check (char_length(name) between 2 and 100),
  constraint contact_email_length check (char_length(email) between 5 and 254 and position('@' in email) > 1),
  constraint contact_subject_length check (char_length(subject) between 3 and 160),
  constraint contact_message_length check (char_length(message) between 10 and 4000)
);

create table if not exists public.audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null,
  table_name text not null,
  record_id text,
  created_at timestamptz not null default now()
);

-- Helpful indexes for public listing, filtering and admin tables.
create index if not exists news_posts_publication_idx on public.news_posts (published_at desc) where status = 'published';
create index if not exists news_posts_category_idx on public.news_posts (category_id);
create index if not exists events_publication_idx on public.events (starts_at asc) where status = 'published';
create index if not exists announcements_publication_idx on public.announcements (published_at desc) where status = 'published';
create index if not exists pages_status_idx on public.pages (status, slug);
create index if not exists gallery_albums_status_idx on public.gallery_albums (status, created_at desc);
create index if not exists gallery_items_album_idx on public.gallery_items (album_id, display_order);
create index if not exists contact_messages_status_idx on public.contact_messages (status, created_at desc);

-- Updated-at triggers.
do $$
declare table_name text;
begin
  foreach table_name in array array['profiles','news_posts','announcements','events','pages','gallery_albums','site_settings'] loop
    execute format('drop trigger if exists set_updated_at on public.%I', table_name);
    execute format('create trigger set_updated_at before update on public.%I for each row execute procedure public.set_updated_at()', table_name);
  end loop;
end $$;

-- A compact audit trail for content changes. It stores metadata, not message bodies.
create or replace function public.log_content_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_id text;
  verb text;
begin
  if (tg_op = 'DELETE') then target_id := old.id::text; verb := 'DELETE';
  elsif (tg_op = 'UPDATE') then target_id := new.id::text; verb := 'UPDATE';
  else target_id := new.id::text; verb := 'INSERT';
  end if;
  insert into public.audit_logs(actor_id, action, table_name, record_id)
  values ((select auth.uid()), verb, tg_table_name, target_id);
  if (tg_op = 'DELETE') then return old; else return new; end if;
end;
$$;

drop trigger if exists audit_news_posts on public.news_posts;
create trigger audit_news_posts after insert or update or delete on public.news_posts for each row execute procedure public.log_content_change();
drop trigger if exists audit_announcements on public.announcements;
create trigger audit_announcements after insert or update or delete on public.announcements for each row execute procedure public.log_content_change();
drop trigger if exists audit_events on public.events;
create trigger audit_events after insert or update or delete on public.events for each row execute procedure public.log_content_change();
drop trigger if exists audit_pages on public.pages;
create trigger audit_pages after insert or update or delete on public.pages for each row execute procedure public.log_content_change();
drop trigger if exists audit_gallery_albums on public.gallery_albums;
create trigger audit_gallery_albums after insert or update or delete on public.gallery_albums for each row execute procedure public.log_content_change();

-- Enable RLS on every table exposed through the Data API.
alter table public.profiles enable row level security;
alter table public.site_settings enable row level security;
alter table public.news_categories enable row level security;
alter table public.news_posts enable row level security;
alter table public.announcements enable row level security;
alter table public.events enable row level security;
alter table public.pages enable row level security;
alter table public.gallery_albums enable row level security;
alter table public.gallery_items enable row level security;
alter table public.contact_messages enable row level security;
alter table public.audit_logs enable row level security;

-- Profiles: users can read their own profile; management can read staff; only super admins change roles.
drop policy if exists "Profile owner or admins can read" on public.profiles;
create policy "Profile owner or admins can read" on public.profiles for select to authenticated
using (id = (select auth.uid()) or public.has_role(array['super_admin','admin','editor']));
drop policy if exists "Super admins manage profiles" on public.profiles;
create policy "Super admins manage profiles" on public.profiles for update to authenticated
using (public.has_role(array['super_admin'])) with check (public.has_role(array['super_admin']));

-- Public settings and categories are intentionally readable; writes require school management.
drop policy if exists "Public can read site settings" on public.site_settings;
create policy "Public can read site settings" on public.site_settings for select to anon, authenticated using (true);
drop policy if exists "Admins update site settings" on public.site_settings;
create policy "Admins update site settings" on public.site_settings for update to authenticated using (public.has_role(array['super_admin','admin'])) with check (public.has_role(array['super_admin','admin']));
drop policy if exists "Public can read categories" on public.news_categories;
create policy "Public can read categories" on public.news_categories for select to anon, authenticated using (true);
drop policy if exists "Editors manage categories" on public.news_categories;
create policy "Editors manage categories" on public.news_categories for all to authenticated using (public.has_role(array['super_admin','admin','editor'])) with check (public.has_role(array['super_admin','admin','editor']));

-- News: public sees published content; assigned editorial and media roles can manage drafts.
drop policy if exists "Public reads published news" on public.news_posts;
create policy "Public reads published news" on public.news_posts for select to anon, authenticated using (status = 'published');
drop policy if exists "Staff reads all news" on public.news_posts;
create policy "Staff reads all news" on public.news_posts for select to authenticated using (public.has_role(array['super_admin','admin','editor','media']));
drop policy if exists "Editorial staff create news" on public.news_posts;
create policy "Editorial staff create news" on public.news_posts for insert to authenticated with check (public.has_role(array['super_admin','admin','editor']) or (public.has_role(array['media']) and status in ('draft','review')));
drop policy if exists "Editorial staff update news" on public.news_posts;
create policy "Editorial staff update news" on public.news_posts for update to authenticated using (public.has_role(array['super_admin','admin','editor','media'])) with check (public.has_role(array['super_admin','admin','editor']) or (public.has_role(array['media']) and status in ('draft','review')));
drop policy if exists "Admins delete news" on public.news_posts;
create policy "Admins delete news" on public.news_posts for delete to authenticated using (public.has_role(array['super_admin','admin']));

-- Announcements.
drop policy if exists "Public reads current announcements" on public.announcements;
create policy "Public reads current announcements" on public.announcements for select to anon, authenticated using (status = 'published' and (expires_at is null or expires_at > now()));
drop policy if exists "Editors read announcements" on public.announcements;
create policy "Editors read announcements" on public.announcements for select to authenticated using (public.has_role(array['super_admin','admin','editor']));
drop policy if exists "Editors create announcements" on public.announcements;
create policy "Editors create announcements" on public.announcements for insert to authenticated with check (public.has_role(array['super_admin','admin','editor']));
drop policy if exists "Editors update announcements" on public.announcements;
create policy "Editors update announcements" on public.announcements for update to authenticated using (public.has_role(array['super_admin','admin','editor'])) with check (public.has_role(array['super_admin','admin','editor']));
drop policy if exists "Admins delete announcements" on public.announcements;
create policy "Admins delete announcements" on public.announcements for delete to authenticated using (public.has_role(array['super_admin','admin']));

-- Events.
drop policy if exists "Public reads published events" on public.events;
create policy "Public reads published events" on public.events for select to anon, authenticated using (status = 'published');
drop policy if exists "Staff reads all events" on public.events;
create policy "Staff reads all events" on public.events for select to authenticated using (public.has_role(array['super_admin','admin','editor','media']));
drop policy if exists "Staff creates events" on public.events;
create policy "Staff creates events" on public.events for insert to authenticated with check (public.has_role(array['super_admin','admin','editor']) or (public.has_role(array['media']) and status in ('draft','review')));
drop policy if exists "Staff updates events" on public.events;
create policy "Staff updates events" on public.events for update to authenticated using (public.has_role(array['super_admin','admin','editor','media'])) with check (public.has_role(array['super_admin','admin','editor']) or (public.has_role(array['media']) and status in ('draft','review')));
drop policy if exists "Admins delete events" on public.events;
create policy "Admins delete events" on public.events for delete to authenticated using (public.has_role(array['super_admin','admin']));

-- Pages.
drop policy if exists "Public reads published pages" on public.pages;
create policy "Public reads published pages" on public.pages for select to anon, authenticated using (status = 'published');
drop policy if exists "Editors read all pages" on public.pages;
create policy "Editors read all pages" on public.pages for select to authenticated using (public.has_role(array['super_admin','admin','editor']));
drop policy if exists "Editors create pages" on public.pages;
create policy "Editors create pages" on public.pages for insert to authenticated with check (public.has_role(array['super_admin','admin','editor']));
drop policy if exists "Editors update pages" on public.pages;
create policy "Editors update pages" on public.pages for update to authenticated using (public.has_role(array['super_admin','admin','editor'])) with check (public.has_role(array['super_admin','admin','editor']));
drop policy if exists "Admins delete pages" on public.pages;
create policy "Admins delete pages" on public.pages for delete to authenticated using (public.has_role(array['super_admin','admin']));

-- Gallery albums and their images.
drop policy if exists "Public reads published albums" on public.gallery_albums;
create policy "Public reads published albums" on public.gallery_albums for select to anon, authenticated using (status = 'published');
drop policy if exists "Media staff reads all albums" on public.gallery_albums;
create policy "Media staff reads all albums" on public.gallery_albums for select to authenticated using (public.has_role(array['super_admin','admin','editor','media']));
drop policy if exists "Media staff creates albums" on public.gallery_albums;
create policy "Media staff creates albums" on public.gallery_albums for insert to authenticated with check (public.has_role(array['super_admin','admin','editor']) or (public.has_role(array['media']) and status in ('draft','review')));
drop policy if exists "Media staff updates albums" on public.gallery_albums;
create policy "Media staff updates albums" on public.gallery_albums for update to authenticated using (public.has_role(array['super_admin','admin','editor','media'])) with check (public.has_role(array['super_admin','admin','editor']) or (public.has_role(array['media']) and status in ('draft','review')));
drop policy if exists "Admins delete albums" on public.gallery_albums;
create policy "Admins delete albums" on public.gallery_albums for delete to authenticated using (public.has_role(array['super_admin','admin']));
drop policy if exists "Public reads images in published albums" on public.gallery_items;
create policy "Public reads images in published albums" on public.gallery_items for select to anon, authenticated using (status = 'published' and exists (select 1 from public.gallery_albums a where a.id = album_id and a.status = 'published'));
drop policy if exists "Media staff reads all gallery images" on public.gallery_items;
create policy "Media staff reads all gallery images" on public.gallery_items for select to authenticated using (public.has_role(array['super_admin','admin','editor','media']));
drop policy if exists "Media staff creates gallery images" on public.gallery_items;
create policy "Media staff creates gallery images" on public.gallery_items for insert to authenticated with check (public.has_role(array['super_admin','admin','editor']) or (public.has_role(array['media']) and status in ('draft','review')));
drop policy if exists "Media staff updates gallery images" on public.gallery_items;
create policy "Media staff updates gallery images" on public.gallery_items for update to authenticated using (public.has_role(array['super_admin','admin','editor','media'])) with check (public.has_role(array['super_admin','admin','editor']) or (public.has_role(array['media']) and status in ('draft','review')));
drop policy if exists "Admins delete gallery images" on public.gallery_items;
create policy "Admins delete gallery images" on public.gallery_items for delete to authenticated using (public.has_role(array['super_admin','admin']));

-- Contact form submissions are inserted only by the server after Turnstile verification.
drop policy if exists "School staff reads enquiries" on public.contact_messages;
create policy "School staff reads enquiries" on public.contact_messages for select to authenticated using (public.has_role(array['super_admin','admin','editor']));
drop policy if exists "School staff updates enquiries" on public.contact_messages;
create policy "School staff updates enquiries" on public.contact_messages for update to authenticated using (public.has_role(array['super_admin','admin','editor'])) with check (public.has_role(array['super_admin','admin','editor']));

-- Audit trail is visible only to senior administrators.
drop policy if exists "Senior admins read audit logs" on public.audit_logs;
create policy "Senior admins read audit logs" on public.audit_logs for select to authenticated using (public.has_role(array['super_admin','admin']));

-- Public image bucket. Only authorised staff can add, replace or remove files.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('upshs-media','upshs-media',true,5242880,array['image/jpeg','image/png','image/webp','image/avif'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Public reads approved media files" on storage.objects;
create policy "Public reads approved media files" on storage.objects for select to anon, authenticated using (bucket_id = 'upshs-media');
drop policy if exists "School media team uploads files" on storage.objects;
create policy "School media team uploads files" on storage.objects for insert to authenticated with check (bucket_id = 'upshs-media' and public.has_role(array['super_admin','admin','editor','media']));
drop policy if exists "School media team updates files" on storage.objects;
create policy "School media team updates files" on storage.objects for update to authenticated using (bucket_id = 'upshs-media' and public.has_role(array['super_admin','admin','editor','media'])) with check (bucket_id = 'upshs-media' and public.has_role(array['super_admin','admin','editor','media']));
drop policy if exists "School media team deletes files" on storage.objects;
create policy "School media team deletes files" on storage.objects for delete to authenticated using (bucket_id = 'upshs-media' and public.has_role(array['super_admin','admin','editor','media']));

-- Starter categories. These do not publish unverified school news.
insert into public.news_categories (name,slug,description) values
  ('School News','school-news','Updates and stories from the school.'),
  ('Academics','academics','Academic activities and achievements.'),
  ('Sports & Culture','sports-culture','Sports, culture and extracurricular activities.'),
  ('Announcements','announcements','Official notices and important information.'),
  ('Community','community','Stories about the wider UNIPRA community.')
on conflict (slug) do nothing;

-- First administrator bootstrap:
-- 1. Create the account in Supabase Dashboard > Authentication > Users.
-- 2. Run the following separately, replacing the address:
-- update public.profiles p set role = 'super_admin'
-- from auth.users u where p.id = u.id and lower(u.email) = lower('YOUR_ADMIN_EMAIL');
-- Never expose a Supabase service_role/secret key in the browser or repository.

-- Explicit least-privilege Data API grants. Policies and SQL grants work together.
-- Supabase projects may grant broad default privileges on public tables; remove those first.
revoke all privileges on all tables in schema public from anon, authenticated;
revoke all privileges on all sequences in schema public from anon, authenticated;
revoke execute on all functions in schema public from public, anon, authenticated;
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;

grant usage on schema public to anon, authenticated;
grant execute on function public.has_role(text[]) to authenticated;
grant select on public.site_settings, public.news_categories, public.news_posts, public.announcements, public.events, public.pages, public.gallery_albums, public.gallery_items to anon, authenticated;
grant select, update on public.profiles to authenticated;
grant insert, update, delete on public.news_categories, public.news_posts, public.announcements, public.events, public.pages, public.gallery_albums, public.gallery_items to authenticated;
grant update on public.site_settings to authenticated;
grant select on public.contact_messages to authenticated;
grant update (status) on public.contact_messages to authenticated;
grant select on public.audit_logs to authenticated;
