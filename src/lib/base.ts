/**
 * =============================================================================
 *  Base Authority（ADR-003）—— 全站唯一基地址权威模块（T-08，Phase 1 基地址收口）
 * =============================================================================
 * 现状：base 逻辑散落 5 处（site.config.ts SITE.url 正则手术、src/lib/url.ts、
 * i18n/switchLangPath、Header.astro isActive、BaseLayout.astro canonical）。
 * 自本模块起，base 的归一规则只有一个权威来源：
 *
 *   basePath()      BASE_URL 归一为「带前导+尾斜杠」形态（'/' 或 '/repo/'）
 *   withBase()      站内路径拼 base（语义 = url.ts url()，吞 path 前导斜杠）
 *   stripBase()     去 pathname 前端 base（语义 = url.ts stripBase()，不匹配原样回退）
 *   localizedPath() 语言前缀（D9：零 i18n 依赖，规则内联——zh 恒等、en 加 /en）
 *   absoluteUrl()   origin + withBase（语义 = url.ts absolute()，含「site 已含
 *                   base 时双拼」的现状怪癖——已由 tests/url.test.ts 锁定，
 *                   T-09 迁移时必须原样保持）
 *
 * 硬约束（决策 D9）：本模块**禁止 import src/i18n/***（含类型），语言前缀规则
 * 在 localizedPath 内联实现；i18n 层反过来依赖本模块。零第三方依赖。
 *
 * env 读取时机：所有 import.meta.env（BASE_URL / SITE）都在**函数内部惰性读取**，
 * 不做模块级缓存——base 的注入点（astro.config / deploy.yml）在构建期不变，
 * 惰性读取无运行时成本，且是单测 vi.stubEnv 生效的前提。
 *
 * 行为规范见 tests/base.test.ts（双 base 场景表，含畸形输入定义）。
 * Phase 1 迁移完成后（T-09），url.ts 退化为本模块的薄封装并最终移除。
 */

/**
 * BASE_URL 归一：恒为「/段/…/」形态。空串 / 未设 → '/'；缺前导或尾斜杠补齐
 * （'repo' → '/repo/'，'/repo' → '/repo/'，'/repo/' 幂等）。
 */
export function basePath(): string {
  const raw = import.meta.env.BASE_URL || '/';
  const core = raw.replace(/^\/+|\/+$/g, '');
  return core === '' ? '/' : `/${core}/`;
}

/**
 * 站内路径拼 base：与 url.ts url() 语义一致——吞掉 path 的**前导**斜杠
 * （含多个），内部与尾部斜杠原样保留；空路径返回 base 本身。
 */
export function withBase(path: string): string {
  return basePath() + String(path).replace(/^\/+/, '');
}

/**
 * 去 pathname 前端 base：与 url.ts stripBase() 语义一致——按「base + '/'」整段
 * 前缀匹配（不吃子串、不匹配恰等 base 的裸串），不匹配时原样返回；base 归一后
 * 为 '/'（即空 core）时恒等。
 */
export function stripBase(pathname: string): string {
  const base = basePath().replace(/\/$/, '');
  if (base && pathname.startsWith(`${base}/`)) {
    return pathname.slice(base.length);
  }
  return pathname;
}

/**
 * 语言前缀（D9 内联规则）：zh 恒等原样返回；en 加 '/en' 前缀——纯前缀拼接，
 * 拼接处不产生重复斜杠、尾斜杠形态随输入保留（'/' → '/en'、'/cv/' → '/en/cv/'），
 * 不做 withLang 式尾斜杠归一、不去既有 '/en'（去重是调用方职责）。
 */
export function localizedPath(path: string, lang: 'zh' | 'en'): string {
  if (lang !== 'en') return path;
  const core = String(path).replace(/^\/+/, '');
  return core === '' ? '/en' : `/en/${core}`;
}

/**
 * 绝对 URL（canonical / RSS / OG）：origin（site ?? SITE，去全部尾斜杠；空串/
 * 未设回退为空前缀）+ withBase。与 url.ts absolute() 语义一致，**含**「site 已含
 * base 时双拼」的现状怪癖（见 tests/url.test.ts 锁定注释）。
 */
export function absoluteUrl(path: string, site?: string): string {
  const origin = (site ?? import.meta.env.SITE ?? '').replace(/\/+$/, '');
  return `${origin}${withBase(path)}`;
}
