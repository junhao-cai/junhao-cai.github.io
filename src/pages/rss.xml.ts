import rss from '@astrojs/rss';
import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { SITE } from '../site.config';
import { publishedPosts } from '../lib/tags';

export const GET: APIRoute = async (context) => {
  const posts = publishedPosts(await getCollection('posts'));
  return rss({
    title: SITE.title,
    description: SITE.description,
    site: context.site ?? SITE.url,
    items: posts.map((p) => ({
      title: p.data.title,
      pubDate: p.data.pubDate,
      description: p.data.description,
      link: `/posts/${p.id}/`,
      categories: p.data.tags,
    })),
    customData: `<language>zh-CN</language>`,
    trailingSlash: true,
    xmlns: { atom: 'http://www.w3.org/2005/Atom' },
  });
};