import type { CollectionEntry } from 'astro:content';
import type { Lang } from '../i18n';

export interface TagInfo {
  /** 原始标签，可能含 / 表示层级，如 research/nlp */
  raw: string;
  /** URL 安全形态 */
  slug: string;
  /** 展示用的叶子名 */
  label: string;
  count: number;
}

/** 把标签转成 URL 安全片段（保留层级信息，用 - 连接） */
export function tagSlug(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/\//g, '-')
    .replace(/[^\p{L}\p{N}\-]/gu, '');
}

export function collectTags(posts: CollectionEntry<'posts'>[]): TagInfo[] {
  const counter = new Map<string, number>();
  for (const p of posts) {
    for (const t of p.data.tags) {
      const raw = t.trim();
      if (!raw) continue;
      counter.set(raw, (counter.get(raw) ?? 0) + 1);
    }
  }
  return [...counter.entries()]
    .map(([raw, count]) => ({
      raw,
      slug: tagSlug(raw),
      label: raw.split('/').pop() ?? raw,
      count,
    }))
    .sort((a, b) => b.count - a.count || a.raw.localeCompare(b.raw));
}

export function postsOfTag(posts: CollectionEntry<'posts'>[], slug: string) {
  return posts
    .filter((p) => p.data.tags.some((t) => tagSlug(t) === slug))
    .sort((a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf());
}

/** 笔记 frontmatter 的 lang 字段归一化为站点语言（'zh-CN' → zh） */
export function postLang(p: CollectionEntry<'posts'>): Lang {
  return String(p.data.lang ?? 'zh').startsWith('en') ? 'en' : 'zh';
}

/** 已发布且非草稿，按日期倒序；传入 lang 时只保留对应语言的笔记 */
export function publishedPosts(posts: CollectionEntry<'posts'>[], lang?: Lang) {
  const filtered = lang ? posts.filter((p) => postLang(p) === lang) : posts;
  return filtered
    .filter((p) => p.data.publish !== false && !p.data.draft)
    .sort((a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf());
}
