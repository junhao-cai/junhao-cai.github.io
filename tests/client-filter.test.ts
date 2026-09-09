/**
 * 表征测试（characterization tests）— src/lib/client/filter.ts
 * ---------------------------------------------------------------------------
 * golden 值从 publications.astro / en/publications.astro 的内联筛选脚本
 * （Phase 2 抽取，ADR/client modules）现行为逐条推导，锁定「现状」含怪癖。
 * 怪癖清单（有意照锁，不要顺手修）：
 *   1. `?tag=`（单）非空时完全忽略 `?tags=`（else 分支）；
 *   2. `?year=` 与 `?years=` 叠加合并（不是二选一）；
 *   3. `?stat=` 空串 → 'all'，未知值（如 foo）→ 原样保留且 matchStat 恒真；
 *   4. `?tags=|` / `?years=abc`：split('|').filter(Boolean) 后为空/保留原串，
 *      `abc` 不在任何 chip 值里 ⇒ 等价于选了个永远匹配不中的值。
 */
import { describe, it, expect } from 'vitest';
import { parsePubSelection, matchYear, matchTag, matchStat, type PubSelection } from '../src/lib/client/filter';

/** 快捷构造 URLSearchParams */
const q = (s: string) => new URLSearchParams(s);

describe('parsePubSelection — URL 参数解析（golden 锁内联脚本现行为）', () => {
  it('空参数：years/tags 空集、stat=all（全显）', () => {
    const sel = parsePubSelection(q(''));
    expect(sel.years).toEqual(new Set());
    expect(sel.tags).toEqual(new Set());
    expect(sel.stat).toBe('all');
  });

  it('?tag=x 单标签（首页兼容形式）', () => {
    const sel = parsePubSelection(q('?tag=x'));
    expect(sel.tags).toEqual(new Set(['x']));
    expect(sel.years).toEqual(new Set());
    expect(sel.stat).toBe('all');
  });

  it('?tags=a|b 多选管道分隔', () => {
    const sel = parsePubSelection(q('?tags=a|b'));
    expect(sel.tags).toEqual(new Set(['a', 'b']));
  });

  it('?tag=x 时忽略 ?tags=（单标签优先，else 分支怪癖）', () => {
    const sel = parsePubSelection(q('?tag=x&tags=a|b'));
    expect(sel.tags).toEqual(new Set(['x']));
  });

  it('?tag= 空串 falsy → 落入 tags 分支', () => {
    const sel = parsePubSelection(q('?tag=&tags=a|b'));
    expect(sel.tags).toEqual(new Set(['a', 'b']));
  });

  it('?tags=| 管道空段被 filter(Boolean) 全部丢弃 → 空集', () => {
    const sel = parsePubSelection(q('?tags=|'));
    expect(sel.tags).toEqual(new Set());
  });

  it('?tags=a|a|b|b Set 去重', () => {
    const sel = parsePubSelection(q('?tags=a|a|b|b'));
    expect(sel.tags).toEqual(new Set(['a', 'b']));
  });

  it('?years=2023|2024 多年', () => {
    const sel = parsePubSelection(q('?years=2023|2024'));
    expect(sel.years).toEqual(new Set(['2023', '2024']));
  });

  it('?year=2023 单数形式也支持（现状）', () => {
    const sel = parsePubSelection(q('?year=2023'));
    expect(sel.years).toEqual(new Set(['2023']));
  });

  it('?year=2023&years=2024 两个参数叠加合并（非二选一怪癖）', () => {
    const sel = parsePubSelection(q('?year=2023&years=2024'));
    expect(sel.years).toEqual(new Set(['2023', '2024']));
  });

  it('?years=| → 空集（空段丢弃）', () => {
    const sel = parsePubSelection(q('?years=|'));
    expect(sel.years).toEqual(new Set());
  });

  it('?years=abc 畸形值原样进集合（不解析、不报错 → 匹配不中任何年份）', () => {
    const sel = parsePubSelection(q('?years=abc'));
    expect(sel.years).toEqual(new Set(['abc']));
    expect(matchYear('2023', sel)).toBe(false);
  });

  it('stat: first / corr / all', () => {
    expect(parsePubSelection(q('?stat=first')).stat).toBe('first');
    expect(parsePubSelection(q('?stat=corr')).stat).toBe('corr');
    expect(parsePubSelection(q('?stat=all')).stat).toBe('all');
  });

  it('?stat= 空串 → all（|| 兜底）', () => {
    expect(parsePubSelection(q('?stat=')).stat).toBe('all');
  });

  it('?stat=foo 未知值原样保留（怪癖：matchStat 对其恒真）', () => {
    const sel = parsePubSelection(q('?stat=foo'));
    expect(sel.stat).toBe('foo');
  });

  it('组合场景 ?tags=a|b&years=2023|2024&stat=first', () => {
    const sel = parsePubSelection(q('?tags=a|b&years=2023|2024&stat=first'));
    expect(sel.tags).toEqual(new Set(['a', 'b']));
    expect(sel.years).toEqual(new Set(['2023', '2024']));
    expect(sel.stat).toBe('first');
  });
});

