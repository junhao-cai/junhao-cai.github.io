/**
 * 零依赖 BibTeX 解析器
 * ---------------------------------------------------------------------------
 * 支持：@article / @inproceedings / @book / @incollection / @phdthesis /
 *      @mastersthesis / @misc / @preprint；@string 宏；嵌套花括号；引号值；
 *      裸数值；LaTeX 重音与转义还原；`Last, First and ...` 作者格式。
 *
 * 不追求完整实现 BibTeX 语法（那需要 TeX），只保证 Zotero / Google Scholar /
 * DBLP 导出的 .bib 能被正确吃掉 —— 这覆盖了 99% 的真实使用场景。
 */

export interface Author {
  first: string;
  last: string;
  /** 作者全名，用于别名匹配 */
  full: string;
}

export interface Entry {
  key: string;
  type: string;
  title: string;
  authors: Author[];
  year: number | null;
  /** journal / booktitle / publisher / school 按类型择优 */
  venue: string;
  volume: string;
  number: string;
  pages: string;
  publisher: string;
  doi: string;
  url: string;
  arxiv: string;
  pdf: string;
  code: string;
  slide: string;
  abstract: string;
  note: string;
  award: string;
  tags: string[];
  /** 通讯作者姓名列表（自定义字段 corresponding = {Cai, Junhao and ...}） */
  corresponding: string[];
  /** 是否在 CV 页置顶展示 */
  selected: boolean;
  /** 原始条目文本，用于「复制 BibTeX」 */
  raw: string;
}

type Fields = Record<string, string>;

// ---------------------------------------------------------------------------
// 词法：切分条目
// ---------------------------------------------------------------------------

