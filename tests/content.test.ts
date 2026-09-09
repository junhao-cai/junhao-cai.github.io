/**
 * 表征测试（characterization tests）— src/lib/content.ts（Content Facade，Wave 4 T-15）
 * ---------------------------------------------------------------------------
 * 证明「门面 === 底层」：每个 load* 都必须是零逻辑纯委托，逐函数与底层事实源
 * 做双重断言 —— 同一性（toBe，引用相同）与深度等价（toEqual）。双语 zh/en 各测；
 * 数组另加长度一致断言；loadPublications/loadSelectedPublications 另与
 * fs 直读 pubs.bib 的 parseBibtex+sortEntries 结果比对（复用 bibtex.test.ts 思路）。
 * 门面零逻辑的反向证明：任何在门面内做变换/缓存的变异（如 loadNews 返回空数组）
 * 都必须让本文件变红 —— 该变异验证已手工执行并转录于任务收据。
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  loadProfile,
  loadNews,
  loadContact,
  loadCv,
  loadPublications,
  loadSelectedPublications,
} from '../src/lib/content';
import type { Lang, ProfileI18N, NewsItem, CvData, Entry, Author } from '../src/lib/content';
import { profile, news, CONTACT } from '../src/site.config';
import { cvData } from '../src/data/cv';
import { PUBLICATIONS, SELECTED_PUBLICATIONS } from '../src/lib/publications';
import { parseBibtex, sortEntries, type Entry as BibtexEntry } from '../src/lib/bibtex';

/** 类型再导出可用性的编译期使用点（astro check 兜底，运行时仅为占位断言） */
const _typeProbe: { lang: Lang; profile: ProfileI18N; news: NewsItem[]; cv: CvData; entry: Entry | BibtexEntry; author: Author | Entry['authors'][number] } | null = null;
expect(_typeProbe).toBeNull();

describe('Content Facade · loadProfile（委托 site.config.profile）', () => {
  it.each(['zh', 'en'] as const)('loadProfile(%s) 与底层 profile(%s) 同一引用', (lang) => {
    expect(loadProfile(lang)).toBe(profile(lang));
  });
  it.each(['zh', 'en'] as const)('loadProfile(%s) 与底层 profile(%s) 深度等价', (lang) => {
    expect(loadProfile(lang)).toEqual(profile(lang));
  });
});

describe('Content Facade · loadNews（委托 site.config.news）', () => {
  it.each(['zh', 'en'] as const)('loadNews(%s) 与底层 news(%s) 同一引用', (lang) => {
    expect(loadNews(lang)).toBe(news(lang));
  });
  it.each(['zh', 'en'] as const)('loadNews(%s) 与底层 news(%s) 深度等价且长度一致', (lang) => {
    const viaFacade = loadNews(lang);
    const viaSource = news(lang);
    expect(viaFacade.length).toBe(viaSource.length);
    expect(viaFacade).toEqual(viaSource);
  });
});

describe('Content Facade · loadContact（语言中立，委托 site.config.CONTACT）', () => {
  it('loadContact() 与底层 CONTACT 同一引用', () => {
    expect(loadContact()).toBe(CONTACT);
  });
  it('loadContact() 与底层 CONTACT 深度等价且长度一致', () => {
    const viaFacade = loadContact();
    expect(viaFacade.length).toBe(CONTACT.length);
    expect(viaFacade).toEqual(CONTACT);
  });
});

describe('Content Facade · loadCv（委托 cv.cvData）', () => {
  it.each(['zh', 'en'] as const)('loadCv(%s) 与底层 cvData(%s) 同一引用', (lang) => {
    expect(loadCv(lang)).toBe(cvData(lang));
  });
  it.each(['zh', 'en'] as const)('loadCv(%s) 与底层 cvData(%s) 深度等价且各区块长度一致', (lang) => {
    const viaFacade = loadCv(lang);
    const viaSource = cvData(lang);
    for (const section of Object.keys(viaSource) as Array<keyof CvData>) {
      expect(viaFacade[section].length).toBe(viaSource[section].length);
    }
    expect(viaFacade).toEqual(viaSource);
  });
});

describe('Content Facade · loadPublications（委托 publications.PUBLICATIONS）', () => {
  it('loadPublications() 与底层 PUBLICATIONS 同一引用', () => {
    expect(loadPublications()).toBe(PUBLICATIONS);
  });
  it('loadPublications() 与底层 PUBLICATIONS 深度等价且长度一致', () => {
    const viaFacade = loadPublications();
    expect(viaFacade.length).toBe(PUBLICATIONS.length);
    expect(viaFacade).toEqual(PUBLICATIONS);
  });
  it('loadPublications() 与 fs 直读 pubs.bib 的 parseBibtex+sortEntries 数量一致且深度等价', () => {
    const bibPath = fileURLToPath(new URL('../src/data/pubs.bib', import.meta.url));
    const parsed = sortEntries(parseBibtex(readFileSync(bibPath, 'utf-8')));
    const viaFacade = loadPublications();
    expect(viaFacade.length).toBe(parsed.length);
    expect(viaFacade).toEqual(parsed);
  });
});

describe('Content Facade · loadSelectedPublications（委托 publications.SELECTED_PUBLICATIONS）', () => {
  it('loadSelectedPublications() 与底层 SELECTED_PUBLICATIONS 同一引用', () => {
    expect(loadSelectedPublications()).toBe(SELECTED_PUBLICATIONS);
  });
  it('loadSelectedPublications() 与底层 SELECTED_PUBLICATIONS 深度等价且长度一致', () => {
    const viaFacade = loadSelectedPublications();
    expect(viaFacade.length).toBe(SELECTED_PUBLICATIONS.length);
    expect(viaFacade).toEqual(SELECTED_PUBLICATIONS);
  });
  it('loadSelectedPublications() 是 loadPublications() 的 selected 子集（长度不超全集且逐条 selected）', () => {
    const selected = loadSelectedPublications();
    const all = loadPublications();
    expect(selected.length).toBeLessThanOrEqual(all.length);
    expect(selected.length).toBeGreaterThan(0);
    for (const e of selected) expect(e.selected).toBe(true);
  });
});
