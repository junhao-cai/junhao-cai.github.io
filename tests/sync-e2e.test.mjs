/**
 * tests/sync-e2e.test.mjs
 * ---------------------------------------------------------------------------
 * scripts/sync-obsidian.mjs 的端到端表征测试（characterization，Wave 1 T-05）。
 *
 * 单元测试 tests/sync-wikilinks.test.mjs 只覆盖 transformWikilinks 纯函数；
 * 这里用 node:child_process 真实执行 CLI（VAULT=临时 fixture，cwd=仓库根），
 * 锁死单元测试够不到的同步副作用：
 *   - 白名单过滤（Posts/Pages 之外整体忽略）
 *   - publish:false / draft:true 跳过（无 publish 字段的笔记仍同步 —— 现状）
 *   - wikilink 改写落盘（按文件 basename 小写解析，非 frontmatter title；
 *     含跨目录 /posts/slug 与 /pages/slug/ 的 URL 差异；死链警告走 stderr）
 *   - 附件 ![[...]] 复制到 public/attachments/
 *   - 死链降级为 `title`{class="internal-link is-unresolved" data-wikilink=...}
 *   - 畸形链接 [[unclosed 原样保留
 *   - dry-run 零写入；STATS 统计行
 *
 * 关键约束：脚本 ROOT = process.cwd()（sync-obsidian.mjs:43），产物会短暂写入
 * 真实仓库的 src/content/{posts,pages}/ 与 public/attachments/。测试以
 * try/catch/finally 按 fixture 派生路径逐个清理，并以 git status --short
 * 前后快照逐行相等作为「工作区零残留」的硬断言；afterAll 兜底二次清扫。
 */

import { describe, it, expect, afterAll } from 'vitest';
import { spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  rmdirSync,
  writeFileSync,
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..');
const SCRIPT = path.join(REPO_ROOT, 'scripts', 'sync-obsidian.mjs');
const POSTS_DIR = path.join(REPO_ROOT, 'src', 'content', 'posts');
const PAGES_DIR = path.join(REPO_ROOT, 'src', 'content', 'pages');
const ATTACH_DIR = path.join(REPO_ROOT, 'public', 'attachments');
const SPAWN_TIMEOUT = 60_000;

// ---- 观测工具 -----------------------------------------------------------

/** 递归列出目录下所有文件（相对正斜杠路径，排序）；目录不存在返回 null */
function listFiles(dir) {
  if (!existsSync(dir)) return null;
  const out = [];
  const walk = (d) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else out.push(path.relative(dir, p).split(path.sep).join('/'));
    }
  };
  walk(dir);
  return out.sort();
}

function gitStatusShort() {
  const r = spawnSync('git', ['status', '--short'], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    timeout: SPAWN_TIMEOUT,
  });
  if (r.status !== 0) throw new Error(`git status --short 失败: ${r.stderr || r.stdout}`);
  return r.stdout
    .split('\n')
    .map((l) => l.replace(/\r$/, ''))
    .filter((l) => l.length > 0);
}

/** 真实执行同步脚本（子进程），VAULT 指向 fixture */
function runSync(vaultDir, { dry = false } = {}) {
  const args = [SCRIPT];
  if (dry) args.push('--dry');
  return spawnSync(process.execPath, args, {
    cwd: REPO_ROOT, // 脚本 ROOT = process.cwd()，必须在仓库根执行
    env: { ...process.env, VAULT: vaultDir },
    encoding: 'utf8',
    timeout: SPAWN_TIMEOUT,
  });
}

// ---- fixture ------------------------------------------------------------

const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]); // 假 PNG 头

function writeVaultFile(vault, rel, content) {
  const abs = path.join(vault, ...rel.split('/'));
  mkdirSync(path.dirname(abs), { recursive: true });
  writeFileSync(abs, content, 'utf8');
}

/**
 * 最小 Obsidian vault（命名全部带 e2e- 前缀，避免撞真实仓库文件）：
 *   Posts/e2e-a-note.md       发布；含 [[e2e-b-note]]、[[e2e-page]]（跨目录）、
 *                             ![[e2e-pic.png]] 附件、[[Missing Title]] 死链、[[unclosed 畸形链接
 *   Posts/e2e-b-note.md       发布（wikilink 目标）
 *   Posts/e2e-hidden-note.md  publish: false → 跳过
 *   Posts/e2e-draft-note.md   draft: true → 跳过
 *   Posts/e2e-pic.png         附件本体（8 字节假 PNG 头）
 *   Pages/e2e-page.md         发布（Pages 白名单）
 *   Journal/e2e-journal.md    白名单外 → 整体忽略
 */
