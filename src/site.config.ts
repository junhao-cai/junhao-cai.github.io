/**
 * =============================================================================
 *  全站唯一的个人信息配置源。改这一个文件就能把站点变成你自己的。
 *  构建时静态注入，不含任何运行时开销。
 *
 *  双语约定：
 *    - 语言中立字段（邮箱 / 头像 / 证件照 / 英文署名 / 平台外链）只在 PROFILE 写一次；
 *    - 需要翻译的字段（姓名 / 机构 / 方向 / 所在地 / 自述 / 动态）写入 *_I18N，
 *      用 profile(lang) / news(lang) 取值。
 * =============================================================================
 */

import type { Lang } from './i18n';

export const SITE = {
  /** 浏览器标签页 / OG 卡片标题（中英通用） */
  title: 'Junhao Cai · Academic Homepage',
  /** 中文站 description */
  description:
    '二维材料与光电子学研究者（国防科技大学）个人主页 —— 论文、经历与笔记。',
  /** 英文站 description */
  descriptionEn:
    'Personal homepage of Junhao Cai — researcher in two-dimensional materials and optoelectronics at NUDT. Publications, CV and notes.',
  /**
   * 部署后的源站地址（不含 base，结尾无斜杠）。影响 RSS / sitemap / canonical / OG。
   * 直接取 Astro 注入的 import.meta.env.SITE（由 deploy.yml 按仓库名推导），再去掉末尾 BASE_URL 子目录，
   * 避免与 absolute() 内部再拼的 BASE_URL 重复（否则会出现 /repo/repo 双 base）。项目页 / 用户页 / 自定义域名均自适应。
   */
  url: (import.meta.env.SITE || 'https://example.github.io')
    .replace(/\/+$/, '')
    .replace(
      new RegExp(
        '/' +
          (import.meta.env.BASE_URL || '/')
            .replace(/^\/+|\/+$/g, '')
            .replace(/[.+?^${}()|[\]\\]/g, '\\$&') +
          '/?$'
      ),
      ''
    ),
  /** 版权起始年份 */
  sinceYear: 2020,
} as const;

/** 顶栏导航所需词条 key（文案见 src/i18n/index.ts 的 nav.*） */
export const NAV: Array<{ key: 'home' | 'cv' | 'publications' | 'blog' | 'tags' | 'about'; path: string }> = [
  { key: 'home', path: '/' },
  { key: 'cv', path: '/cv' },
  { key: 'publications', path: '/publications' },
  { key: 'blog', path: '/blog' },
  { key: 'tags', path: '/tags' },
  { key: 'about', path: '/about' },
];

/** 语言中立的个人信息 */
export const PROFILE = {
  /** 姓名（英文 / 拼音），用于论文署名展示 */
  nameEn: 'Junhao Cai',
  /** 头像，放在 public/ 下，例如 '/avatar.jpg'。仅首页使用 */
  avatar: '/avatar.svg',
  /** 证件照，放在 public/ 下。仅简历页使用；留空则简历页不显示照片 */
  photo: '/photo.jpg',
  /** 联系邮箱 */
  email: 'jh.cai@nudt.edu.cn',
} as const;

/** 需要翻译的个人信息 */
export interface ProfileI18N {
  /** 姓名（本地语言） */
  name: string;
  /** 头衔 + 机构 */
  affiliation: string;
  /** 一句话研究方向 */
  tagline: string;
  /** 所在城市 */
  location: string;
  /** 首页正文自我介绍（支持 **粗体** / `代码` 行内 Markdown） */
  bio: string[];
}

export const PROFILE_I18N: Record<Lang, ProfileI18N> = {
  zh: {
    name: '蔡君豪',
    affiliation: '讲师 · 国防科技大学 前沿交叉学科学院',
    tagline: '石墨烯离子输运 / 二维材料异质结 / 光电子学',
    location: '中国 · 长沙',
    bio: [
      '国防科技大学前沿交叉学科学院讲师。',
      '先后获**清华大学**精密仪器学士学位（2015）、**国防科技大学**光学工程硕士学位（2017）与**英国曼彻斯特大学**纳米科学专业博士学位（2022）。博士期间师从 Marcelo Lozada-Hidalgo 教授与 Irina Grigorieva 教授，从事二维材料离子输运研究，以第一作者在 *Nature Communications*、*Nano Letters* 报道了石墨烯电极上界面水解离的 Wien 效应与光加速现象。',
      '研究兴趣集中在**石墨烯等二维材料中的质子 / 离子输运**、范德华异质结中的质子-电子协同调控、低维光电子器件等。',
    ],
  },
  en: {
    name: 'Junhao Cai',
    affiliation:
      'Lecturer · College of Advanced Interdisciplinary Studies, National University of Defense Technology',
    tagline:
      'Proton/ion transport in 2D materials / proton–electron regulation in vdW heterostructures / optoelectronics',
    location: 'Changsha, China',
    bio: [
      'I am a Lecturer in the College of Advanced Interdisciplinary Studies at the National University of Defense Technology (NUDT), Changsha, China.',
      'I received my B.Eng. in Measurement and Control Technology and Instruments from **Tsinghua University** (2015), M.Eng. in Optical Engineering from **NUDT** (2017), and Ph.D. in Nanoscience from **The University of Manchester** (2022). During my doctoral studies under Professors Marcelo Lozada-Hidalgo and Irina Grigorieva, I worked on ion transport through two-dimensional materials; as first author I reported the Wien effect in interfacial water dissociation and its photo-acceleration across graphene electrodes in *Nature Communications* and *Nano Letters*.',
      'My research focuses on **proton and ion transport through graphene and related 2D materials**, proton–electron coordinated regulation in van der Waals heterostructures, and low-dimensional optoelectronic devices.',
    ],
  },
};

