/**
 * 论文筛选纯逻辑（Phase 2，ADR/client modules）
 * ---------------------------------------------------------------------------
 * 抽自 publications.astro 与 en/publications.astro 的内联筛选脚本（原为逐字
 * 相同的两份副本，D10：双页同改走本模块，不留内联死副本）。本文件只放纯计算
 * （URL 参数解析 + 匹配判定），不碰 DOM；aria-pressed / 显隐 / URL 回写等
 * DOM 接线仍留在两页的 <script> 中。
 *
 * 行为锁定（characterization）：以下 golden 均为现状，含怪癖，不要顺手修——
 *   1. `?tag=`（单标签，首页兼容）非空时完全忽略 `?tags=`；
 *   2. `?year=` 与 `?years=` 叠加合并，不是二选一；
 *   3. `?stat=` 空串兜底为 'all'；未知值原样保留且 matchStat 恒真；
 *   4. `|` 分隔后 filter(Boolean)，空段丢弃。
 */

/** 一次筛选的选中状态：年份集合 + 标签集合 + 统计口径 */
export interface PubSelection {
  years: Set<string>;
  tags: Set<string>;
  stat: string;
}

/**
 * 从 URL 参数解析筛选状态。
 * 兼容首页 `?tag=` 单标签与多选 `?tags=` / `?year=` / `?years=` / `?stat=`。
 */
export function parsePubSelection(params: URLSearchParams): PubSelection {
  const years = new Set<string>();
  const tags = new Set<string>();
  const stat = params.get('stat') || 'all';
  const single = params.get('tag');
  if (single) tags.add(single);
  else (params.get('tags') || '').split('|').filter(Boolean).forEach((t) => tags.add(t));
  (params.get('year') || '').split('|').filter(Boolean).forEach((y) => years.add(y));
  (params.get('years') || '').split('|').filter(Boolean).forEach((y) => years.add(y));
  return { years, tags, stat };
}

/** 年份匹配：未选年份全匹配；否则 String 强转后查集合。 */
export function matchYear(year: string | number, sel: PubSelection): boolean {
  return sel.years.size === 0 || sel.years.has(String(year));
}

/** 标签匹配：data-tags 是 `|` 分隔多值，任一命中即匹配；未选标签全匹配。 */
export function matchTag(tags: string, sel: PubSelection): boolean {
  return sel.tags.size === 0 || String(tags).split('|').some((t) => sel.tags.has(t));
}

/**
 * 统计口径匹配。入参为元素 dataset 的原始值（'true' / 'false' / undefined），
 * 语义照搬内联脚本的 data-first-author / data-corresponding 严格 `=== 'true'`
 * 判定；未知 stat 值 fallthrough 恒真（现状怪癖，锁定）。
 */
export function matchStat(firstAuthor: string | undefined, corresponding: string | undefined, sel: PubSelection): boolean {
  if (sel.stat === 'all') return true;
  if (sel.stat === 'first') return firstAuthor === 'true';
  if (sel.stat === 'corr') return corresponding === 'true';
  return true;
}
