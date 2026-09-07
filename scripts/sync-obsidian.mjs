#!/usr/bin/env node
/**
 * sync-obsidian.mjs
 * ---------------------------------------------------------------------------
 * 把独立的 Obsidian vault 按白名单过滤后同步进 src/content/posts/ 与
 * src/content/pages/，同时把 Obsidian 特有语法降级成标准 Markdown，让
 * Astro 的默认 remark 插件能正确渲染。
 *
 * 用法（在仓库根目录执行）：
 *
 *   VAULT=/path/to/Obsidian/Vault npm run sync         # 真实同步
 *   VAULT=/path/to/Obsidian/Vault npm run sync:dry     # 预览，不写文件
 *
 * 白名单规则：
 *   - 文章正文 frontmatter 中 publish: true 才会被同步；其他文件即使在
 *     VAULT 下也会被跳过。
 *   - 未在 sync.roots 白名单内的目录会被整体忽略（默认仅扫描 /Posts 和
 *     /Pages，可改下方 ROOT_WHITELIST）。
 *
 * 跨文件逻辑（只能在同步阶段做的事）：
 *   - 解析 wikilink [[目标|别名]]：
 *       · 目标位于白名单内 → 转成 /posts/<slug>/ 或 /tags/<slug>/
 *       · 目标含 #heading → 拼上 #heading
 *       · 目标不在白名单 → 警告日志，链接退化为锚点（页面顶部会显示 unresolved）
 *   - 把附件 ![[image.png]] / ![[file.pdf]] 复制到 public/attachments/，
 *     并把链接替换成对应路径。
 *   - 把嵌套标签 research/nlp 展成 ['research/nlp']（保持原样，构建层
 *     已支持层级）。
 *
 * 不处理的语法（交给 src/lib/remark-obsidian.mjs 渲染时处理）：
 *   - callout > [!note]
 *   - 高亮 ==...==
 *   - 注释 %%...%%
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import fg from 'fast-glob';
import matter from 'gray-matter';

const ROOT = process.cwd();
const DRY = process.argv.includes('--dry');
const VAULT = process.env.VAULT;
if (!VAULT) {
  console.error('✘ 请设置环境变量 VAULT 指向你的 Obsidian 库根目录');
  console.error('   示例：VAULT=/d/Notes npm run sync');
  process.exit(1);
}

/** 仓库相对路径集合：只同步这里列出的目录下的笔记 */
const ROOT_WHITELIST = (process.env.ROOTS ?? 'Posts,Pages')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

/** 附件支持的后缀；非图片统一复制到 public/attachments/ */
const IMAGE_EXT = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'avif']);
const FILE_EXT = new Set(['pdf', 'md', 'canvas']);

const STATS = { scanned: 0, synced: 0, skipped: 0, attachments: 0, deadLinks: 0 };

// ---------------------------------------------------------------------------

async function ensureDir(p) {
  await fs.mkdir(p, { recursive: true });
}

function slugify(name) {
  return name
    .replace(/\.md$/i, '')
    .replace(/[\\/]/g, '-')
    .trim();
}

async function collectFiles() {
  const result = await fg(['**/*.md'], {
    cwd: VAULT,
    absolute: true,
    onlyFiles: true,
    dot: false,
    ignore: ['**/.obsidian/**', '**/.trash/**'],
  });
  return result;
}

// ---------------------------------------------------------------------------

function transformWikilinks(md, knownTitles, logger) {
  return md.replace(/(^|[^!])\[\[([^\]\n]+?)\]\]/g, (_full, lead, body) => {
    const [rawTarget, label] = body.split('|');
    const [noteName, heading] = rawTarget.split('#');
    const display = (label || noteName).trim();

    // 匹配大小写无关、忽略标点
    const key = noteName.trim().toLowerCase();
    const hit = knownTitles.get(key);

    if (!hit) {
      STATS.deadLinks++;
      logger?.warn(`  ↪ 死链：[[${rawTarget}]]`);
      return `${lead}\`${display}\`{class="internal-link is-unresolved" data-wikilink="${rawTarget}"}`;
    }

    const href = heading ? `${hit.url}#${encodeURIComponent(heading)}` : hit.url;
    return `${lead}[${display}](${href})`;
  });
}

// ---------------------------------------------------------------------------