function matchBrace(src: string, start: number): number {
  let depth = 0;
  let inQuote = false;
  for (let i = start; i < src.length; i++) {
    const ch = src[i];
    if (ch === '\\') {
      i++;
      continue;
    }
    if (ch === '"') {
      inQuote = !inQuote;
      continue;
    }
    if (inQuote) continue;
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

interface RawEntry {
  type: string;
  key: string;
  body: string;
  raw: string;
}

function splitEntries(src: string): RawEntry[] {
  const out: RawEntry[] = [];
  const re = /@([A-Za-z]+)\s*\{/g;
  for (let m; (m = re.exec(src)) !== null; ) {
    const type = m[1].toLowerCase();
    const open = m.index + m[0].length - 1;
    const close = matchBrace(src, open);
    if (close < 0) break;
    const inner = src.slice(open + 1, close);
    const raw = src.slice(m.index, close + 1).trim();

    if (type === 'comment' || type === 'preamble') continue;

    if (type === 'string') {
      // 形如  @string{jml = {Journal of Machine Learning}}
      const eq = inner.indexOf('=');
      if (eq > 0) {
        STRING_MACROS[inner.slice(0, eq).trim().toLowerCase()] = unwrap(
          inner.slice(eq + 1).trim()
        );
      }
      re.lastIndex = close;
      continue;
    }

    const comma = inner.indexOf(',');
    const key = (comma > 0 ? inner.slice(0, comma) : inner).trim();
    const body = comma > 0 ? inner.slice(comma + 1) : '';
    out.push({ type, key, body, raw });
    re.lastIndex = close;
  }
  return out;
}

const STRING_MACROS: Record<string, string> = {};

// ---------------------------------------------------------------------------
// 词法：切分字段
// ---------------------------------------------------------------------------

function parseFields(body: string): Fields {
  const fields: Fields = {};
  let i = 0;
  const n = body.length;

  // 跳到第一个 '='
  const skipToEquals = () => {
    let depth = 0;
    let inQuote = false;
    while (i < n) {
      const ch = body[i];
      if (ch === '\\') {
        i += 2;
        continue;
      }
      if (ch === '"') inQuote = !inQuote;
      else if (!inQuote && ch === '{') depth++;
      else if (!inQuote && ch === '}') depth--;
      else if (!inQuote && depth === 0 && ch === '=') return true;
      else if (!inQuote && depth === 0 && ch === '}' ) return false; // 条目结束
      i++;
    }
    return false;
  };

  while (i < n) {
    // 读字段名
    const nameStart = i;
    if (!skipToEquals()) break;
    const name = body.slice(nameStart, i).trim().toLowerCase().replace(/[\s,]+$/, '');
    i++; // 跳过 '='

    // 跳过空白
    while (i < n && /\s/.test(body[i])) i++;

    // 读值：花括号 / 引号 / 裸值
    let value = '';
    if (body[i] === '{') {
      const close = matchBrace(body, i);
      if (close < 0) break;
      value = body.slice(i + 1, close);
      i = close + 1;
    } else if (body[i] === '"') {
      let j = i + 1;
      let buf = '';
      let depth = 0;
      while (j < n) {
        if (body[j] === '\\') {
          buf += body[j] + (body[j + 1] ?? '');
          j += 2;
          continue;
        }
        if (body[j] === '{') depth++;
        else if (body[j] === '}') depth--;
        else if (body[j] === '"' && depth === 0) break;
        buf += body[j];
        j++;
      }
      value = buf;
      i = j + 1;
    } else {
      const j = body.indexOf(',', i);
      const stop = j < 0 ? n : j;
      value = body.slice(i, stop).trim();
      i = stop;
    }

    // 处理 # 拼接（BibTeX 字符串连接）
    value = value
      .split('#')
      .map((part) => {
        const t = part.trim();
        if (/^".*"$/.test(t)) return t.slice(1, -1);
        if (/^\{.*\}$/.test(t)) return t.slice(1, -1);
        return STRING_MACROS[t.toLowerCase()] ?? t;
      })
      .join('');

    if (name) fields[name] = value.trim();

    // 跳到下一个逗号
    while (i < n && body[i] !== ',') i++;
    i++;
  }

  return fields;
}

function unwrap(v: string): string {
  const t = v.trim();
  if (t.startsWith('{') && t.endsWith('}')) return t.slice(1, -1);
  if (t.startsWith('"') && t.endsWith('"')) return t.slice(1, -1);
  return t;
}

// ---------------------------------------------------------------------------
// LaTeX → 纯文本
// ---------------------------------------------------------------------------

const ACCENTS: Record<string, string> = {
  '`': '\u0300', "'": '\u0301', '^': '\u0302', '"': '\u0308',
  '~': '\u0303', '=': '\u0304', '.': '\u0307', u: '\u0306',
  v: '\u030C', H: '\u030B', c: '\u0327', k: '\u0328', r: '\u030A',
  b: '\u0331', d: '\u0323',
};

const LIGATURES: Array<[RegExp, string]> = [
  [/\\o\b/g, 'ø'],
  [/\\O\b/g, 'Ø'],
  [/\\aa\b/g, 'å'],
  [/\\AA\b/g, 'Å'],
  [/\\ae\b/g, 'æ'],
  [/\\AE\b/g, 'Æ'],
  [/\\ss\b/g, 'ß'],
  [/\\l\b/g, 'ł'],
  [/\\L\b/g, 'Ł'],
  [/\\i\b/g, 'ı'],
  [/\\j\b/g, 'ȷ'],
];

function decodeLatex(input: string): string {
  let s = input;

  // 重音符：{\"o} {\'e} {\^{a}} 以及无花括号形式 \~n
  s = s.replace(/\\([`'"^~=.`udHckrbv])\s*\{?([A-Za-z])\}?/g, (_m, acc, ch) => {
    const mark = ACCENTS[acc];
    const base = acc === 'i' && ch === 'i' ? 'ı' : ch;
    return mark ? base + mark : base;
  });

  for (const [re, rep] of LIGATURES) s = s.replace(re, rep);

  // 常见宏
  s = s.replace(/\\(?:emph|textit|textsl|mbox|mathrm)\{([^{}]*)\}/g, '$1');
  s = s.replace(/\\(?:textbf|texttt|textsc|textup)\{([^{}]*)\}/g, '$1');
  s = s.replace(/\\textsuperscript\{([^{}]*)\}/g, '$1');
  s = s.replace(/\\(?:href|url)\{([^{}]*)\}/g, '$1');

  // 特殊字符转义
  s = s.replace(/\\&/g, '&').replace(/\\%/g, '%').replace(/\\\$/g, '$');
  s = s.replace(/\\#/g, '#').replace(/\\_/g, '_').replace(/\\\{/g, '{');
  s = s.replace(/\\\}/g, '}');

  // 破折号
  s = s.replace(/---/g, '—').replace(/--/g, '–');

  // 数学模式：剥掉 $...$ 并尽量保留可读文本
  s = s.replace(/\$([^$]*)\$/g, (_m, inner: string) =>
    inner.replace(/\\(?:times|cdot)/g, '×').replace(/\\(?:pm|pm)/g, '±').replace(/[\\{}]/g, '')
  );

  // 剩余未知宏：\foo{bar} → bar，\foo → ''
  s = s.replace(/\\[A-Za-z]+\{([^{}]*)\}/g, '$1');
  s = s.replace(/\\[A-Za-z]+\s*/g, '');

  // 残留花括号（BibTeX 用它保护大小写）
  s = s.replace(/[{}]/g, '');

  // LaTeX 双单引号 → 弯引号
  s = s.replace(/``/g, '“').replace(/''/g, '”');

  return s.replace(/\s+/g, ' ').trim();
}

// ---------------------------------------------------------------------------
// 作者
// ---------------------------------------------------------------------------

export function parseAuthors(raw: string): Author[] {
  if (!raw) return [];
  // 只在外层 " and " 切分，避免误伤名字内部
  const parts: string[] = [];
  let depth = 0;
  let buf = '';
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];
    if (ch === '{') depth++;
    else if (ch === '}') depth--;
    if (depth === 0 && /\s/.test(raw[i]) && raw.slice(i, i + 5).toLowerCase() === ' and ') {
      parts.push(buf);
      buf = '';
      i += 4;
      continue;
    }
    buf += ch;
  }
  parts.push(buf);

  return parts
    .map((p) => decodeLatex(p.trim()))
    .filter(Boolean)
    .map((full) => {
      if (full.includes(',')) {
        const [last, ...rest] = full.split(',');
        return { last: last.trim(), first: rest.join(',').trim(), full };
      }
      const words = full.split(/\s+/);
      const last = words.length > 1 ? words[words.length - 1] : '';
      const first = words.slice(0, -1).join(' ');
      return { last, first, full };
    });
}

function initials(first: string): string {
  return first
    .split(/[\s.\-]+/)
    .filter(Boolean)
    .map((w) => (/^[一-龥]$/.test(w) ? w : w[0].toUpperCase() + '.'))
    .join(' ');
}

// ---------------------------------------------------------------------------
// 组装
// ---------------------------------------------------------------------------

const TYPE_ALIASES: Record<string, string> = {
  article: 'journal',
  inproceedings: 'conference',
  conference: 'conference',
  proceedings: 'conference',
  incollection: 'chapter',
  inbook: 'chapter',
  book: 'book',
  phdthesis: 'thesis',
  mastersthesis: 'thesis',
  thesis: 'thesis',
  misc: 'other',
  preprint: 'preprint',
};

function pick(fields: Fields, ...names: string[]): string {
  for (const n of names) {
    if (fields[n]) return decodeLatex(fields[n]);
  }
  return '';
}

function toEntry(re: RawEntry): Entry {
  const f = parseFields(re.body);

  const venue =
    pick(f, 'journal', 'journaltitle', 'booktitle', 'series', 'school', 'institution', 'publisher', 'howpublished') ||
    '';

  const yearRaw = pick(f, 'year');
  const year = yearRaw && /^\d{3,4}$/.test(yearRaw) ? Number(yearRaw) : null;

  const tags = [
    ...(pick(f, 'keywords', 'tags', 'keyword')
      .split(/[,;]/)
      .map((s) => s.trim())
      .filter(Boolean)),
  ];

  return {
    key: re.key,
    type: TYPE_ALIASES[re.type] ?? re.type,
    title: pick(f, 'title') || '(无标题)',
    authors: parseAuthors(pick(f, 'author', 'editor')),
    year,
    venue,
    volume: pick(f, 'volume'),
    number: pick(f, 'number'),
    pages: pick(f, 'pages').replace(/--?/g, '–'),
    publisher: pick(f, 'publisher', 'school', 'institution'),
    doi: pick(f, 'doi').replace(/^https?:\/\/(dx\.)?doi\.org\//i, ''),
    url: pick(f, 'url'),
    arxiv: pick(f, 'arxiv', 'eprint'),
    pdf: pick(f, 'pdf', 'file'),
    code: pick(f, 'code'),
    slide: pick(f, 'slide'),
    abstract: pick(f, 'abstract'),
    note: pick(f, 'note'),
    award: pick(f, 'award'),
    tags,
    corresponding: splitCorresponding(pick(f, 'corresponding')),
    selected: /^(true|yes|1)$/i.test(pick(f, 'selected')),
    raw: re.raw,
  };
}

/** 解析整个 .bib 文本 */
export function parseBibtex(source: string): Entry[] {
  return splitEntries(source).map(toEntry);
}

// ---------------------------------------------------------------------------
// 引用格式化
// ---------------------------------------------------------------------------

export type CiteStyle = 'apa' | 'ieee' | 'mla';

function authorListApa(authors: Author[]): string {
  const names = authors.map((a) => `${a.last}, ${initials(a.first)}`);
  if (names.length === 0) return '';
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]}, & ${names[1]}`;
  return `${names.slice(0, -1).join(', ')}, & ${names[names.length - 1]}`;
}

/** 把 corresponding 字段拆成姓名数组（支持 "A and B" 或 "A, B"） */
function splitCorresponding(raw: string): string[] {
  if (!raw) return [];
  // BibTeX 多作者用 " and " 分隔；姓名内部的 "Last, First" 逗号不是分隔符，
  // 否则会把 "Cai, Junhao" 错误地拆成两个人。
  return raw
    .split(/\s+and\s+/i)
    .map((s) => decodeLatex(s.trim()))
    .filter(Boolean);
}

function authorListIeee(authors: Author[]): string {
  const names = authors.map((a) => `${initials(a.first)} ${a.last}`);
  if (names.length === 0) return '';
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(', ')}, and ${names[names.length - 1]}`;
}

