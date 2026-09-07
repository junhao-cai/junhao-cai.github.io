import type { APIRoute } from 'astro';
import bibSource from '../data/pubs.bib?raw';

/**
 * 直接把 BibTeX 源文件原样吐出来，方便别人引用你的工作时一键导入。
 * 访问 /cv.bib 即可下载；内容随 src/data/pubs.bib 变化。
 */
export const GET: APIRoute = () =>
  new Response(bibSource, {
    status: 200,
    headers: {
      'Content-Type': 'application/x-bibtex; charset=utf-8',
      'Content-Disposition': 'attachment; filename="publications.bib"',
      'Cache-Control': 'public, max-age=3600',
    },
  });
