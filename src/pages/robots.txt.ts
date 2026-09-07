import type { APIRoute } from 'astro';
import { SITE } from '../site.config';
import { absolute } from '../lib/url';

export const GET: APIRoute = () => {
  const lines = [
    'User-agent: *',
    'Allow: /',
    `Sitemap: ${absolute('/sitemap-index.xml', SITE.url)}`,
    '',
  ];
  return new Response(lines.join('\n'), {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};