/**
 * tests/sync-prune.test.mjs
 * ---------------------------------------------------------------------------
 * scripts/sync-obsidian.mjs --prune（附件残留清理）的端到端测试（Wave 7 T-23）。
 *
 * 被测契约（D5 安全默认）：
 *   - --prune           默认 dry-run：只列出 public/attachments/ 中「本次 vault
 *                       白名单同步未引用」的孤儿附件，绝不删除；
 *   - --prune --delete  才真删；--dry 与 --prune --delete 同给时 --dry 恒定压制删除；
 *   - 安全红线：无 VAULT 直接报错退出（不进 prune）；只删 public/attachments/
 *     目录内、词法前缀 + realpath 双重校验通过的普通文件；符号链接 / junction
 *     与越界路径绝不删除；本次同步刚复制的附件绝不列入孤儿。
 *
 * fixture 方法对齐 tests/sync-e2e.test.mjs（spawnSync 真实执行 CLI + try/finally
 * 清理），但有一个关键差异：cwd 指向临时「沙箱伪仓库」而非真实仓库根。
 * 原因：脚本契约 ROOT = process.cwd()（sync-obsidian.mjs:43），沙箱 cwd 让同步
 * 产物与 prune 扫描全部落在临时目录 —— ① 零真实仓库写入；② 不与 vitest 跨文件
 * 并行执行的 sync-e2e（对真实 public/attachments/ 做精确相等断言）竞态。
 * 真实仓库仍以 git status --short 前后快照逐行相等作硬断言兜底。
 */

import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..');
const SCRIPT = path.join(REPO_ROOT, 'scripts', 'sync-obsidian.mjs');
const SPAWN_TIMEOUT = 60_000;
const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]); // 假 PNG 头

// ---- 真实仓库零写入：沙箱隔离保证，不做全局 git 零残留兜底 -----------------
// 本文件所有 fixture 与脚本执行都在 os.tmpdir() 沙箱（cwd=沙箱）下进行，脚本契约
// ROOT = process.cwd()（sync-obsidian.mjs:43），产物 / prune 扫描全部落在临时目录，
// 真实仓库（src/content/{posts,pages}/、public/attachments）零写入。
// 故此处不做全局 `git status --short` 零残留断言——该断言会与并行运行的
// sync-e2e.test.mjs（合法写入真实仓库并在 finally/afterAll 清理）竞态，导致非确定性失败；
// 真实仓库零残留由 sync-e2e 自带断言覆盖（tests/sync-e2e.test.mjs）。


// ---- fixture ---------------------------------------------------------------

function makeSandbox() {
  // 沙箱伪仓库：cwd 放这里，脚本 ROOT/attachments/src 全部落沙箱
  const root = mkdtempSync(path.join(os.tmpdir(), 'sync-prune-repo-'));
  mkdirSync(path.join(root, 'public', 'attachments'), { recursive: true });
  return root;
}

function makeVault() {
  return mkdtempSync(path.join(os.tmpdir(), 'sync-prune-vault-'));
}

function writeVaultFile(vault, rel, content) {
  const abs = path.join(vault, ...rel.split('/'));
  mkdirSync(path.dirname(abs), { recursive: true });
  writeFileSync(abs, content, 'utf8');
}

function writeSandboxFile(sandbox, rel, content) {
  const abs = path.join(sandbox, ...rel.split('/'));
  mkdirSync(path.dirname(abs), { recursive: true });
  writeFileSync(abs, content);
}

function attachPath(sandbox, name) {
  return path.join(sandbox, 'public', 'attachments', ...name.split('/'));
}

/** 引用两张附件的 vault 笔记（一张 ASCII 名、一张空格+中文+.. 畸形名） */
function noteReferencingPics() {
  return [
    '---',
    'title: Prune Note',
    'publish: true',
    '---',
    '',
    'Embeds: ![[prune-pic.png]] and ![[prune 图片 中文.png]]',
    '',
  ].join('\n');
}

/** 建 vault：1 篇发布笔记引用 2 张附件 + 附件本体 */
function makeVaultWithReferencedPics() {
  const vault = makeVault();
  writeVaultFile(vault, 'Posts/prune-note.md', noteReferencingPics());
  writeFileSync(path.join(vault, 'Posts', 'prune-pic.png'), PNG_MAGIC);
  writeFileSync(path.join(vault, 'Posts', 'prune 图片 中文.png'), Buffer.from('cjk-pic-bytes'));
  return vault;
}

