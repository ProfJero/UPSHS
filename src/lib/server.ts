import { env } from 'cloudflare:workers';
import { createClient } from '@supabase/supabase-js';

export interface UpshsBindings {
  PUBLIC_SUPABASE_URL?: string;
  PUBLIC_SUPABASE_ANON_KEY?: string;
  PUBLIC_SITE_URL?: string;
  PUBLIC_TURNSTILE_SITE_KEY?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  TURNSTILE_SECRET_KEY?: string;
}

function getBindings(): UpshsBindings {
  return env as unknown as UpshsBindings;
}

export function getServerSupabase() {
  const bindings = getBindings();
  const url = bindings.PUBLIC_SUPABASE_URL ?? import.meta.env.PUBLIC_SUPABASE_URL;
  const key = bindings.PUBLIC_SUPABASE_ANON_KEY ?? import.meta.env.PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key || String(url).includes('YOUR_PROJECT_REF') || String(key).startsWith('YOUR_')) return null;
  return createClient(String(url), String(key), {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { 'X-Client-Info': 'upshs-official-website-ssr' } },
  });
}

export function getRuntimeConfig() {
  const bindings = getBindings();
  return {
    url: bindings.PUBLIC_SUPABASE_URL ?? import.meta.env.PUBLIC_SUPABASE_URL ?? '',
    anonKey: bindings.PUBLIC_SUPABASE_ANON_KEY ?? import.meta.env.PUBLIC_SUPABASE_ANON_KEY ?? '',
    siteUrl: bindings.PUBLIC_SITE_URL ?? import.meta.env.PUBLIC_SITE_URL ?? '',
    turnstileSiteKey: bindings.PUBLIC_TURNSTILE_SITE_KEY ?? import.meta.env.PUBLIC_TURNSTILE_SITE_KEY ?? '',
  };
}

export function getServerSecrets() {
  const bindings = getBindings();
  return {
    supabaseUrl: bindings.PUBLIC_SUPABASE_URL ?? import.meta.env.PUBLIC_SUPABASE_URL ?? '',
    serviceRoleKey: bindings.SUPABASE_SERVICE_ROLE_KEY ?? '',
    turnstileSecret: bindings.TURNSTILE_SECRET_KEY ?? '',
    siteUrl: bindings.PUBLIC_SITE_URL ?? import.meta.env.PUBLIC_SITE_URL ?? '',
  };
}
