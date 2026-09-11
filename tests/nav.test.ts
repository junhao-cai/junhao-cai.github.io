/**
 * 回归护栏 —— 导航「当前页」高亮判定（src/lib/nav.ts）。
 *
 * 背景：该判定原先内联在 Header.astro frontmatter，漏测导致一个真实 bug：
 * 首页栏目在英文页把 `/en/*` 的每一页都判为高亮（zh 用户站因首页 target 恰为
 * `'/'` 而幸免，项目站 base='/repo' 下则连中文页也全站高亮首页），表现为
 * 「导航栏多个高亮」。本组用例把修复后的行为钉死。
 *
 * 用例里的 target 值按 Header.astro 的真实调用形态给出：
 *   target = base + withLang(item.path, lang)，首页 isHome=true。
 */
import { describe, expect, it } from 'vitest';
import { isNavActive, normalizePath } from '../src/lib/nav';

describe('normalizePath — 去尾斜杠并归一为 /', () => {
  it("'/' → '/'", () => expect(normalizePath('/')).toBe('/'));
  it("'' → '/'", () => expect(normalizePath('')).toBe('/'));
  it("'/cv/' → '/cv'", () => expect(normalizePath('/cv/')).toBe('/cv'));
  it("'/cv///' → '/cv'（多重尾斜杠归一）", () => expect(normalizePath('/cv///')).toBe('/cv'));
  it("'/cv' → '/cv'（无尾斜杠保持不变）", () => expect(normalizePath('/cv')).toBe('/cv'));
});

describe("isNavActive — 用户站（base = ''）", () => {
  describe('首页栏目（isHome）只精确匹配语言根', () => {
    it("zh：仅 '/' 高亮，子页面不高亮", () => {
      expect(isNavActive('/', { target: '/', isHome: true })).toBe(true);
      expect(isNavActive('/publications/', { target: '/', isHome: true })).toBe(false);
      expect(isNavActive('/blog/hello/', { target: '/', isHome: true })).toBe(false);
    });

    it('en：仅 /en 高亮 —— 回归：曾在 /en/* 每一页都高亮首页', () => {
      expect(isNavActive('/en/', { target: '/en/', isHome: true })).toBe(true);
      expect(isNavActive('/en/publications/', { target: '/en/', isHome: true })).toBe(false);
      expect(isNavActive('/en/blog/hello/', { target: '/en/', isHome: true })).toBe(false);
      // 中文页不应命中英文语言根
      expect(isNavActive('/publications/', { target: '/en/', isHome: true })).toBe(false);
    });
  });

  describe('其余栏目：自身精确匹配 + 子路径保持高亮', () => {
    it('zh：栏目页与子页面', () => {
      expect(isNavActive('/publications/', { target: '/publications/', isHome: false })).toBe(true);
      expect(isNavActive('/cv/', { target: '/cv/', isHome: false })).toBe(true);
      expect(isNavActive('/blog/', { target: '/blog/', isHome: false })).toBe(true);
      expect(isNavActive('/blog/hello-world/', { target: '/blog/', isHome: false })).toBe(true);
    });

    it('zh：不跨栏目误高亮', () => {
      expect(isNavActive('/cv/', { target: '/publications/', isHome: false })).toBe(false);
      // 前缀边界：/blogger 不属于 /blog
      expect(isNavActive('/blogger/', { target: '/blog/', isHome: false })).toBe(false);
    });

    it('en：带语言前缀的栏目', () => {
      expect(isNavActive('/en/publications/', { target: '/en/publications/', isHome: false })).toBe(true);
      expect(isNavActive('/en/blog/hello/', { target: '/en/blog/', isHome: false })).toBe(true);
      expect(isNavActive('/publications/', { target: '/en/publications/', isHome: false })).toBe(false);
    });
  });
});

describe("isNavActive — 项目站（base = '/repo'）", () => {
  it('zh：首页仅 /repo 高亮 —— 回归：曾让 /repo/* 全站高亮首页', () => {
    expect(isNavActive('/repo/', { target: '/repo/', isHome: true })).toBe(true);
    expect(isNavActive('/repo/publications/', { target: '/repo/', isHome: true })).toBe(false);
    expect(isNavActive('/repo/cv/', { target: '/repo/', isHome: true })).toBe(false);
  });

  it('en：首页仅 /repo/en 高亮', () => {
    expect(isNavActive('/repo/en/', { target: '/repo/en/', isHome: true })).toBe(true);
    expect(isNavActive('/repo/en/publications/', { target: '/repo/en/', isHome: true })).toBe(false);
  });

  it('栏目：base + 语言前缀共存', () => {
    expect(isNavActive('/repo/publications/', { target: '/repo/publications/', isHome: false })).toBe(true);
    expect(isNavActive('/repo/en/publications/', { target: '/repo/en/publications/', isHome: false })).toBe(true);
    expect(isNavActive('/repo/en/blog/hello/', { target: '/repo/en/blog/', isHome: false })).toBe(true);
  });

  it('单页至多一个栏目高亮：/repo/en/publications/ 上首页必须让位', () => {
    const page = '/repo/en/publications/';
    const home = isNavActive(page, { target: '/repo/en/', isHome: true });
    const pubs = isNavActive(page, { target: '/repo/en/publications/', isHome: false });
    expect([home, pubs]).toEqual([false, true]);
  });
});