async function syncOne(file, knownTitles) {
  const rel = path.relative(VAULT, file);
  const parts = rel.split(path.sep);
  if (!ROOT_WHITELIST.includes(parts[0])) {
    STATS.skipped++;
    return;
  }

  STATS.scanned++;
  const raw = await fs.readFile(file, 'utf8');
  const parsed = matter(raw);

  if (parsed.data.publish === false || parsed.data.draft === true) {
    console.log(`⊘ ${rel} · publish:false / draft`);
    STATS.skipped++;
    return;
  }

  // 规范化 frontmatter
  const fm = { ...parsed.data };
  if (fm.tags) {
    fm.tags = Array.isArray(fm.tags)
      ? fm.tags
      : String(fm.tags)
          .split(/[,，]/)
          .map((s) => s.trim())
          .filter(Boolean);
  }
  if (!fm.title) fm.title = path.basename(file, '.md');

  // 提取附件 → 复制到 public/attachments/
  let body = parsed.content;
  const embedRe = /!\[\[([^\]\n]+?)\]\]/g;
  const embeds = [];
  for (let m; (m = embedRe.exec(body)) !== null; ) embeds.push({ index: m.index, length: m[0].length, target: m[1] });
  for (const e of embeds.reverse()) {
    const targetRaw = e.target.split('|')[0].trim();
    const ext = targetRaw.split('.').pop().toLowerCase();
    const fname = targetRaw.replace(/[\\/]/g, '_');
    const isImage = IMAGE_EXT.has(ext);
    const isFile = isImage || FILE_EXT.has(ext);
    if (!isFile) {
      body = body.slice(0, e.index) + body.slice(e.index + e.length);
      continue;
    }
    const srcPath = path.resolve(path.dirname(file), targetRaw);
    try {
      await fs.access(srcPath);
      const dest = path.join(ROOT, 'public', 'attachments', fname);
      if (!DRY) await ensureDir(path.dirname(dest)).then(() => fs.copyFile(srcPath, dest));
      const url = `/attachments/${fname}`;
      const md = isImage ? `![${fname}](${url})` : `[${fname}](${url})`;
      body = body.slice(0, e.index) + md + body.slice(e.index + e.length);
      STATS.attachments++;
    } catch {
      console.warn(`  ⚠ 附件缺失：${targetRaw}`);
      body = body.slice(0, e.index) + body.slice(e.index + e.length);
    }
  }

  // 转换 wikilink
  body = transformWikilinks(body, knownTitles, console);

  // 同步路径映射：vault/Posts/xxx.md → src/content/posts/xxx.md
  const subdir = parts[0].toLowerCase();
  const targetDir =
    subdir === 'posts' ? path.join(ROOT, 'src/content/posts') : path.join(ROOT, 'src/content/pages');

  const base = slugify(path.basename(file));
  const destRel = [...parts.slice(1, -1), `${base}.md`].filter(Boolean).join('/');
  const destAbs = path.join(targetDir, destRel);

  if (!DRY) {
    await ensureDir(path.dirname(destAbs));
    const out = matter.stringify(body, fm);
    await fs.writeFile(destAbs, out, 'utf8');
  }
  console.log(`✓ ${rel} → ${path.relative(ROOT, destAbs)}`);
  STATS.synced++;
}

// ---------------------------------------------------------------------------

async function buildIndex() {
  const files = await collectFiles();
  const titles = new Map(); // lower-case title → { url }
  for (const f of files) {
    const rel = path.relative(VAULT, f);
    const parts = rel.split(path.sep);
    if (!ROOT_WHITELIST.includes(parts[0])) continue;
    const name = path.basename(f, '.md').toLowerCase();
    const subdir = parts[0].toLowerCase();
    const url =
      subdir === 'posts'
        ? `/posts/${slugify(path.relative(path.join(VAULT, parts[0]), f))}`
        : `/pages/${slugify(path.relative(path.join(VAULT, parts[0]), f))}/`;
    titles.set(name, { url });
  }
  return titles;
}

async function main() {
  console.log(`▸ Vault : ${VAULT}`);
  console.log(`▸ Roots : ${ROOT_WHITELIST.join(', ')}`);
  console.log(`▸ Mode  : ${DRY ? 'dry-run' : 'write'}`);
  console.log('');

  const files = await collectFiles();
  const index = await buildIndex();
  console.log(`▸ Found ${files.length} candidate files, ${index.size} resolvable titles\n`);

  for (const f of files) await syncOne(f, index);

  console.log('\n────────');
  console.log(
    `扫描 ${STATS.scanned} · 同步 ${STATS.synced} · 跳过 ${STATS.skipped} · 附件 ${STATS.attachments} · 死链 ${STATS.deadLinks}`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});