/** 真实执行脚本（子进程），cwd=沙箱伪仓库，VAULT=vault fixture */
function runScript(sandbox, vault, args, { noVault = false } = {}) {
  return spawnSync(process.execPath, [SCRIPT, ...args], {
    cwd: sandbox,
    env: { ...process.env, VAULT: noVault ? '' : vault },
    encoding: 'utf8',
    timeout: SPAWN_TIMEOUT,
  });
}

/** 预置孤儿附件（fixture 前置写入沙箱，随沙箱一起清理，不碰真实仓库） */
function seedOrphan(sandbox, name, bytes = 'orphan-bytes') {
  writeSandboxFile(sandbox, `public/attachments/${name}`, bytes);
  return attachPath(sandbox, name);
}

function cleanup(sandbox, vault, extraDirs = []) {
  for (const dir of [sandbox, vault, ...extraDirs]) {
    if (dir && existsSync(dir)) rmSync(dir, { recursive: true, force: true });
  }
}

// 符号链接/junction 能力探测（Windows junction 免管理员；POSIX symlink 常规可用）
const CAN_SYMLINK = (() => {
  try {
    const target = mkdtempSync(path.join(os.tmpdir(), 'sync-prune-sl-t-'));
    const link = path.join(os.tmpdir(), `sync-prune-sl-l-${process.pid}-${Date.now()}`);
    symlinkSync(target, link, process.platform === 'win32' ? 'junction' : 'dir');
    rmSync(link, { force: true });
    rmSync(target, { recursive: true, force: true });
    return true;
  } catch {
    return false;
  }
})();

// ---- 测试 -------------------------------------------------------------------