describe('matchYear — 年份匹配（size===0 短路 / String 强转）', () => {
  const sel2023 = parsePubSelection(q('?years=2023'));

  it('未选年份 → 全匹配', () => {
    const sel = parsePubSelection(q(''));
    expect(matchYear('2023', sel)).toBe(true);
    expect(matchYear('', sel)).toBe(true);
  });

  it('选中年份命中 / 不命中', () => {
    expect(matchYear('2023', sel2023)).toBe(true);
    expect(matchYear('2022', sel2023)).toBe(false);
    expect(matchYear('', sel2023)).toBe(false);
  });

  it('数字年份经 String() 强转后匹配（现状 selYears.has(String(yr))）', () => {
    expect(matchYear(2023, sel2023)).toBe(true);
    expect(matchYear(2022, sel2023)).toBe(false);
  });

  it('多年选择任一命中', () => {
    const sel = parsePubSelection(q('?years=2023|2024'));
    expect(matchYear('2023', sel)).toBe(true);
    expect(matchYear('2024', sel)).toBe(true);
    expect(matchYear('2025', sel)).toBe(false);
  });
});

describe('matchTag — data-tags 管道多值任一命中即匹配', () => {
  const selA = parsePubSelection(q('?tags=a'));

  it('未选标签 → 全匹配', () => {
    const sel = parsePubSelection(q(''));
    expect(matchTag('a|b', sel)).toBe(true);
    expect(matchTag('', sel)).toBe(true);
  });

  it('单值命中 / 不命中', () => {
    expect(matchTag('a', selA)).toBe(true);
    expect(matchTag('b', selA)).toBe(false);
  });

  it('data-tags 多值条目任一命中即匹配（some 语义）', () => {
    expect(matchTag('a|b', selA)).toBe(true);
    expect(matchTag('b|a|c', selA)).toBe(true);
    expect(matchTag('b|c', selA)).toBe(false);
  });

  it('空 data-tags 且有选择 → 不匹配', () => {
    expect(matchTag('', selA)).toBe(false);
  });

  it('多选标签 ?tags=a|b', () => {
    const sel = parsePubSelection(q('?tags=a|b'));
    expect(matchTag('a', sel)).toBe(true);
    expect(matchTag('b|c', sel)).toBe(true);
    expect(matchTag('d', sel)).toBe(false);
  });
});

describe('matchStat — first/corr 严格 === \'true\'，未知 stat 恒真（怪癖）', () => {
  const all = parsePubSelection(q('?stat=all'));
  const first = parsePubSelection(q('?stat=first'));
  const corr = parsePubSelection(q('?stat=corr'));
  const weird = parsePubSelection(q('?stat=foo'));

  it('stat=all → 恒真', () => {
    expect(matchStat('true', 'true', all)).toBe(true);
    expect(matchStat('false', 'false', all)).toBe(true);
    expect(matchStat(undefined, undefined, all)).toBe(true);
  });

  it('stat=first：仅 data-first-author === "true" 通过（严格字符串）', () => {
    expect(matchStat('true', 'false', first)).toBe(true);
    expect(matchStat('false', 'true', first)).toBe(false);
    expect(matchStat(undefined, undefined, first)).toBe(false);
    // 严格 === 'true' 边界：大小写/空白变体不通过
    expect(matchStat('TRUE', 'false', first)).toBe(false);
    expect(matchStat(' true', 'false', first)).toBe(false);
  });

  it('stat=corr：仅 data-corresponding === "true" 通过', () => {
    expect(matchStat('false', 'true', corr)).toBe(true);
    expect(matchStat('true', 'false', corr)).toBe(false);
    expect(matchStat(undefined, undefined, corr)).toBe(false);
  });

  it('未知 stat → 恒真（fallthrough return true 怪癖照锁）', () => {
    expect(matchStat('false', 'false', weird)).toBe(true);
    expect(matchStat(undefined, undefined, weird)).toBe(true);
  });
});

describe('组合匹配 — 页面 apply() 的 ok = matchYear && matchTag && matchStat', () => {
  const sel = parsePubSelection(q('?tags=ml|systems&years=2023|2024&stat=first'));

  it('全命中', () => {
    expect(matchYear('2023', sel) && matchTag('ml|vision', sel) && matchStat('true', 'false', sel)).toBe(true);
  });

  it('年份不符即否', () => {
    expect(matchYear('2022', sel) && matchTag('ml|vision', sel) && matchStat('true', 'false', sel)).toBe(false);
  });

  it('标签不符即否', () => {
    expect(matchYear('2023', sel) && matchTag('vision|nlp', sel) && matchStat('true', 'false', sel)).toBe(false);
  });

  it('非一作即否', () => {
    expect(matchYear('2023', sel) && matchTag('ml|vision', sel) && matchStat('false', 'true', sel)).toBe(false);
  });
});

describe('PubSelection 类型导出', () => {
  it('parsePubSelection 返回值可赋给 PubSelection', () => {
    const sel: PubSelection = parsePubSelection(q('?tags=a'));
    expect(sel.stat).toBe('all');
  });
});
