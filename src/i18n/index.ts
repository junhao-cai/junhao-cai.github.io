/**
 * 轻量 i18n 层
 * ---------------------------------------------------------------------------
 * 中文为默认语言且不带前缀（/ 根路径），英文走 /en/ 前缀。
 * 这样既有 URL 完全不变，SEO 与已分享链接零影响。
 *
 * 依赖方向（D9）：本层可依赖 src/lib/base.ts（Base Authority）；反向禁止。
 */

import { stripBase } from '../lib/base';

export const LANGS = ['zh', 'en'] as const;
export type Lang = (typeof LANGS)[number];

export const DEFAULT_LANG: Lang = 'zh';

/** BCP 47 标签，用于 <html lang> 与日期格式化 */
export const LANG_TAG: Record<Lang, string> = {
  zh: 'zh-CN',
  en: 'en',
};

/** 从 URL 判断当前语言：/en/... → en，其余 → zh */
export function getLangFromUrl(url: URL | string): Lang {
  const path = typeof url === 'string' ? url : url.pathname;
  const seg = path.split('/').filter(Boolean)[0];
  return seg === 'en' ? 'en' : 'zh';
}

/** 给路径加语言前缀：英文加 /en，中文去掉 /en */
export function withLang(path: string, lang: Lang): string {
  const clean = path === '/' ? '/' : path.replace(/\/+$/, '');
  if (lang === 'en') {
    return clean === '/' ? '/en/' : `/en${clean}/`;
  }
  const stripped = clean.replace(/^\/en(\/|$)/, '/');
  return stripped === '' ? '/' : stripped.endsWith('/') ? stripped : `${stripped}/`;
}

/**
 * 把当前页面路径切到另一语言（用于语言切换按钮）。
 * 经 base.ts stripBase() 去掉 BASE_URL，避免项目页部署时语言链接变成 /base/en/base/... 。
 * withLang 不走 base.ts localizedPath：zh 方向「剥 /en」的语义是 i18n 层自有职责
 * （localizedPath 的 zh 是恒等），T-09 明确不迁。
 */
export function switchLangPath(pathname: string, target: Lang): string {
  const relative = stripBase(pathname).replace(/\/+$/, '') || '/';
  return withLang(relative, target);
}

