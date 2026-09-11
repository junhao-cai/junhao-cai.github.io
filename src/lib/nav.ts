/**
 * lib/nav —— 导航「当前页」高亮判定的纯函数。
 *
 * 为什么单独成模块：这段逻辑原先内联在 Header.astro 的 frontmatter 里，
 * 无法被 vitest 覆盖，于是「/en/* 每一页都把首页判为高亮」这类错误
 * 只能靠肉眼看出来。抽成纯函数后由 tests/nav.test.ts 钉死行为。
 *
 * 依赖方向（D9）：本模块**不**依赖 src/i18n——语言前缀（/en）由调用方
 * 预先算好再传进来，避免 lib → i18n 的反向依赖。
 */

/** 去掉尾部斜杠；根路径（含空串）归一为 '/' */
export function normalizePath(p: string): string {
  return p.replace(/\/+$/, '') || '/';
}

export interface NavTarget {
  /** 该栏目在当前语言下的目标 URL（可含尾斜杠，如 '/'、'/en/'、'/publications/'） */
  target: string;
  /** 是否为首页栏目——只精确匹配，不做子路径前缀匹配 */
  isHome: boolean;
}

/**
 * 判断某个导航栏目在当前页面是否应高亮（aria-current="page"）。
 *
 * - 首页：仅当 pathname 恰为语言根（zh `/`、en `/en/`）时高亮。若对首页也
 *   做前缀匹配，`/en/*` 的每一页（项目站 base='/repo' 下 `/repo/*` 同理）都
 *   会被判为首页——这是「导航栏多个高亮」的根因。
 * - 其余栏目：精确匹配自身，或为其子路径（如 `/blog/xxx` 仍高亮「笔记」）。
 */
export function isNavActive(pathname: string, { target, isHome }: NavTarget): boolean {
  const path = normalizePath(pathname);
  const t = normalizePath(target);
  if (isHome) return path === t;
  return path === t || path.startsWith(t + '/');
}