describe('sync-obsidian --prune 附件残留清理（沙箱伪仓库 + 子进程真实执行）', () => {
  it(
    '--prune 默认 dry-run：孤儿被列出但内容/mtime 不变，被引用附件不误删',
    () => {
      const sandbox = makeSandbox();
      const vault = makeVaultWithReferencedPics();
      const orphanAbs = seedOrphan(sandbox, 'prune-orphan.png');
      const orphanBytes = readFileSync(orphanAbs);
      const orphanMtime = statSync(orphanAbs).mtimeMs;
      try {
        const r = runScript(sandbox, vault, ['--prune']);
        expect(r.status).toBe(0);
        // 孤儿被逐文件列出（文件名 + 字节数）
        expect(r.stdout).toContain('prune-orphan.png');
        expect(r.stdout).toContain('孤儿附件 1 个');
        expect(r.stdout).toContain('未删除');
        // misleading-success 防护：文件真实存在 + 字节一致 + mtime 未被触碰
        expect(existsSync(orphanAbs)).toBe(true);
        expect(readFileSync(orphanAbs).equals(orphanBytes)).toBe(true);
        expect(statSync(orphanAbs).mtimeMs).toBe(orphanMtime);
        // 被引用附件不误删（本次同步刚复制的）
        expect(existsSync(attachPath(sandbox, 'prune-pic.png'))).toBe(true);
        expect(existsSync(attachPath(sandbox, 'prune 图片 中文.png'))).toBe(true);
      } finally {
        cleanup(sandbox, vault);
      }
    },
  );

  it(
    '--prune --delete：孤儿被删（含空格/中文/.. 畸形名），被引用附件保留',
    () => {
      const sandbox = makeSandbox();
      const vault = makeVaultWithReferencedPics();
      const orphanAbs = seedOrphan(sandbox, 'prune-orphan.png');
      const weirdOrphanAbs = seedOrphan(sandbox, 'prune 孤儿..备 份.png', 'weird');
      try {
        const r = runScript(sandbox, vault, ['--prune', '--delete']);
        expect(r.status).toBe(0);
        expect(r.stdout).toContain('删除孤儿附件 2 个');
        // 删除清单逐文件打印（文件名 + 字节数）
        expect(r.stdout).toContain('✓ 已删 prune-orphan.png');
        expect(r.stdout).toContain('✓ 已删 prune 孤儿..备 份.png');
        // 孤儿真没了
        expect(existsSync(orphanAbs)).toBe(false);
        expect(existsSync(weirdOrphanAbs)).toBe(false);
        // 被引用附件（本次同步刚复制）绝不列入删除
        expect(existsSync(attachPath(sandbox, 'prune-pic.png'))).toBe(true);
        expect(existsSync(attachPath(sandbox, 'prune 图片 中文.png'))).toBe(true);
      } finally {
        cleanup(sandbox, vault);
      }
    },
  );

  it(
    '无新参数：行为与改前一致 —— 无任何 prune 输出行，孤儿分毫不动',
    () => {
      const sandbox = makeSandbox();
      const vault = makeVaultWithReferencedPics();
      const orphanAbs = seedOrphan(sandbox, 'prune-orphan.png');
      try {
        const r = runScript(sandbox, vault, []);
        expect(r.status).toBe(0);
        expect(r.stdout).not.toContain('▸ Prune'); // 无 prune 阶段输出
        expect(existsSync(orphanAbs)).toBe(true); // 孤儿不动
        expect(existsSync(attachPath(sandbox, 'prune-pic.png'))).toBe(true); // 同步照常
        expect(r.stdout).toContain('附件 2'); // STATS 行照常
      } finally {
        cleanup(sandbox, vault);
      }
    },
  );

  it(
    '无 VAULT + --prune --delete：报错退出（exit 1），不做任何删除',
    () => {
      const sandbox = makeSandbox();
      const vault = makeVaultWithReferencedPics();
      const orphanAbs = seedOrphan(sandbox, 'prune-orphan.png');
      try {
        const r = runScript(sandbox, vault, ['--prune', '--delete'], { noVault: true });
        expect(r.status).toBe(1);
        expect(r.stderr).toContain('VAULT');
        expect(existsSync(orphanAbs)).toBe(true); // 红线 c：没删
      } finally {
        cleanup(sandbox, vault);
      }
    },
  );

  it(
    '--dry 与 --prune --delete 同给：--dry 恒定压制删除',
    () => {
      const sandbox = makeSandbox();
      const vault = makeVaultWithReferencedPics();
      const orphanAbs = seedOrphan(sandbox, 'prune-orphan.png');
      try {
        const r = runScript(sandbox, vault, ['--dry', '--prune', '--delete']);
        expect(r.status).toBe(0);
        expect(r.stdout).toContain('prune-orphan.png'); // 照常报告
        expect(r.stdout).toContain('--dry 生效'); // 明示删除被压制
        expect(existsSync(orphanAbs)).toBe(true);
        expect(existsSync(attachPath(sandbox, 'prune-pic.png'))).toBe(false); // dry 同步零复制
      } finally {
        cleanup(sandbox, vault);
      }
    },
  );

  it(
    'VAULT 白名单扫描 0 文件：拒绝执行删除（防 VAULT 指错目录误删全部附件）',
    () => {
      const sandbox = makeSandbox();
      const vault = makeVault();
      writeVaultFile(vault, 'Journal/prune-journal.md', '---\ntitle: J\npublish: true\n---\n\n白名单外。\n');
      const orphanAbs = seedOrphan(sandbox, 'prune-orphan.png');
      try {
        const r = runScript(sandbox, vault, ['--prune', '--delete']);
        expect(r.status).toBe(0);
        expect(r.stdout).toContain('拒绝');
        expect(existsSync(orphanAbs)).toBe(true);
      } finally {
        cleanup(sandbox, vault);
      }
    },
  );

  it.runIf(CAN_SYMLINK)(
    '路径逃逸负例：attachments 内指向目录外的 junction 绝不删除、绝不穿透删目标',
    () => {
      const sandbox = makeSandbox();
      const vault = makeVaultWithReferencedPics();
      const outsideDir = mkdtempSync(path.join(os.tmpdir(), 'sync-prune-outside-'));
      const outsideFile = path.join(outsideDir, 'outside.txt');
      writeFileSync(outsideFile, 'precious');
      const linkAbs = attachPath(sandbox, 'prune-junc');
      symlinkSync(outsideDir, linkAbs, process.platform === 'win32' ? 'junction' : 'dir');
      const orphanAbs = seedOrphan(sandbox, 'prune-orphan.png');
      try {
        const r = runScript(sandbox, vault, ['--prune', '--delete']);
        expect(r.status).toBe(0);
        // 沙箱内普通孤儿照删（防护是定向的，不是一刀切）
        expect(existsSync(orphanAbs)).toBe(false);
        // 链接本身不删、链接目标不穿透删
        expect(existsSync(linkAbs)).toBe(true);
        expect(existsSync(outsideFile)).toBe(true);
        expect(readFileSync(outsideFile, 'utf8')).toBe('precious');
        // 删除清单里不出现越界路径
        expect(r.stdout).not.toContain('outside.txt');
        expect(r.stdout).not.toContain('已删 prune-junc');
        expect(r.stdout).toContain('跳过不安全路径 1');
      } finally {
        rmSync(linkAbs, { recursive: true, force: true }); // 先摘链接再删沙箱
        cleanup(sandbox, vault, [outsideDir]);
      }
    },
  );
});