function makeFixture() {
  const vault = mkdtempSync(path.join(os.tmpdir(), 'sync-e2e-vault-'));
  writeVaultFile(
    vault,
    'Posts/e2e-a-note.md',
    [
      '---',
      'title: E2E A Note',
      'publish: true',
      'tags: research/e2e',
      '---',
      '',
      'Link to sibling: [[e2e-b-note]] and cross collection [[e2e-page]].',
      '',
      'Embed: ![[e2e-pic.png]]',
      '',
      'Dead: [[Missing Title]]',
      '',
      'Malformed: [[unclosed stays',
      '',
    ].join('\n'),
  );
  writeVaultFile(
    vault,
    'Posts/e2e-b-note.md',
    '---\ntitle: E2E B Note\npublish: true\n---\n\nBody of B.\n',
  );
  writeVaultFile(
    vault,
    'Posts/e2e-hidden-note.md',
    '---\ntitle: E2E Hidden\npublish: false\n---\n\nShould not sync.\n',
  );
  writeVaultFile(
    vault,
    'Posts/e2e-draft-note.md',
    '---\ntitle: E2E Draft\ndraft: true\n---\n\nShould not sync.\n',
  );
  writeVaultFile(
    vault,
    'Pages/e2e-page.md',
    '---\ntitle: E2E Page\npublish: true\n---\n\nA fixture page.\n',
  );
  writeVaultFile(
    vault,
    'Journal/e2e-journal.md',
    '---\ntitle: E2E Journal\npublish: true\n---\n\nOutside whitelist, must be ignored.\n',
  );
  const picAbs = path.join(vault, 'Posts', 'e2e-pic.png');
  mkdirSync(path.dirname(picAbs), { recursive: true });
  writeFileSync(picAbs, PNG_MAGIC);
  return vault;
}

// ---- 清理工具 -----------------------------------------------------------

/** 删除 dir 中所有「快照之前不存在」的文件；若 dir 是本次新建且已空则删目录 */
function removeFilesNotIn(before, dir) {
  const beforeSet = new Set(before ?? []);
  for (const rel of listFiles(dir) ?? []) {
    if (!beforeSet.has(rel)) rmSync(path.join(dir, ...rel.split('/')), { force: true });
  }
  if (before === null && existsSync(dir) && (listFiles(dir) ?? []).length === 0) {
    rmdirSync(dir);
  }
}

// ---- 测试 ---------------------------------------------------------------

const GIT_BEFORE = gitStatusShort(); // 动手前快照（模块加载期，先于任何写入）
const POSTS_BEFORE = listFiles(POSTS_DIR); // 预期 null 或空（现状：零文件）
const PAGES_BEFORE = listFiles(PAGES_DIR); // 预期 ['about.md', 'en/about.md']
const ATTACH_BEFORE = listFiles(ATTACH_DIR); // 预期 null（public/attachments 不存在）

/** 所有 fixture 派生产物的落点（真跑断言用 + afterAll 兜底清扫用） */
const derivedPosts = ['e2e-a-note.md', 'e2e-b-note.md'];
const derivedPages = ['e2e-page.md'];
const derivedAttach = ['e2e-pic.png'];

function sweepDerivedFiles() {
  for (const name of derivedPosts) {
    if (existsSync(path.join(POSTS_DIR, name))) rmSync(path.join(POSTS_DIR, name));
  }
  for (const name of derivedPages) {
    if (existsSync(path.join(PAGES_DIR, name))) rmSync(path.join(PAGES_DIR, name));
  }
  for (const name of derivedAttach) {
    if (existsSync(path.join(ATTACH_DIR, name))) rmSync(path.join(ATTACH_DIR, name));
  }
  // 目录若为本次运行新建且已空，删除目录本身
  if (ATTACH_BEFORE === null && existsSync(ATTACH_DIR) && (listFiles(ATTACH_DIR) ?? []).length === 0) {
    rmdirSync(ATTACH_DIR);
  }
}

