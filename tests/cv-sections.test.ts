/**
 * 表征测试（characterization tests）— src/data/cv.ts → cvSections（T-20）
 * ---------------------------------------------------------------------------
 * golden 值从 T-17 迁移后的硬编码 CvView（2026-09-10 黄金对照基线）采集，
 * 锁定「加板块 = 加一条配置」改造不漂移：分区顺序 / id / 标题 key / 渲染条件
 * 与 TOC 派生同源。另锁定 T-20 显式新增的行为：渲染器 key 封闭集合 + 未知 key
 * 构建期确定性失败（拒绝静默跳过）。
 */
import { describe, it, expect } from 'vitest';
import {
  CV_BY_LANG,
  CV_SECTION_RENDERERS,
  assertKnownCvSectionRenderer,
  cvSections,
  isCvSectionRenderer,
} from '../src/data/cv';

/** T-17 硬编码 CvView 的分区顺序（等价红线：勿改） */
const GOLDEN_ORDER = [
  'education',
  'experience',
  'awards',
  'grants',
  'projects',
  'patents',
  'courses',
  'teaching',
  'service',
  'skills',
  'publications',
] as const;

/** 当前 CV_BY_LANG 数据下应渲染/进目录的分区（awards/grants/teaching/service 为空数组 → 隐藏） */
const GOLDEN_VISIBLE = [
  'education',
  'experience',
  'projects',
  'patents',
  'courses',
  'skills',
  'publications',
] as const;

describe('cvSections 描述符（T-20 表征）', () => {
  it('分区顺序与 T-17 硬编码基线逐项一致', () => {
    expect(cvSections.map((s) => s.id)).toEqual([...GOLDEN_ORDER]);
  });

  it('分区 id 唯一（正文锚点与目录共用，不允许重复）', () => {
    const ids = cvSections.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('当前 zh/en 数据下可见分区与基线一致（renderIf 谓词即原 toc.show 条件）', () => {
    for (const lang of ['zh', 'en'] as const) {
      const cv = CV_BY_LANG[lang];
      expect(cvSections.filter((s) => s.renderIf(cv)).map((s) => s.id)).toEqual([...GOLDEN_VISIBLE]);
    }
  });

  it('标题 key 与基线逐项一致', () => {
    const expected: Record<string, string> = {
      education: 'cv.education',
      experience: 'cv.experience',
      awards: 'cv.awards',
      grants: 'cv.grants',
      projects: 'cv.projects',
      patents: 'cv.patents',
      courses: 'cv.courses',
      teaching: 'cv.teaching',
      service: 'cv.service',
      skills: 'cv.skills',
      publications: 'cv.publications',
    };
    for (const s of cvSections) {
      expect(s.titleKey, `分区 ${s.id} 的 titleKey 漂移`).toBe(expected[s.id]);
    }
  });

  it('现状怪癖表征：education 唯一带 emptyHint 与 style="margin-top:0"，其余无', () => {
    for (const s of cvSections) {
      if (s.id === 'education') {
        expect(s.renderer === 'timeline' && s.emptyHint === true).toBe(true);
        expect(s.style).toBe('margin-top:0');
      } else {
        expect(s.style, `${s.id} 不应有 style`).toBeUndefined();
        if (s.renderer === 'timeline') {
          expect(s.emptyHint, `${s.id} 不应有 emptyHint`).toBeUndefined();
        }
      }
    }
  });

  it('publications 无条件渲染且数据源不在 CvData（source: "publications" 特例）', () => {
    const pubs = cvSections.find((s) => s.id === 'publications');
    expect(pubs?.renderer).toBe('publications');
    expect(pubs?.source).toBe('publications');
  });
});

describe('渲染器 key 封闭集合与确定性失败（T-20 新增行为锁）', () => {
  it('cvSections 的 renderer key 全部在封闭集合内', () => {
    for (const s of cvSections) {
      expect(isCvSectionRenderer(s.renderer), `${s.id} → ${s.renderer}`).toBe(true);
    }
  });

  it('isCvSectionRenderer 对未知 key 返回 false', () => {
    expect(isCvSectionRenderer('timeline')).toBe(true);
    expect(isCvSectionRenderer('patents')).toBe(true);
    expect(isCvSectionRenderer('nonexistent')).toBe(false);
    expect(isCvSectionRenderer('')).toBe(false);
  });

  it('assertKnownCvSectionRenderer：未知 key 构建 throw（拒绝静默跳过）', () => {
    expect(() => assertKnownCvSectionRenderer({ id: 'faq', renderer: 'nonexistent' })).toThrow(
      /\[cvSections\] 分区 "faq" 的 renderer "nonexistent" 不在 CV_SECTION_RENDERERS/,
    );
  });

  it('assertKnownCvSectionRenderer：合法 key 不 throw（覆盖集合内全部 key）', () => {
    expect(() => {
      for (const r of CV_SECTION_RENDERERS) {
        assertKnownCvSectionRenderer({ id: `probe-${r}`, renderer: r });
      }
    }).not.toThrow();
  });
});