/** 界面文案字典 */
const DICT = {
  zh: {
    'nav.home': '首页',
    'nav.cv': '简历',
    'nav.publications': '论文',
    'nav.blog': '笔记',
    'nav.tags': '标签',
    'nav.about': '关于',

    'site.skipToContent': '跳到正文',
    'action.search': '搜索',
    'action.searchHint': '搜索全站内容',
    'action.menu': '菜单',
    'action.toggleLang': 'English',
    'action.toggleLangAria': '切换到英文版',

    'home.news': '动态',
    'home.rss': 'RSS 订阅',
    'home.selectedPubs': '精选论文',
    'home.allPubs': (n: number) => `全部 ${n} 篇`,
    'home.eduExp': '教育与经历',
    'home.fullCv': '更多',
    'home.recentPosts': '最近笔记',
    'home.all': '全部',
    'home.keywords': '研究关键词',
    'home.contact': '联系方式',
    'home.courses': '主讲课程',
    'home.viewCv': '查看完整简历',
    'home.pubList': '论文列表',
    'home.view': '查看',

    'cv.education': '教育经历',
    'cv.experience': '工作与访问经历',
    'cv.awards': '荣誉与奖励',
    'cv.grants': '科研项目',
    'cv.teaching': '教学',
    'cv.service': '学术服务',
    'cv.skills': '技能',
    'cv.projects': '项目',
    'cv.patents': '专利',
    'cv.courses': '主讲课程',
    'cv.publications': '发表论文',
    'cv.pubCount': (n: number, from: string, to: string) => `共 ${n} 篇 · ${from}–${to}`,
    'cv.downloadBib': '下载 .bib',
    'cv.of': (a: string, b: string) => `${a} 的${b}`,

    'pub.title': '论文',
    'pub.filterAll': '全部',
    'pub.filterByTag': '按关键词筛选',
    'pub.filterYear': '年份',
    'pub.filterTag': '关键词',
    'pub.multiHint': 'Ctrl / ⌘ + 点击可多选',
    'pub.corrNote': '† 通讯作者',
    'pub.cite': '引用',
    'pub.copyCite': '复制引用',
    'pub.copied': '已复制',
    'pub.bibtex': 'BibTeX',
    'pub.pdf': 'PDF',
    'pub.code': '代码',
    'pub.slides': '幻灯片',
    'pub.award': '获奖',
    'pub.selected': '精选',
    'pub.abstract': '摘要',
    'pub.link': '链接',
    'pub.typeJournal': '期刊',
    'pub.typeConference': '会议',
    'pub.typePreprint': '预印本',
    'pub.typeChapter': '书章',
    'pub.typeBook': '专著',
    'pub.typeThesis': '学位',
    'pub.typeOther': '其他',
    'pub.count': (n: number) => `${n} 篇`,
    'pub.none': '暂无论文。',
    'pub.statsTotal': '总数',
    'pub.statsFirst': '一作',
    'pub.statsCorr': '通讯',
    'pub.statsSpan': '年份跨度',
    'pub.seeCv': '完整简历见',
    'pub.cvPage': '简历页',
    'pub.citeExample': '引用格式示例（APA）：',

    'blog.title': '笔记',
    'blog.desc': '研究笔记与技术随笔',
    'blog.prev': '上一页',
    'blog.next': '下一页',
    'blog.page': (a: number, b: number) => `第 ${a} / ${b} 页`,
    'blog.empty': '暂无文章。',
    'blog.zhOnly': '本文暂无英文版本',

    'post.toc': '本页目录',
    'post.tocHint': '滚动时自动高亮',
    'post.updated': '更新于',
    'post.published': '发布于',
    'post.backTop': '回到顶部',
    'post.prevPost': '上一篇',
    'post.nextPost': '下一篇',
    'post.readMore': '继续阅读',

    'tags.title': '标签',
    'tags.count': (n: number) => `${n} 篇`,
    'tags.empty': '暂无标签。',

    'search.title': '搜索',
    'search.placeholder': '输入关键词…',
    'search.empty': '输入关键词开始搜索',
    'search.noResult': '没有找到匹配内容',
    'search.indexMissing': '搜索索引需要构建后生成',

    'notfound.title': '页面不存在',
    'notfound.desc': '这个地址没有对应内容，可能是链接过期或输入有误。',
    'notfound.home': '返回首页',

    'footer.rss': 'RSS',
    'footer.sitemap': '站点地图',
    'footer.builtWith': '基于 Astro 构建',
    'footer.backTop': '回到顶部',
    'footer.visits': '总访问量',
    'footer.visitors': '总访客数',
  },

  en: {
    'nav.home': 'Home',
    'nav.cv': 'CV',
    'nav.publications': 'Publications',
    'nav.blog': 'Notes',
    'nav.tags': 'Tags',
    'nav.about': 'About',

    'site.skipToContent': 'Skip to content',
    'action.search': 'Search',
    'action.searchHint': 'Search this site',
    'action.toggleLang': '中文',
    'action.toggleLangAria': 'Switch to Chinese version',

    'home.news': 'News',
    'home.rss': 'RSS feed',
    'home.selectedPubs': 'Selected Publications',
    'home.allPubs': (n: number) => `All ${n}`,
    'home.eduExp': 'Education & Experience',
    'home.fullCv': 'More',
    'home.recentPosts': 'Recent Notes',
    'home.all': 'All',
    'home.keywords': 'Research Keywords',
    'home.contact': 'Contact',
    'home.courses': 'Courses',
    'home.viewCv': 'View full CV',
    'home.pubList': 'Publications',
    'home.view': 'View',

    'cv.education': 'Education',
    'cv.experience': 'Positions & Visits',
    'cv.awards': 'Awards',
    'cv.grants': 'Grants',
    'cv.teaching': 'Teaching',
    'cv.service': 'Academic Service',
    'cv.skills': 'Skills',
    'cv.projects': 'Projects',
    'cv.patents': 'Patents',
    'cv.courses': 'Courses Taught',
    'cv.publications': 'Publications',
    'cv.pubCount': (n: number, from: string, to: string) => `${n} total · ${from}–${to}`,
    'cv.downloadBib': 'Download .bib',
    'cv.of': (a: string, b: string) => `${b} of ${a}`,

    'pub.title': 'Publications',
    'pub.filterAll': 'All',
    'pub.filterByTag': 'Filter by keyword',
    'pub.filterYear': 'Year',
    'pub.filterTag': 'Keywords',
    'pub.multiHint': 'Ctrl / ⌘ + click to multi-select',
    'pub.corrNote': '† Corresponding author',
    'pub.cite': 'Cite',
    'pub.copyCite': 'Copy citation',
    'pub.copied': 'Copied',
    'pub.bibtex': 'BibTeX',
    'pub.pdf': 'PDF',
    'pub.code': 'Code',
    'pub.slides': 'Slides',
    'pub.award': 'Award',
    'pub.selected': 'Selected',
    'pub.abstract': 'Abstract',
    'pub.link': 'Link',
    'pub.typeJournal': 'Journal',
    'pub.typeConference': 'Conference',
    'pub.typePreprint': 'Preprint',
    'pub.typeChapter': 'Chapter',
    'pub.typeBook': 'Book',
    'pub.typeThesis': 'Thesis',
    'pub.typeOther': 'Other',
    'pub.count': (n: number) => `${n}`,
    'pub.none': 'No publications yet.',
    'pub.statsTotal': 'Total',
    'pub.statsFirst': 'First-author',
    'pub.statsCorr': 'Corresponding',
    'pub.statsSpan': 'Year span',
    'pub.seeCv': 'See the',
    'pub.cvPage': 'CV page',
    'pub.citeExample': 'Citation example (APA):',

    'blog.title': 'Notes',
    'blog.desc': 'Research notes and technical writings',
    'blog.prev': 'Previous',
    'blog.next': 'Next',
    'blog.page': (a: number, b: number) => `Page ${a} / ${b}`,
    'blog.empty': 'No posts yet.',
    'blog.zhOnly': 'English version not available',

    'post.toc': 'On this page',
    'post.tocHint': 'Highlights as you scroll',
    'post.updated': 'Updated',
    'post.published': 'Published',
    'post.backTop': 'Back to top',
    'post.prevPost': 'Previous',
    'post.nextPost': 'Next',
    'post.readMore': 'Read more',

    'tags.title': 'Tags',
    'tags.count': (n: number) => `${n}`,
    'tags.empty': 'No tags yet.',

    'search.title': 'Search',
    'search.placeholder': 'Type keywords…',
    'search.empty': 'Start typing to search',
    'search.noResult': 'No matching content',
    'search.indexMissing': 'Search index is generated after build',

    'notfound.title': 'Page not found',
    'notfound.desc': 'This address does not exist — the link may be outdated or mistyped.',
    'notfound.home': 'Back to home',

    'footer.rss': 'RSS',
    'footer.sitemap': 'Sitemap',
    'footer.builtWith': 'Built with Astro',
    'footer.backTop': 'Back to top',
    'footer.visits': 'Visits',
    'footer.visitors': 'Visitors',
  },
} as const;

export type UIKey = keyof (typeof DICT)['zh'];

/** 取翻译函数；带参数的词条以函数形式调用：t('home.allPubs', 18) */
export function useT(lang: Lang) {
  const table = DICT[lang] ?? DICT[DEFAULT_LANG];
  const fallback = DICT[DEFAULT_LANG];
  return (key: UIKey, ...args: any[]): any => {
    const v = (table as any)[key] ?? (fallback as any)[key] ?? key;
    return typeof v === 'function' ? v(...args) : v;
  };
}
