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
import { pathToFileURL } from 'node:url';
import fg from 'fast-glob';
import matter from 'gray-matter';

const ROOT = process.cwd();
const DRY = process.argv.includes('--dry');
const PRUNE = process.argv.includes('--prune');
const PRUNE_DELETE = process.argv.includes('--delete');
const VAULT = process.env.VAULT;

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

export function transformWikilinks(md, knownTitles, logger) {
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
// Prune 阶段（Wave 7 T-23）：清理 public/attachments/ 中「本次 vault 白名单同步
// 未引用」的残留附件。默认 dry-run 只报告；--prune --delete 才真删。
// 安全红线：
//   a) 只处理 public/attachments/ 目录内的普通文件：词法前缀（防 .. 逃逸）+
//      realpath 双重校验，任一不过即跳过；
//   b) 引用集合以「本次 collectFiles 收集、白名单内、可发布的笔记中 ![[...]]
//      附件嵌入且源文件存在」为准 —— 同步刚复制的文件必在集合内，绝不列入孤儿；
//   c) main() 的 VAULT 前置检查保证无 VAULT 时根本不会进入本阶段；另加
//      「白名单扫描 0 文件时拒绝删除」保险，防 VAULT 指错目录误删全部附件；
//   d) 符号链接 / junction 一律跳过不删；删除清单逐文件打印（文件名 + 字节数）。
// 注意：此处独立推导 syncOne 的附件提取口径（syncOne 逻辑不得改动）；若日后
// 修改 syncOne 的附件规则（扩展名 / 文件名规整），需同步更新 collectReferencedAttachments。

/** 推导「本次同步会写入 public/attachments/ 的文件名集合」（口径对齐 syncOne 附件段） */
async function collectReferencedAttachments(files) {
  const referenced = new Set();
  for (const file of files) {
    const rel = path.relative(VAULT, file);
    const parts = rel.split(path.sep);
    if (!ROOT_WHITELIST.includes(parts[0])) continue;
    let raw;
    try {
      raw = await fs.readFile(file, 'utf8');
    } catch {
      continue; // 读不到 → 同步阶段同样会失败，不算引用
    }
    const parsed = matter(raw);
    if (parsed.data.publish === false || parsed.data.draft === true) continue;

    const embedRe = /!\[\[([^\]\n]+?)\]\]/g;
    for (let m; (m = embedRe.exec(parsed.content)) !== null; ) {
      const targetRaw = m[1].split('|')[0].trim();
      const ext = targetRaw.split('.').pop().toLowerCase();
      if (!IMAGE_EXT.has(ext) && !FILE_EXT.has(ext)) continue;
      const fname = targetRaw.replace(/[\\/]/g, '_');
      const srcPath = path.resolve(path.dirname(file), targetRaw);
      try {
        await fs.access(srcPath);
      } catch {
        continue; // 源缺失 → syncOne 会告警跳过，不算引用
      }
      referenced.add(fname);
    }
  }
  return referenced;
}

async function pruneAttachments(files) {
  const attachDir = path.resolve(ROOT, 'public', 'attachments');
  const referenced = await collectReferencedAttachments(files);

  const deletion = PRUNE_DELETE && !DRY; // --dry 恒定压制删除
  if (deletion && STATS.scanned === 0) {
    console.log('▸ Prune : ⚠ 白名单扫描 0 个文件，疑似 VAULT 指错目录，已拒绝删除');
    return;
  }

  const norm = (p) => (process.platform === 'win32' ? p.toLowerCase() : p);
  let realBase = null;
  try {
    realBase = await fs.realpath(attachDir);
  } catch {
    /* attachments 目录不存在 → 无可清理 */
  }

  const candidates = [];
  let unsafe = 0;
  const walk = async (dir) => {
    let entries;
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      const abs = path.resolve(dir, e.name);
      if (e.isSymbolicLink() || (!e.isFile() && !e.isDirectory())) {
        unsafe++;
        continue; // 符号链接 / 特殊文件绝不删
      }
      if (e.isDirectory()) {
        await walk(abs);
        continue;
      }
      if (!abs.startsWith(attachDir + path.sep)) {
        unsafe++;
        continue; // 红线 a：词法前缀（防 .. 逃逸）
      }
      let ok = realBase !== null;
      if (ok) {
        try {
          ok = norm(await fs.realpath(abs)).startsWith(norm(realBase + path.sep));
        } catch {
          ok = false;
        }
      }
      if (!ok) {
        unsafe++;
        continue; // 红线 d：真实路径越界（junction 穿透等）
      }
      candidates.push(abs);
    }
  };
  await walk(attachDir);

  const orphans = candidates.filter((p) => !referenced.has(path.basename(p))).sort();
  if (orphans.length === 0) {
    const suffix = unsafe > 0 ? ` · 跳过不安全路径 ${unsafe}` : '';
    console.log(`▸ Prune : 孤儿附件 0 个${suffix} · 无需清理`);
    return;
  }

  const sizes = [];
  let totalBytes = 0;
  for (const p of orphans) {
    let size = 0;
    try {
      size = (await fs.stat(p)).size;
    } catch {
      /* 文件恰好消失 → 按 0 计 */
    }
    sizes.push(size);
    totalBytes += size;
  }

  if (!deletion) {
    const note = PRUNE_DELETE ? '（--dry 生效，未删除）' : '（dry-run 未删除，加 --delete 执行真删）';
    console.log(`▸ Prune : 发现孤儿附件 ${orphans.length} 个 · 共 ${totalBytes} 字节${note}`);
    for (let i = 0; i < orphans.length; i++) {
      console.log(`  · ${path.basename(orphans[i])} (${sizes[i]} 字节)`);
    }
    if (unsafe > 0) console.log(`▸ Prune : 跳过不安全路径 ${unsafe} 个（符号链接/越界，绝不删除）`);
    return;
  }

  console.log(`▸ Prune : 删除孤儿附件 ${orphans.length} 个 · 共 ${totalBytes} 字节`);
  for (let i = 0; i < orphans.length; i++) {
    const name = path.basename(orphans[i]);
    try {
      await fs.rm(orphans[i], { force: true });
      console.log(`  ✓ 已删 ${name} (${sizes[i]} 字节)`);
    } catch (err) {
      console.warn(`  ⚠ 删除失败 ${name}: ${err?.message ?? err}`);
    }
  }
  if (unsafe > 0) console.log(`▸ Prune : 跳过不安全路径 ${unsafe} 个（符号链接/越界，绝不删除）`);
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
  // VAULT 检查原来在模块顶层：顶层 exit(1) 会连带杀死任何 import 本模块的进程
  // （vitest 表征测试 / 复用方无法安全 import）。移入 main 后 CLI 行为不变、import 零副作用。
  if (!VAULT) {
    console.error('✘ 请设置环境变量 VAULT 指向你的 Obsidian 库根目录');
    console.error('   示例：VAULT=/d/Notes npm run sync');
    process.exit(1);
  }
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

  // T-23：同步完成后执行 prune 阶段（默认 dry-run 只报告，--prune --delete 才真删）
  if (PRUNE) await pruneAttachments(files);
}

// CLI entry guard：仅当本文件被直接执行（node scripts/sync-obsidian.mjs）时才运行 main()；
// 被 import（vitest 表征测试 / T-05 子进程复用）时不触发任何同步副作用。
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}