/** 取当前语言的个人信息 */
export function profile(lang: Lang): ProfileI18N {
  return PROFILE_I18N[lang] ?? PROFILE_I18N.zh;
}

/** 学术身份标识 —— 空字符串会自动隐藏对应条目（语言中立） */
export const IDENTIFIERS: Record<string, string> = {
  'Google Scholar': 'https://scholar.google.com/citations?user=JDbTy2EAAAAJ',
  ORCID: 'https://orcid.org/0000-0002-8712-9338',
  'ResearchGate': 'https://www.researchgate.net/profile/Junhao-Cai',
  GitHub: 'https://github.com/SeveNOlogy7',
  DBLP: '',
  知乎: '',
  Twitter: '',
};

/** 侧边栏 / 首页展示的联系方式。icon 取值见 src/components/Icon.astro */
export const CONTACT: Array<{ icon: string; label: string; value: string; href?: string }> = [
  { icon: 'mail', label: '邮箱', value: 'jh.cai@nudt.edu.cn', href: 'mailto:jh.cai@nudt.edu.cn' },
  { icon: 'map-pin', label: '位置', value: '中国 · 长沙' },
  { icon: 'github', label: 'GitHub', value: 'SeveNOlogy7', href: 'https://github.com/SeveNOlogy7' },
  { icon: 'scholar', label: 'Scholar', value: 'Google Scholar', href: 'https://scholar.google.com/citations?user=JDbTy2EAAAAJ' },
  { icon: 'orcid', label: 'ORCID', value: '0000-0002-8712-9338', href: 'https://orcid.org/0000-0002-8712-9338' },
  { icon: 'researchgate', label: 'ResearchGate', value: 'Junhao-Cai', href: 'https://www.researchgate.net/profile/Junhao-Cai' },
];

/** 首页「动态」栏 —— 学术访客最关心的第一屏信息。date 建议 YYYY-MM 格式 */
export interface NewsItem {
  date: string;
  text: string;
  href?: string;
  linkText?: string;
}

export const NEWS_I18N: Record<Lang, NewsItem[]> = {
  zh: [
    { date: '2026-07', text: '三层菱方石墨烯堆叠序保持工作发表于 Carbon（CrOCl 各向异性介质）', href: '/publications', linkText: '查看论文' },
    { date: '2025-09', text: '高分子载体纳米结构转移与剥离方法发表于 Advanced Functional Materials', href: '/publications', linkText: '查看论文' },
    { date: '2023-10', text: '栅压调控石墨烯电极光驱动质子输运工作发表于 Nature Communications', href: '/publications', linkText: '查看论文' },
  ],
  en: [
    { date: '2026-07', text: 'Stacking-order preservation in rhombohedral trilayer graphene published in Carbon (anisotropic CrOCl dielectric)', href: '/en/publications', linkText: 'View paper' },
    { date: '2025-09', text: 'Polymeric-carrier approach for nanostructure transfer and exfoliation published in Advanced Functional Materials', href: '/en/publications', linkText: 'View paper' },
    { date: '2023-10', text: 'Gate-controlled suppression of light-driven proton transport through graphene electrodes published in Nature Communications', href: '/en/publications', linkText: 'View paper' },
  ],
};

/** 取当前语言的动态列表 */
export function news(lang: Lang): NewsItem[] {
  return NEWS_I18N[lang] ?? NEWS_I18N.zh;
}

/** 首页最近文章数量 */
export const RECENT_POSTS_COUNT = 5;

/** 是否启用 Pagefind 全站搜索（需先 npm run build && npm run postbuild:search） */
export const ENABLE_SEARCH = true;

/** 文章列表分页大小 */
export const PAGE_SIZE = 10;
