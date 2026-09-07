import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const posts = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/posts' }),
  schema: z.object({
    title: z.string(),
    description: z.string().default(''),
    pubDate: z.coerce.date(),
    updated: z.coerce.date().optional(),
    /** Obsidian 支持嵌套标签 research/nlp，此处保留原始形态，展示层再拆 */
    tags: z.array(z.string()).default([]),
    draft: z.boolean().default(false),
    /** 同步脚本的白名单开关；false 的文章只存在于仓库，不会被发布 */
    publish: z.boolean().default(true),
    aliases: z.array(z.string()).default([]),
    cover: z.string().optional(),
    series: z.string().optional(),
    lang: z.string().default('zh-CN'),
  }),
});

/** 独立页面（关于 / 友链等），同样用 Markdown 维护，便于从 Obsidian 同步 */
const pages = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/pages' }),
  schema: z.object({
    title: z.string(),
    description: z.string().default(''),
    updated: z.coerce.date().optional(),
  }),
});

export const collections = { posts, pages };
