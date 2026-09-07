import { defineConfig } from 'astro/config';
import vue from '@astrojs/vue';
import sitemap from '@astrojs/sitemap';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import rehypeSlug from 'rehype-slug';
import rehypeAutolinkHeadings from 'rehype-autolink-headings';
import { remarkObsidian } from './src/lib/remark-obsidian.mjs';

/**
 * 部署目标（GitHub Pages）
 * ----------------------------------------------------------------------------
 * 用户仓库   → https://<user>.github.io/                    base: '/'
 * 项目仓库   → https://<user>.github.io/<repo>/             base: '/<repo>/'
 *
 * site 与 base 由 .github/workflows/deploy.yml 按仓库名自动推导，无需在此手改；
 * 详见 README.md 的「部署」一段。
 */
const SITE_URL = process.env.SITE_URL || 'https://example.github.io';
const BASE_PATH = process.env.BASE_PATH || '/';

export default defineConfig({
  site: SITE_URL,
  base: BASE_PATH,
  trailingSlash: 'always',
  /**
   * 双语路由：中文为默认语言且不带前缀（/ 根路径），英文走 /en/。
   * 既有 URL 全部保持不变，英文版为纯增量。
   */
  i18n: {
    defaultLocale: 'zh',
    locales: ['zh', 'en'],
    routing: { prefixDefaultLocale: false },
  },
  prefetch: { prefetchAll: true, defaultStrategy: 'viewport' },
  integrations: [
    vue(),
    sitemap({ changefreq: 'monthly', priority: 0.7 }),
  ],
  markdown: {
    remarkPlugins: [
      remarkGfm,
      [remarkMath, { singleDollarTextMath: false }],
      remarkObsidian,
    ],
    rehypePlugins: [
      rehypeKatex,
      rehypeSlug,
      [
        rehypeAutolinkHeadings,
        { behavior: 'append', properties: { className: ['heading-anchor'], ariaHidden: true } },
      ],
    ],
    shikiConfig: { theme: 'github-dark-dimmed', wrap: true },
  },
  vite: {
    // 让 Vite 允许读取仓库外的目录（Obsidian vault 同步进来时路径可能偏出 worktree）
    server: { fs: { strict: false } },
  },
});