export function formatCitation(e: Entry, style: CiteStyle): string {
  const venue = e.venue ? `*${e.venue}*` : '';
  const doiLink = e.doi ? ` https://doi.org/${e.doi}` : e.url ? ` ${e.url}` : '';

  if (style === 'ieee') {
    const parts = [
      `${authorListIeee(e.authors)}.`,
      `"${e.title},"`,
      venue ? `${venue},` : '',
      e.volume ? `vol. ${e.volume},` : '',
      e.number ? `no. ${e.number},` : '',
      e.pages ? `pp. ${e.pages},` : '',
      e.publisher && e.type === 'thesis' ? `${e.publisher},` : '',
      `${e.year ?? 'n.d.'}.`,
    ].filter(Boolean);
    return parts.join(' ') + (doiLink ? doiLink : '');
  }

  if (style === 'mla') {
    const first = e.authors[0];
    const head = e.authors.length > 2
      ? `${first?.last ?? ''}, et al`
      : e.authors.map((a) => a.last).join(' and ');
    return [
      `${head}.`,
      `"${e.title}."`,
      venue ? `${venue},` : '',
      e.volume ? `vol. ${e.volume},` : '',
      e.number ? `no. ${e.number},` : '',
      e.year ?? 'n.d.',
      e.pages ? `pp. ${e.pages}.` : '.',
    ]
      .filter(Boolean)
      .join(' ');
  }

  // APA（默认）
  const venueLine = [
    venue,
    e.volume ? `*${e.volume}*` : '',
    e.number && e.volume ? `(${e.number})` : '',
    e.pages ? `${e.pages}` : '',
  ]
    .filter(Boolean)
    .join(e.volume ? ', ' : ', ');

  return [
    `${authorListApa(e.authors)} (${e.year ?? 'n.d.'}).`,
    `${e.title}.`,
    venueLine ? `${venueLine}.` : '',
    e.publisher && e.type === 'thesis' ? `${e.publisher}.` : '',
    doiLink.trim(),
  ]
    .filter(Boolean)
    .join(' ');
}

/** 按年份倒序、同年内按给定顺序稳定排序 */
export function sortEntries(entries: Entry[]): Entry[] {
  return [...entries].sort((a, b) => {
    const ya = a.year ?? 0;
    const yb = b.year ?? 0;
    if (ya !== yb) return yb - ya;
    return a.key.localeCompare(b.key);
  });
}

export function groupByYear(entries: Entry[]): Array<[number | null, Entry[]]> {
  const map = new Map<number | null, Entry[]>();
  for (const e of sortEntries(entries)) {
    const arr = map.get(e.year) ?? [];
    arr.push(e);
    map.set(e.year, arr);
  }
  return [...map.entries()];
}

export const TYPE_LABELS: Record<string, string> = {
  journal: '期刊论文',
  conference: '会议论文',
  preprint: '预印本',
  chapter: '书章',
  book: '专著',
  thesis: '学位论文',
  other: '其他',
};

export const TYPE_ORDER = ['preprint', 'journal', 'conference', 'chapter', 'book', 'thesis', 'other'];
