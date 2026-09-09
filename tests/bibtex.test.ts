/**
 * 表征测试（characterization tests）— src/lib/bibtex.ts
 * ---------------------------------------------------------------------------
 * golden 值从 2026-09-09 的现行为采集，锁定「现状」（含怪癖），为 Phase 1+ 重构
 * 提供安全网。重构若改变这些输出，测试会红 —— 那是有意为之的行为变更告警，
 * 不是测试写错。发现怪癖不要顺手修，先在计划里登记为行为变更。
 *
 * 数据：fs 读取真实 src/data/pubs.bib（?raw import 留给 publications.test.ts）。
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  parseAuthors,
  parseBibtex,
  formatCitation,
  sortEntries,
  groupByYear,
  TYPE_LABELS,
  TYPE_ORDER,
  type Author,
  type Entry,
} from '../src/lib/bibtex';

// ---------------------------------------------------------------------------
// 真实数据
// ---------------------------------------------------------------------------

const bibPath = fileURLToPath(new URL('../src/data/pubs.bib', import.meta.url));
const bibSource = readFileSync(bibPath, 'utf8');
const entries: Entry[] = parseBibtex(bibSource);

function byKey(k: string): Entry {
  const found = entries.find((e) => e.key === k);
  if (!found) throw new Error(`pubs.bib 中不存在条目 ${k}`);
  return found;
}

// ---------------------------------------------------------------------------
// 结构不变量（对整个真实 bib 断言）
// ---------------------------------------------------------------------------

describe('parseBibtex — 结构不变量（真实 pubs.bib）', () => {
  it('条目数 === bib 原文行首 @type{ 匹配数 === 18（golden）', () => {
    const atCount = (bibSource.match(/^@\w+\s*\{/gm) ?? []).length;
    expect(atCount).toBe(18); // bib 里无注释行含 @，% 注释全部行首
    expect(entries.length).toBe(atCount);
    expect(entries.length).toBe(18);
  });

  it('key 唯一且非空', () => {
    const keys = entries.map((e) => e.key);
    for (const k of keys) expect(k.trim().length).toBeGreaterThan(0);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('每条目含非空 authors 数组、非空 title、数值 year（现状：18 条 year 全非 null）', () => {
    for (const e of entries) {
      expect(e.authors.length, `${e.key}: authors 非空`).toBeGreaterThan(0);
      for (const a of e.authors) {
        expect(typeof a.first, `${e.key}: Author.first`).toBe('string');
        expect(typeof a.last, `${e.key}: Author.last`).toBe('string');
        expect(typeof a.full, `${e.key}: Author.full`).toBe('string');
      }
      expect(e.title.length, `${e.key}: title 非空`).toBeGreaterThan(0);
      expect(typeof e.year, `${e.key}: year`).toBe('number');
    }
  });

  it('类型别名映射（characterization）：article→journal, inproceedings→conference, phdthesis→thesis', () => {
    const types = new Map<string, number>();
    for (const e of entries) types.set(e.type, (types.get(e.type) ?? 0) + 1);
    expect(Object.fromEntries(types)).toEqual({ journal: 15, conference: 2, thesis: 1 });
  });

  it('LaTeX 还原：\\& → &，页码 -- → –（en dash），DOI 剥离 doi.org 前缀（characterization golden）', () => {
    const yan = byKey('yan2025atmospheric');
    expect(yan.venue).toBe('ACS Applied Materials & Interfaces');
    expect(yan.volume).toBe('17');
    expect(yan.number).toBe('21');
    expect(yan.pages).toBe('31257–31264');
    expect(yan.doi).toBe('10.1021/acsami.5c04262');
    expect(yan.tags).toEqual(['graphene', '2D materials', 'nanofabrication']);

    const zhang = byKey('zhang2026stacking');
    expect(zhang.doi).toBe(''); // 无 doi 字段（URL 型 DOI 写在 url 里的现状）
    expect(zhang.url).toBe('https://doi.org/10.2139/ssrn.6021694');
    expect(zhang.corresponding).toEqual(['Cai, Junhao']);
    expect(zhang.note).toBe('Preprint DOI: 10.2139/ssrn.6021694');
    expect(zhang.selected).toBe(false);

    const cai2022 = byKey('cai2022wien');
    expect(cai2022.selected).toBe(true);
    expect(cai2022.corresponding).toEqual([]); // 无 corresponding 字段 → 空数组
    expect(cai2022.venue).toBe('Nature Communications');
  });

  it('thesis 怪癖（characterization）：school 同时进 venue 与 publisher（APA/IEEE 会重复出现）', () => {
    const thesis = byKey('cai2022thesis');
    expect(thesis.type).toBe('thesis');
    expect(thesis.venue).toBe('The University of Manchester');
    expect(thesis.publisher).toBe('The University of Manchester');
  });

  it('截断作者列表怪癖（characterization）："and others" 被解析成 first/last 均空的幽灵作者', () => {
    const griffin = byKey('griffin2020proton');
    const last = griffin.authors[griffin.authors.length - 1];
    expect(last).toEqual({ first: '', last: '', full: 'others' });
  });
});

// ---------------------------------------------------------------------------
// sortEntries / groupByYear
// ---------------------------------------------------------------------------

describe('sortEntries / groupByYear', () => {
  it('sortEntries 后年份非升序；同年按 key 升序（localeCompare 稳定 tie-break）', () => {
    const sorted = sortEntries(entries);
    const years = sorted.map((e) => e.year as number);
    for (let i = 1; i < years.length; i++) {
      expect(years[i - 1], `years 非升序 @${i}`).toBeGreaterThanOrEqual(years[i]);
    }
    // golden：真实数据的完整排序键序
    expect(sorted.map((e) => e.key)).toEqual([
      'zhang2026stacking',
      'zhang2026universal',
      'wei2025manipulating',
      'wei2025plasmon',
      'yan2025atmospheric',
      'huang2023gate',
      'zhang2023ultraclean',
      'cai2022photoaccelerated',
      'cai2022thesis',
      'cai2022wien',
      'dou2020twodimensionally',
      'griffin2020proton',
      'cai2018compressibility',
      'wang2018ultraviolet',
      'cai2017kw',
      'cai2017square',
      'cai2017state',
      'dou2017generation',
    ]);
    // sortEntries 不改原数组（拷贝排序）
    expect(entries[0].key).toBe('zhang2026stacking');
    expect(sorted).not.toBe(entries);
  });

  it('null year 排序（合成边界）：year null 视作 0 排最后', () => {
    const synth: Entry[] = [
      { key: 'b', year: 2020 } as Entry,
      { key: 'a', year: null } as Entry,
      { key: 'c', year: 2024 } as Entry,
    ];
    expect(sortEntries(synth).map((e) => e.key)).toEqual(['c', 'b', 'a']);
  });

  it('groupByYear：年份降序分组，组内按 sortEntries 顺序（characterization golden）', () => {
    const grouped = groupByYear(entries);
    expect(grouped.map(([y, es]) => [y, es.length])).toEqual([
      [2026, 2],
      [2025, 3],
      [2023, 2],
      [2022, 3],
      [2020, 2],
      [2018, 2],
      [2017, 4],
    ]);
    const g2017 = grouped.find(([y]) => y === 2017)![1];
    expect(g2017.map((e) => e.key)).toEqual([
      'cai2017kw',
      'cai2017square',
      'cai2017state',
      'dou2017generation',
    ]);
  });
});

// ---------------------------------------------------------------------------
// parseAuthors
// ---------------------------------------------------------------------------

describe('parseAuthors（characterization golden）', () => {
  it('Last, First " and " 多作者切分', () => {
    const got = parseAuthors('Zhang, Bei and Shen, Bolin and Cai, Junhao');
    expect(got).toEqual([
      { first: 'Bei', last: 'Zhang', full: 'Zhang, Bei' },
      { first: 'Bolin', last: 'Shen', full: 'Shen, Bolin' },
      { first: 'Junhao', last: 'Cai', full: 'Cai, Junhao' },
    ]);
  });

  it('LaTeX 重音还原 + 姓前名后逗号切分（真实 cai2022wien 作者串前 4 位）', () => {
    // 注意：bib 原文是 V{\'i}ctor（反斜杠+撇号），测试源码里 \\' 才能产出该字面量
    const got = parseAuthors(
      "Cai, Junhao and Griffin, Eoin and Guarochico-Moreira, V{\\'i}ctor H. and Barry, Donnchadh"
    );
    expect(got).toEqual([
      { first: 'Junhao', last: 'Cai', full: 'Cai, Junhao' },
      { first: 'Eoin', last: 'Griffin', full: 'Griffin, Eoin' },
      // V\u0069\u0301ctor = V + i + U+0301（组合尖音，分解形式），decodeLatex 重音还原的现状
      { first: 'V\u0069\u0301ctor H.', last: 'Guarochico-Moreira', full: 'Guarochico-Moreira, V\u0069\u0301ctor H.' },
      { first: 'Donnchadh', last: 'Barry', full: 'Barry, Donnchadh' },
    ]);
  });

  it('"and others" 截断尾 + 缩写名保留（真实 griffin2020proton 作者串）', () => {
    const got = parseAuthors(
      'Griffin, Eoin and Mogg, Lucas and Zhou, T. Y. and Cai, Junhao and others'
    );
    expect(got.length).toBe(5);
    expect(got[2]).toEqual({ first: 'T. Y.', last: 'Zhou', full: 'Zhou, T. Y.' });
    expect(got[4]).toEqual({ first: '', last: '', full: 'others' });
  });

  it('无边界的 First Last 空格格式（合成）：末词为姓', () => {
    const got = parseAuthors('Junhao Cai and Andre K. Geim');
    expect(got).toEqual([
      { first: 'Junhao', last: 'Cai', full: 'Junhao Cai' },
      { first: 'Andre K.', last: 'Geim', full: 'Andre K. Geim' },
    ]);
  });

  it('边界：空串 → 空数组；花括号内的 " and " 不切分', () => {
    expect(parseAuthors('')).toEqual([]);
    expect(parseAuthors('Cai, Junhao')).toEqual([
      { first: 'Junhao', last: 'Cai', full: 'Cai, Junhao' },
    ]);
    const braced = parseAuthors('{Barnes and Noble}, Inc.');
    expect(braced.length).toBe(1); // 花括号内的 " and " 不切分
    expect(braced[0].first).toBe('Inc.'); // 末词归 first
    expect(braced[0].last).toBe('Barnes and Noble'); // decodeLatex 剥掉花括号
    expect(braced[0].full).toBe('Barnes and Noble, Inc.');
  });
});

// ---------------------------------------------------------------------------
// formatCitation — golden（2026-09-09 现行为）
// ---------------------------------------------------------------------------

describe('formatCitation — 三风格 golden（characterization）', () => {
  const journal = byKey('wei2025manipulating');
  const conference = byKey('dou2017generation');
  const thesis = byKey('cai2022thesis');

  it('journal 条目 × apa/ieee/mla', () => {
    expect(formatCitation(journal, 'apa')).toBe(
      'Wei, Y., Zheng, X., Luo, W., Cai, J., Peng, G., & Qin, S. (2025). Manipulating Anisotropic Interfacial Thermal Transport on Graphene/CrOCl Heterostructure via Symmetry Engineering. *Carbon*, *244*, 120617. https://doi.org/10.1016/j.carbon.2025.120617'
    );
    expect(formatCitation(journal, 'ieee')).toBe(
      'Y. Wei, X. Zheng, W. Luo, J. Cai, G. Peng, and S. Qin. "Manipulating Anisotropic Interfacial Thermal Transport on Graphene/CrOCl Heterostructure via Symmetry Engineering," *Carbon*, vol. 244, pp. 120617, 2025. https://doi.org/10.1016/j.carbon.2025.120617'
    );
    expect(formatCitation(journal, 'mla')).toBe(
      'Wei, et al. "Manipulating Anisotropic Interfacial Thermal Transport on Graphene/CrOCl Heterostructure via Symmetry Engineering." *Carbon*, vol. 244, 2025 pp. 120617.'
    );
  });

  it('conference 条目 × apa/ieee/mla（无 doi/url → 无链接尾）', () => {
    expect(formatCitation(conference, 'apa')).toBe(
      'Dou, Z., Zhang, B., Cai, J., & Hou, J. (2017). The Generation of Dissipative Soliton Resonance from Dumbbell-Shaped Er-Doped Fiber Laser. *International Conference on Optical Communications and Networks (ICOCN)*, 1–3.'
    );
    expect(formatCitation(conference, 'ieee')).toBe(
      'Z. Dou, B. Zhang, J. Cai, and J. Hou. "The Generation of Dissipative Soliton Resonance from Dumbbell-Shaped Er-Doped Fiber Laser," *International Conference on Optical Communications and Networks (ICOCN)*, pp. 1–3, 2017.'
    );
    expect(formatCitation(conference, 'mla')).toBe(
      'Dou, et al. "The Generation of Dissipative Soliton Resonance from Dumbbell-Shaped Er-Doped Fiber Laser." *International Conference on Optical Communications and Networks (ICOCN)*, 2017 pp. 1–3.'
    );
  });

  it('thesis 条目 × apa/ieee/mla（怪癖：school 以 venue+publisher 双重出现）', () => {
    expect(formatCitation(thesis, 'apa')).toBe(
      'Cai, J. (2022). Electric Field Effect in Water Dissociation Across Atomically Thick Graphene. *The University of Manchester*. The University of Manchester.'
    );
    expect(formatCitation(thesis, 'ieee')).toBe(
      'J. Cai. "Electric Field Effect in Water Dissociation Across Atomically Thick Graphene," *The University of Manchester*, The University of Manchester, 2022.'
    );
    expect(formatCitation(thesis, 'mla')).toBe(
      'Cai. "Electric Field Effect in Water Dissociation Across Atomically Thick Graphene." *The University of Manchester*, 2022 .'
    ); // 怪癖：无页码时 mla 保留「年 + 空格 + 句点」
  });
});

// ---------------------------------------------------------------------------
// TYPE_LABELS / TYPE_ORDER 冒烟
// ---------------------------------------------------------------------------

describe('TYPE_LABELS / TYPE_ORDER 冒烟', () => {
  it('标签中文映射与类型排序（characterization golden）', () => {
    expect(TYPE_LABELS).toEqual({
      journal: '期刊论文',
      conference: '会议论文',
      preprint: '预印本',
      chapter: '书章',
      book: '专著',
      thesis: '学位论文',
      other: '其他',
    });
    expect(TYPE_ORDER).toEqual([
      'preprint',
      'journal',
      'conference',
      'chapter',
      'book',
      'thesis',
      'other',
    ]);
  });
});
