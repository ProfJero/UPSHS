import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let browserClient: SupabaseClient | null = null;

export function getBrowserSupabase(): SupabaseClient | null {
  if (typeof window === 'undefined') return null;
  const url = window.__UPSHS_CONFIG__?.url || (import.meta.env.PUBLIC_SUPABASE_URL as string | undefined);
  const key = window.__UPSHS_CONFIG__?.anonKey || (import.meta.env.PUBLIC_SUPABASE_ANON_KEY as string | undefined);
  if (!url || !key || url.includes('YOUR_PROJECT_REF') || key.startsWith('YOUR_')) return null;
  if (!browserClient) browserClient = createClient(url, key, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    global: { headers: { 'X-Client-Info': 'upshs-official-website' } },
  });
  return browserClient;
}
