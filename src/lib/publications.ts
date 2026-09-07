import bibSource from '../data/pubs.bib?raw';
import { parseBibtex, sortEntries, type Entry, type Author } from './bibtex';
import { SELF_NAME_VARIANTS } from '../data/cv';

/** 构建时一次性解析，结果被所有页面共享（Astro 会做模块级缓存） */
export const PUBLICATIONS: Entry[] = sortEntries(parseBibtex(bibSource));

const norm = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
const SELF_SET = new Set(SELF_NAME_VARIANTS.map(norm).filter(Boolean));

/** 判断某位作者是否为本人的署名变体 */
export function isSelfAuthor(a: Author): boolean {
  if (SELF_SET.size === 0) return false;
  const candidates = [a.full, a.last, `${a.first} ${a.last}`, `${a.last}, ${a.first}`];
  return candidates.some((c) => SELF_SET.has(norm(c)));
}

/** 判断某位作者是否为本文的通讯作者（在 corresponding 列表中） */
export function isCorrespondingAuthor(a: Author, corresponding: string[]): boolean {
  if (!corresponding.length) return false;
  const set = new Set(corresponding.map(norm).filter(Boolean));
  const candidates = [a.full, a.last, `${a.first} ${a.last}`, `${a.last}, ${a.first}`];
  return candidates.some((c) => set.has(norm(c)));
}

/** 本人（蔡君豪）是否为该文的通讯作者 */
export function selfIsCorresponding(e: Entry): boolean {
  return e.corresponding.some((c) => SELF_SET.has(norm(c)));
}

function byType(type: string): Entry[] {
  return PUBLICATIONS.filter((e) => e.type === type);
}

export const PUBLICATIONS_BY_TYPE: Array<{ type: string; label: string; items: Entry[] }> = [];
export const PUBLICATIONS_YEARS: number[] = [
  ...new Set(PUBLICATIONS.map((e) => e.year).filter((y): y is number => y !== null)),
].sort((a, b) => b - a);

export const SELECTED_PUBLICATIONS = PUBLICATIONS.filter((e) => e.selected);

/** 论文关键词去重后的标签云 */
export function publicationTags(): Array<{ tag: string; count: number }> {
  const counter = new Map<string, number>();
  for (const e of PUBLICATIONS) {
    for (const t of e.tags) counter.set(t, (counter.get(t) ?? 0) + 1);
  }
  return [...counter.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
}

export function linkFor(e: Entry): string | undefined {
  if (e.doi) return `https://doi.org/${e.doi}`;
  if (e.arxiv) return `https://arxiv.org/abs/${e.arxiv}`;
  return e.url || undefined;
}

export const TYPE_LABELS_ZH: Record<string, string> = {
  journal: '期刊论文',
  conference: '会议论文',
  preprint: '预印本',
  chapter: '书章',
  book: '专著',
  thesis: '学位论文',
  other: '其他',
};

export const TYPE_ORDER = [
  'preprint',
  'journal',
  'conference',
  'chapter',
  'book',
  'thesis',
  'other',
];

export { byType };
export type { Entry, Author };
