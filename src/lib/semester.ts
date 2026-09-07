/**
 * 学期（春秋）解析与排序工具，用于「主讲课程」板块：
 * - 简历页按课程聚合，首栏展示多个开课学期；
 * - 首页按学期聚合，展示最近两个学期。
 */

export type Season = 'Spring' | 'Autumn';

export interface Semester {
  year: number;
  season: Season;
}

const CN_SEASON: Record<string, Season> = { 春: 'Spring', 秋: 'Autumn' };
const EN_SEASON: Record<string, Season> = { Spring: 'Spring', Autumn: 'Autumn', Fall: 'Autumn' };

/** 解析 "2023 秋" / "2024 春" / "Autumn 2023" / "Spring 2024" / "Fall 2023" 等写法。 */
export function parseTerm(term: string): Semester | null {
  const t = (term || '').trim();
  let m = t.match(/^(\d{4})\s*年?\s*(春|秋)$/);
  if (m) return { year: Number(m[1]), season: CN_SEASON[m[2]] };
  m = t.match(/^(Spring|Autumn|Fall)\s+(\d{4})$/);
  if (m) return { year: Number(m[2]), season: EN_SEASON[m[1]] };
  return null;
}

/** 学期的可排序整数键：同年 Spring < Autumn；Autumn Y < Spring Y+1。 */
export function semesterKey(s: Semester): number {
  return s.year * 2 + (s.season === 'Autumn' ? 1 : 0);
}

export function keyToSemester(k: number): Semester {
  return { year: Math.floor(k / 2), season: k % 2 === 1 ? 'Autumn' : 'Spring' };
}

export function formatSemester(s: Semester, lang: 'zh' | 'en'): string {
  return lang === 'zh'
    ? `${s.year} ${s.season === 'Spring' ? '春' : '秋'}`
    : `${s.season === 'Spring' ? 'Spring' : 'Autumn'} ${s.year}`;
}

/** 由日期推算当前学期（按中国高校校历：秋 ~9月–次年1月，春 ~2–8月）。 */
export function currentSemester(date = new Date()): Semester {
  const m = date.getMonth() + 1;
  if (m >= 9) return { year: date.getFullYear(), season: 'Autumn' };
  if (m === 1) return { year: date.getFullYear() - 1, season: 'Autumn' };
  return { year: date.getFullYear(), season: 'Spring' };
}

export function prevSemester(s: Semester): Semester {
  return s.season === 'Spring'
    ? { year: s.year - 1, season: 'Autumn' }
    : { year: s.year, season: 'Spring' };
}
