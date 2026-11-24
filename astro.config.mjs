import { defineConfig } from 'astro/config';
import react from '@astrojs/react';

// Static site for Cloudflare Pages (https://upshs.pages.dev).
// Content is pulled from the UPSHS API Worker at build time.
export default defineConfig({
  site: process.env.PUBLIC_SITE_URL || 'https://upshs.pages.dev',
  output: 'static',
  trailingSlash: 'always',
  integrations: [react()],
  prefetch: { prefetchAll: true, defaultStrategy: 'hover' },
  build: { format: 'directory', inlineStylesheets: 'auto' },
  vite: { build: { chunkSizeWarningLimit: 900 } },
});
