/**
 * 表征测试（characterization tests）—— T-06 / Phase 1 基地址收口前置护栏。
 *
 * 目的：锁死 src/lib/url.ts 三个函数在双 base 部署（用户站 BASE_URL='/'
 * 与项目站 BASE_URL='/repo/'）下的**现状**行为，golden 值固化自当前实现
 * 的真实输出，不是规范声明。Phase 1 把 5 处 base 逻辑收进新模块时，
 * 这组锚保证收口不改变下游（Header.isActive / BaseLayout canonical /
 * i18n switchLangPath）可观测的行为。
 *
 * mock 方式：用 vi.stubEnv + vi.unstubAllEnvs 操纵 import.meta.env。
 * 注意：在测试文件里直接对 import.meta.env 赋值（import.meta.env.BASE_URL
 * = '/repo/'）在本仓 vitest 5.0.0 下实测**不会传导到被测模块**（测试模块与
 * src 模块各持一份 env 引用，首跑 8 red 实证），stubEnv 才是 vitest 维护的
 * 共享 env 通道，二选一验证后择优取 stubEnv。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { absolute, stripBase, url } from '../src/lib/url';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("url() — BASE_URL = '/'（用户站 junhao-cai.github.io）", () => {
  beforeEach(() => {
    vi.stubEnv('BASE_URL', '/');
  });

  it("url('/cv') → '/cv'", () => {
    expect(url('/cv')).toBe('/cv');
  });

  it("url('cv') → '/cv'（前导斜杠被吞，与带斜杠形态等价）", () => {
    expect(url('cv')).toBe('/cv');
  });

  it("url('/') → '/'（base 与 path 双斜杠归一，不产生 '//'）", () => {
    expect(url('/')).toBe('/');
  });
});

describe("url() — BASE_URL = '/repo/'（项目站）", () => {
  beforeEach(() => {
    vi.stubEnv('BASE_URL', '/repo/');
  });

  it("url('/cv') → '/repo/cv'", () => {
    expect(url('/cv')).toBe('/repo/cv');
  });

  it("url('/') → '/repo/'（不产生 '/repo//'）", () => {
    expect(url('/')).toBe('/repo/');
  });

  it("url('/a/b/') → '/repo/a/b/'（尾斜杠保留）", () => {
    expect(url('/a/b/')).toBe('/repo/a/b/');
  });

  it("BASE_URL 无尾斜杠 '/repo' 也归一为 '/repo/' 前缀", () => {
    vi.stubEnv('BASE_URL', '/repo');
    expect(url('/cv')).toBe('/repo/cv');
  });

  it("BASE_URL 空串 → 回退 '/'", () => {
    vi.stubEnv('BASE_URL', '');
    expect(url('/cv')).toBe('/cv');
  });
});

describe('absolute() — site 参数与 import.meta.env.SITE 组合', () => {
  it("site 含尾斜杠 + BASE_URL '/repo/' → 现状双拼（site 已含 repo，url() 再拼 BASE_URL）", () => {
    // 表征锚点：这个双拼是现状行为；BaseLayout canonical 先 stripBase(pathname)
    // 再传参正是为了绕开它。收口重构若改变此语义必须同步改本测试。
    vi.stubEnv('BASE_URL', '/repo/');
    expect(absolute('/cv', 'https://x.github.io/repo/')).toBe('https://x.github.io/repo/repo/cv');
  });

  it("site 不含尾斜杠 'https://x.github.io/repo' → 去尾斜杠逻辑同上，双拼现状一致", () => {
    vi.stubEnv('BASE_URL', '/repo/');
    expect(absolute('/cv', 'https://x.github.io/repo')).toBe('https://x.github.io/repo/repo/cv');
  });

  it("BASE_URL '/' 时 site 传入不含 base 的 origin → 单拼（无双拼陷阱）", () => {
    vi.stubEnv('BASE_URL', '/');
    expect(absolute('/cv/', 'https://junhao-cai.github.io/')).toBe('https://junhao-cai.github.io/cv/');
  });

  it('site 缺省 → 回退 import.meta.env.SITE', () => {
    vi.stubEnv('BASE_URL', '/');
    vi.stubEnv('SITE', 'https://junhao-cai.github.io');
    expect(absolute('/cv/')).toBe('https://junhao-cai.github.io/cv/');
  });

  it("SITE 为空串 → origin 为空串，结果是相对路径（?? 不拦空串，现状如此）", () => {
    vi.stubEnv('BASE_URL', '/repo/');
    vi.stubEnv('SITE', '');
    expect(absolute('/cv/')).toBe('/repo/cv/');
  });
});

describe('stripBase() — 去 pathname 前端 BASE_URL', () => {
  it("BASE_URL '/repo/'：'/repo/cv/' → '/cv/'", () => {
    vi.stubEnv('BASE_URL', '/repo/');
    expect(stripBase('/repo/cv/')).toBe('/cv/');
  });

  it("BASE_URL '/repo/'：'/cv/' 不匹配前缀 → 原样返回", () => {
    vi.stubEnv('BASE_URL', '/repo/');
    expect(stripBase('/cv/')).toBe('/cv/');
  });

  it("BASE_URL '/repo/'：无尾斜杠 pathname '/repo/cv' → '/cv'", () => {
    vi.stubEnv('BASE_URL', '/repo/');
    expect(stripBase('/repo/cv')).toBe('/cv');
  });

  it("BASE_URL '/'：base 归一后为空串 → 一律原样返回", () => {
    vi.stubEnv('BASE_URL', '/');
    expect(stripBase('/cv/')).toBe('/cv/');
    expect(stripBase('/repo/cv/')).toBe('/repo/cv/');
  });
});
