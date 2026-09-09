/**
 * =============================================================================
 *  Content Facade —— 统一内容读取门面（ADR-002「混合 + 门面」；计划 Wave 4 任务 15）。
 *
 *  上层组件 / 页面只依赖本门面取内容，不直接 import site.config / data/cv /
 *  lib/publications。数据范式维持三类不变（.bib / TS 对象 / Markdown 集合），
 *  门面只做统一读取 API 的收口：零逻辑、零缓存、零变换 —— 纯委托到既有 TS 实现，
 *  并再导出相关类型，调用方迁移在 T-16 进行。
 *
 *  依赖方向（严格单向，i18n 绝不反向依赖 content）：
 *    content → ../i18n、../site.config、../data/cv、./publications、./bibtex
 *
 *  API 对照：
 *    loadProfile(lang)            → site.config.profile(lang)   （语言感知）
 *    loadNews(lang)               → site.config.news(lang)      （语言感知）
 *    loadContact()                → site.config.CONTACT         （语言中立，经门面同通道暴露）
 *    loadCv(lang)                 → cv.cvData(lang)             （语言感知）
 *    loadPublications()           → publications.PUBLICATIONS   （BibTeX 构建时解析）
 *    loadSelectedPublications()   → publications.SELECTED_PUBLICATIONS（高频派生量顺手收口）
 * =============================================================================
 */

import type { Lang } from '../i18n';
import {
  profile,
  news,
  CONTACT,
  type ProfileI18N,
  type NewsItem,
} from '../site.config';
import { cvData, type CvData } from '../data/cv';
import { PUBLICATIONS, SELECTED_PUBLICATIONS } from './publications';
import type { Entry, Author } from './bibtex';

/** 联系方式条目（语言中立；icon 取值见 src/components/Icon.astro） */
export type ContactItem = { icon: string; label: string; value: string; href?: string };

/** 取当前语言的个人信息 */
export function loadProfile(lang: Lang): ProfileI18N {
  return profile(lang);
}

/** 取当前语言的首页「动态」列表 */
export function loadNews(lang: Lang): NewsItem[] {
  return news(lang);
}

/** 取侧边栏 / 首页展示的联系方式（语言中立） */
export function loadContact(): ContactItem[] {
  return CONTACT;
}

/** 取当前语言的简历结构化数据 */
export function loadCv(lang: Lang): CvData {
  return cvData(lang);
}

/** 取全部论文（BibTeX 构建时一次性解析、按年份倒序） */
export function loadPublications(): Entry[] {
  return PUBLICATIONS;
}

/** 取精选论文（selected 标注子集） */
export function loadSelectedPublications(): Entry[] {
  return SELECTED_PUBLICATIONS;
}

/** 相关类型再导出 —— 上层组件只需 import 本门面即可取得全部内容类型 */
export type { Lang, ProfileI18N, NewsItem, CvData, Entry, Author };
