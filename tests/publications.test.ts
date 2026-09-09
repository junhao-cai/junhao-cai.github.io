/**
 * 表征测试（characterization tests）— src/lib/publications.ts
 * ---------------------------------------------------------------------------
 * golden 值从 2026-09-09 的现行为采集，锁定「现状」，为 Phase 1+ 重构护栏。
 * 直接 import（vitest 基于 Vite，原生支持 `?raw` import —— 这正是被测模块
 * 自己的加载方式，表征它最真实的入口）。本人名变体来自 src/data/cv.ts 的
 * SELF_NAME_VARIANTS（import 进来核对接线，不复制字面量）。
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import bibSource from '../src/data/pubs.bib?raw';
import { parseBibtex, type Author, type Entry } from '../src/lib/bibtex';
import {
  PUBLICATIONS,
  SELECTED_PUBLICATIONS,
  PUBLICATIONS_YEARS,
  PUBLICATIONS_BY_TYPE,
  isSelfAuthor,
  isCorrespondingAuthor,
  selfIsCorresponding,
  publicationTags,
  linkFor,
  byType,
  TYPE_LABELS_ZH,
  TYPE_ORDER,
} from '../src/lib/publications';
import { SELF_NAME_VARIANTS } from '../src/data/cv';

// 构造合成 Author 的便捷函数（full 默认 "First Last"）
function au(first: string, last: string, full?: string): Author {
  return { first, last, full: full ?? `${first} ${last}` };
}

const bibPath = fileURLToPath(new URL('../src/data/pubs.bib', import.meta.url));
const bibFromFs = parseBibtex(readFileSync(bibPath, 'utf8'));

describe('PUBLICATIONS — 构建期解析不变量', () => {
  it('PUBLICATIONS.length === fs 读同一 bib 的 parseBibtex 结果长度 === 18（golden）', () => {
    expect(PUBLICATIONS.length).toBe(bibFromFs.length);
    expect(PUBLICATIONS.length).toBe(18);
  });

  it('?raw 内容与 fs 读取内容一致（同一数据源）', () => {
    expect(bibSource).toBe(readFileSync(bibPath, 'utf8'));
  });

  it('PUBLICATIONS 已按 sortEntries 排序：年份非升序', () => {
    for (let i = 1; i < PUBLICATIONS.length; i++) {
      expect(PUBLICATIONS[i - 1].year as number).toBeGreaterThanOrEqual(
        PUBLICATIONS[i].year as number
      );
    }
  });

  it('SELECTED_PUBLICATIONS ⊆ PUBLICATIONS；golden：恰 3 条置顶', () => {
    const keys = new Set(PUBLICATIONS.map((e) => e.key));
    expect(SELECTED_PUBLICATIONS.length).toBe(3);
    expect(SELECTED_PUBLICATIONS.every((e) => keys.has(e.key))).toBe(true);
    // golden：置顶条目 key（selected = {true} 的现状）
    expect(SELECTED_PUBLICATIONS.map((e) => e.key).sort()).toEqual([
      'cai2022wien',
      'huang2023gate',
      'zhang2026universal',
    ]);
  });

  it('怪癖（characterization）：PUBLICATIONS_BY_TYPE 导出为空数组（从未被填充）', () => {
    expect(PUBLICATIONS_BY_TYPE).toEqual([]);
  });

  it('PUBLICATIONS_YEARS：降序去重（golden）', () => {
    expect(PUBLICATIONS_YEARS).toEqual([2026, 2025, 2023, 2022, 2020, 2018, 2017]);
  });

  it('byType 过滤（golden）：journal 15 / conference 2 / thesis 1', () => {
    expect(byType('journal').length).toBe(15);
    expect(byType('conference').length).toBe(2);
    expect(byType('thesis').length).toBe(1);
  });
});

describe('isSelfAuthor — 语义（合成边界 + 真实数据）', () => {
  it('本人名变体全部命中（与 cv.ts SELF_NAME_VARIANTS 接线）', () => {
    expect(SELF_NAME_VARIANTS.length).toBeGreaterThan(0); // 变体源非空（接线前提）
    expect(isSelfAuthor(au('Junhao', 'Cai'))).toBe(true);
    expect(isSelfAuthor(au('Jun-Hao', 'Cai'))).toBe(true);
    expect(isSelfAuthor(au('J.', 'Cai'))).toBe(true);
    // Last, First 形态的候选也参与匹配
    expect(isSelfAuthor(au('Junhao', 'Cai', 'Cai, Junhao'))).toBe(true);
    expect(isSelfAuthor(au('Jun-Hao', 'Cai', 'Cai, Jun-Hao'))).toBe(true);
  });

  it('非本人不命中（同姓边界、大小写/标点归一化边界）', () => {
    expect(isSelfAuthor(au('Bei', 'Zhang', 'Zhang, Bei'))).toBe(false);
    expect(isSelfAuthor(au('Qian', 'Cai', 'Cai, Qian'))).toBe(false); // 同姓不同名
    expect(isSelfAuthor(au('', '', 'others'))).toBe(false); // bib 截断尾幽灵作者
    // 归一化剥离非字母数字：'J.-H. Cai' → 'jhcai'，不在变体集 → false（现状）
    expect(isSelfAuthor(au('J.-H.', 'Cai', 'J.-H. Cai'))).toBe(false);
  });

  it('真实 PUBLICATIONS：至少一条含本人作者；一作即本人的条目命中', () => {
    expect(PUBLICATIONS.some((e) => e.authors.some(isSelfAuthor))).toBe(true);
    const wien = PUBLICATIONS.find((e) => e.key === 'cai2022wien');
    expect(wien).toBeTruthy();
    expect(isSelfAuthor((wien as Entry).authors[0])).toBe(true);
    const fiber = PUBLICATIONS.find((e) => e.key === 'cai2017kw');
    expect(isSelfAuthor((fiber as Entry).authors[0])).toBe(true); // Cai, Jun-Hao 变体
    const zhang = PUBLICATIONS.find((e) => e.key === 'zhang2026stacking');
    expect(isSelfAuthor((zhang as Entry).authors[7])).toBe(true); // Cai, Junhao 排第 8（index 7）
  });
});

describe('isCorrespondingAuthor / selfIsCorresponding — 语义', () => {
  it('isCorrespondingAuthor：作者在 corresponding 列表（归一化比对）', () => {
    const cai = au('Junhao', 'Cai', 'Cai, Junhao');
    expect(isCorrespondingAuthor(cai, ['Cai, Junhao'])).toBe(true);
    expect(isCorrespondingAuthor(cai, ['Zhang, Bei'])).toBe(false);
    expect(isCorrespondingAuthor(cai, [])).toBe(false); // 空列表 → false
    // 变体形态命中："Junhao Cai" vs 列表里的 "Cai, Junhao"（full/first+last 候选）
    expect(isCorrespondingAuthor(au('Junhao', 'Cai'), ['Cai, Junhao'])).toBe(true);
  });

  it('selfIsCorresponding：golden — 恰 3 条通讯作者是本人', () => {
    const keys = PUBLICATIONS.filter(selfIsCorresponding)
      .map((e) => e.key)
      .sort();
    expect(keys).toEqual(['wei2025manipulating', 'zhang2026stacking', 'zhang2026universal']);
    expect(selfIsCorresponding(PUBLICATIONS.find((e) => e.key === 'cai2022wien') as Entry)).toBe(
      false
    ); // 无 corresponding 字段
  });
});

describe('publicationTags / linkFor / 类型标签冒烟', () => {
  it('publicationTags：按 count 降序、同频按 tag 升序；top3 golden', () => {
    const tags = publicationTags();
    expect(tags.length).toBeGreaterThan(0);
    for (let i = 1; i < tags.length; i++) {
      const ok =
        tags[i - 1].count > tags[i].count ||
        (tags[i - 1].count === tags[i].count && tags[i - 1].tag.localeCompare(tags[i].tag) <= 0);
      expect(ok, `排序 @${i}`).toBe(true);
    }
    expect(tags.slice(0, 3)).toEqual([
      { tag: 'graphene', count: 8 },
      { tag: 'fiber laser', count: 7 },
      { tag: 'photonics', count: 7 },
    ]);
  });

  it('linkFor：doi 优先 → arxiv → url → undefined（golden 三分支）', () => {
    expect(linkFor(PUBLICATIONS.find((e) => e.key === 'wei2025manipulating') as Entry)).toBe(
      'https://doi.org/10.1016/j.carbon.2025.120617'
    );
    // 怪癖：无 doi 字段但有 url（SSRN 预印 DOI 写在 url）→ 落到 url 分支
    expect(linkFor(PUBLICATIONS.find((e) => e.key === 'zhang2026stacking') as Entry)).toBe(
      'https://doi.org/10.2139/ssrn.6021694'
    );
    // 无 doi / arxiv / url 的旧文 → undefined
    expect(linkFor(PUBLICATIONS.find((e) => e.key === 'cai2018compressibility') as Entry)).toBeUndefined();
  });

  it('TYPE_LABELS_ZH / TYPE_ORDER 与 bibtex.ts 侧同值（双份真相的现状锁定）', () => {
    expect(TYPE_LABELS_ZH.journal).toBe('期刊论文');
    expect(TYPE_LABELS_ZH.preprint).toBe('预印本');
    expect(TYPE_ORDER[0]).toBe('preprint');
    expect(TYPE_ORDER.length).toBe(7);
  });
});


type EntryShape = import('../src/lib/bibtex').Entry;