describe('sync-obsidian 端到端表征（临时 vault + 子进程真实执行）', () => {
  it(
    'dry-run 零写入 → 真跑断言产物（两次真跑幂等）→ finally 清理 → git status 还原等价',
    { timeout: 120_000 },
    () => {
      const vault = makeFixture();
      let bodyError = null;
      let statusAfter = null;
      try {
        // ========== dry-run：零写入 ==========
        const dry = runSync(vault, { dry: true });
        expect(dry.status).toBe(0);
        // 现状：死链警告经 console.warn 落到 stderr（非 stdout、非致命）
        expect(dry.stderr).toContain('↪ 死链：[[Missing Title]]');
        expect(dry.stderr).not.toContain('e2e-b-note'); // 有效链接不告警
        expect(dry.stdout).toContain('dry-run'); // ▸ Mode  : dry-run
        // src/content 与 public/attachments 零新增
        expect(listFiles(POSTS_DIR) ?? []).toEqual(POSTS_BEFORE ?? []);
        expect(listFiles(PAGES_DIR) ?? []).toEqual(PAGES_BEFORE ?? []);
        expect(listFiles(ATTACH_DIR)).toEqual(ATTACH_BEFORE); // null === null：附件目录未创建
        // dry-run 也照常打印统计（被测现状），但不落盘
        expect(dry.stdout).toContain('同步 3 · 跳过 3 · 附件 1 · 死链 1');

        // ========== 真跑（第 1 次）==========
        const r1 = runSync(vault);
        expect(r1.status).toBe(0);
        expect(r1.stderr).toContain('↪ 死链：[[Missing Title]]');
        expect(r1.stdout).toContain('Mode  : write');
        // 现状：scanned 统计所有白名单内文件（含被 publish/draft 跳过者），Journal 不计入
        expect(r1.stdout).toContain('扫描 5 · 同步 3 · 跳过 3 · 附件 1 · 死链 1');

        // --- 白名单：Posts 两个可发布笔记落到 src/content/posts/（slugify 文件名）---
        const postsAfter = listFiles(POSTS_DIR) ?? [];
        expect(postsAfter.filter((f) => f.startsWith('e2e-'))).toEqual(derivedPosts);

        // --- Pages 落到 src/content/pages/ ---
        const pagesAfter = listFiles(PAGES_DIR) ?? [];
        expect(pagesAfter.filter((f) => f.startsWith('e2e-'))).toEqual(derivedPages);

        // --- wikilink 改写落盘 ---
        const aOut = readFileSync(path.join(POSTS_DIR, 'e2e-a-note.md'), 'utf8');
        // 同目录笔记：按 basename 解析，/posts/<slug>（无尾斜杠，slugify 去掉 .md）
        expect(aOut).toContain('[e2e-b-note](/posts/e2e-b-note)');
        // 跨白名单目录（Pages）：/pages/<slug>/（带尾斜杠 —— buildIndex 现状）
        expect(aOut).toContain('[e2e-page](/pages/e2e-page/)');
        // 死链降级：行内代码 + is-unresolved 标记，保留原目标
        expect(aOut).toContain(
          '`Missing Title`{class="internal-link is-unresolved" data-wikilink="Missing Title"}',
        );
        // 畸形链接（无闭合 ]]）原样保留
        expect(aOut).toContain('Malformed: [[unclosed stays');

        // --- frontmatter 规范化落盘（gray-matter stringify）---
        expect(aOut.startsWith('---')).toBe(true);
        expect(aOut).toContain('title: E2E A Note'); // 原 title 保留
        expect(aOut).toContain('tags:\n  - research/e2e'); // 字符串 tags 展开为数组

        // --- 附件 ![[...]] 复制 ---
        expect(listFiles(ATTACH_DIR)).toEqual([...(ATTACH_BEFORE ?? []), ...derivedAttach].sort());
        expect(readFileSync(path.join(ATTACH_DIR, 'e2e-pic.png'))).toEqual(PNG_MAGIC);
        expect(aOut).toContain('![e2e-pic.png](/attachments/e2e-pic.png)');

        // --- publish:false / draft / 白名单外：缺失 ---
        expect(existsSync(path.join(POSTS_DIR, 'e2e-hidden-note.md'))).toBe(false);
        expect(existsSync(path.join(POSTS_DIR, 'e2e-draft-note.md'))).toBe(false);
        expect(aOut).not.toContain('Should not sync');
        // Journal/ 内容不出现在 posts 也不出现在 pages
        for (const dir of [POSTS_DIR, PAGES_DIR]) {
          for (const rel of listFiles(dir) ?? []) {
            expect(rel).not.toContain('e2e-journal');
          }
        }

        // ========== 真跑（第 2 次）：fixture 唯一命名 + 确定性路径 → 幂等，无残留累积 ==========
        const r2 = runSync(vault);
        expect(r2.status).toBe(0);
        expect((listFiles(POSTS_DIR) ?? []).filter((f) => f.startsWith('e2e-'))).toEqual(derivedPosts);
        expect(readFileSync(path.join(POSTS_DIR, 'e2e-b-note.md'), 'utf8')).toContain('Body of B.');
      } catch (e) {
        bodyError = e;
      } finally {
        // ========== 清理（即使断言失败也必须走到）==========
        try {
          sweepDerivedFiles();
          removeFilesNotIn(POSTS_BEFORE, POSTS_DIR);
          removeFilesNotIn(PAGES_BEFORE, PAGES_DIR);
          removeFilesNotIn(ATTACH_BEFORE, ATTACH_DIR);
        } finally {
          rmSync(vault, { recursive: true, force: true }); // fixture 临时目录必删
          statusAfter = gitStatusShort();
        }
      }

      // ========== 工作区零残留：前后快照逐行相等（硬断言）==========
      if (bodyError) {
        const residue = statusAfter.filter((l) => !GIT_BEFORE.includes(l));
        if (residue.length > 0) {
          const wrapped = new Error(
            `测试体失败且清理后工作区仍有残留：\n${residue.join('\n')}`,
            { cause: bodyError },
          );
          throw wrapped;
        }
        throw bodyError;
      }
      expect(statusAfter).toEqual(GIT_BEFORE);
    },
  );

  afterAll(() => {
    // 双保险兜底：若任何异常路径逃过 finally，这里再扫一次并报警
    sweepDerivedFiles();
    removeFilesNotIn(POSTS_BEFORE, POSTS_DIR);
    removeFilesNotIn(PAGES_BEFORE, PAGES_DIR);
    removeFilesNotIn(ATTACH_BEFORE, ATTACH_DIR);
    expect(gitStatusShort()).toEqual(GIT_BEFORE);
  });
});
