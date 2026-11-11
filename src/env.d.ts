/// <reference types="astro/client" />
/// <reference types="@astrojs/cloudflare" />

interface Env {
  PUBLIC_SUPABASE_URL?: string;
  PUBLIC_SUPABASE_ANON_KEY?: string;
  PUBLIC_SITE_URL?: string;
  PUBLIC_TURNSTILE_SITE_KEY?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  TURNSTILE_SECRET_KEY?: string;
}

interface Window {
    __UPSHS_CONFIG__?: {
      url?: string;
      anonKey?: string;
      turnstileSiteKey?: string;
    };
}
