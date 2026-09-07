/**
 * 论文（BibTeX）之外的简历结构化数据。
 * 教育经历 / 任职 / 获奖 / 项目 / 教学 / 学术服务 / 技能。
 *
 * 双语：需要翻译的字段按语言分组写入 CV_BY_LANG，用 cvData(lang) 取值；
 * 空数组会自动隐藏对应区块，不必删代码。
 */

import type { Lang } from '../i18n';

export interface TimelineItem {
  /** 起止，例如 "2022.09 — 至今" */
  period: string;
  /** 主标题：机构 / 职位 / 奖项名 */
  title: string;
  /** 副标题：学位 / 方向 / 说明 */
  subtitle?: string;
  /** 补充说明（支持 **粗体** 与 `代码` 行内 Markdown） */
  detail?: string;
  /** 相关链接 */
  links?: Array<{ label: string; href: string }>;
}

export interface SkillGroup {
  group: string;
  items: string[];
}

export interface PatentItem {
  /** 授权 / 公开日期 */
  date: string;
  /** 专利名称（专利法律名称，通常不翻译） */
  title: string;
  /** 国家 / 地区，例如 "中国" */
  country: string;
  /** 专利号 / 公开号 */
  number: string;
  /** 发明人列表（含本人） */
  inventors: string[];
  /** 是否已授权（false 表示申请中 / 公开） */
  granted?: boolean;
}

export interface CourseItem {
  /** 课程名称 */
  name: string;
  /** 课程性质：本科 / 研究生（或 Undergraduate / Graduate） */
  level: string;
  /** 开课学期列表：同一门课可能多个学期开设，如 ["2023 秋", "2024 秋"] */
  terms: string[];
  /** 内容简介 */
  description?: string;
}

export interface CvData {
  education: TimelineItem[];
  experience: TimelineItem[];
  awards: TimelineItem[];
  grants: TimelineItem[];
  /** 主持 / 参与的研究项目与课题 */
  projects: TimelineItem[];
  /** 授权 / 公开的专利（含本人为发明人） */
  patents: PatentItem[];
  /** 主讲课程 */
  courses: CourseItem[];
  teaching: TimelineItem[];
  service: TimelineItem[];
  skills: SkillGroup[];
}

export const CV_BY_LANG: Record<Lang, CvData> = {
  zh: {
    education: [
      {
        period: '2017.09 — 2022.12',
        title: 'University of Manchester · 物理与天文学院',
        subtitle: 'Ph.D. · Nanoscience',
        detail:
          '师从 Marcelo Lozada-Hidalgo 教授与 Irina Grigorieva 教授，研究石墨烯中的质子与离子输运。',
      },
      {
        period: '2015.09 — 2017.09',
        title: '国防科技大学 · 光电科学与工程学院',
        subtitle: '工学硕士 · 光学工程',
      },
      {
        period: '2011.08 — 2015.07',
        title: '清华大学 · 精密仪器系',
        subtitle: '工学学士 · 测控技术与仪器',
      },
    ],
    experience: [
      {
        period: '2022.09 — 至今',
        title: '国防科技大学 · 前沿交叉学科学院',
        subtitle: '讲师',
      },
    ],
    awards: [],
    grants: [],
    projects: [
      {
        period: '2024.01 — 2026.12',
        title: '基于亚纳米孔的二维材料界面水解离的调控方法研究',
        subtitle: '主持 · 国家自然科学基金青年科学基金项目（C类）',
        detail: '项目编号 52303387 · 30 万元 · 在研',
      },
      {
        period: '2024.07 — 2027.07',
        title: '科技创新类湖湘青年英才-蔡君豪',
        subtitle: '主持 · 湖南省科技厅创新人才计划',
        detail: '项目编号 2024RC3114 · 30 万元 · 在研',
      },
    ],
    patents: [
      {
        date: '2024-02-02',
        title: '一种光谱分布不随功率改变的超连续谱产生方法及装置',
        country: '中国',
        number: 'CN201910640456.7',
        inventors: ['陈胜平', '徐荷', '陶悦', '蔡君豪', '侯静', '姜宗福'],
        granted: true,
      },
      {
        date: '2024-03-08',
        title: '高峰值功率耗散孤子共振锁模激光器',
        country: '中国',
        number: '2018109948436',
        inventors: ['徐荷', '陈胜平', '蔡君豪', '侯静', '姜宗福'],
        granted: true,
      },
      {
        date: '2024-03-08',
        title: '一种超连续谱产生装置',
        country: '中国',
        number: '2018109948065',
        inventors: ['徐荷', '陈胜平', '蔡君豪', '侯静', '姜宗福'],
        granted: true,
      },
    ],
    courses: [
      {
        name: '半导体物理与器件',
        level: '本科',
        terms: ['2024 春', '2025 春', '2026 春'],
        description: '讲授半导体的基本概念、基础理论、基本规律、物理模型和分析方法，以及简单的器件原理。',
      },
      {
        name: '纳米材料基础实验',
        level: '本科',
        terms: ['2024 春', '2025 春', '2026 春'],
        description: '讲授《纳米薄膜的等离子体刻蚀》实验模块。',
      },
      {
        name: '纳米技术综合实验',
        level: '本科',
        terms: ['2024 秋', '2025 秋', '2026 秋'],
        description: '讲授《介质人工微纳结构的制备与光谱测试》实验模块。',
      },
      {
        name: '碳基纳米电子学导论',
        level: '本科',
        terms: ['2024 秋', '2025 秋', '2026 秋'],
        description: '讲授碳基纳米材料的基本结构和物理性质、可控制备技术和表征技术、碳基数字集成电路、碳基光电器件等。',
      },
      {
        name: '微纳光电功能材料与器件综合实践',
        level: '本科',
        terms: ['2025 春', '2026 春'],
        description: '讲授《偏振光学器件及应用》实践模块。',
      },
      {
        name: '石墨烯与二维电子导论',
        level: '研究生',
        terms: ['2026 春'],
        description: '讲授双层石墨烯的结构和物理性质、石墨烯与二维材料异质结、光电探测器及发光器件。',
      },
    ],
    teaching: [],
    service: [],
    skills: [
      {
        group: '研究技能',
        items: [
          '二维材料机械剥离与转移',
          '电学与光电响应测量',
          'LabVIEW 自动化测试软件开发',
        ],
      },
      { group: '语言', items: ['中文（母语）', '英语（学术工作语言，留英 4 年）'] },
    ],
  },

  en: {
    education: [
      {
        period: '2017.09 — 2022.12',
        title: 'The University of Manchester · School of Physics and Astronomy',
        subtitle: 'Ph.D. in Nanoscience',
        detail:
          'Under Professors Marcelo Lozada-Hidalgo and Irina Grigorieva, working on proton and ion transport through two-dimensional materials.',
      },
      {
        period: '2015.09 — 2017.09',
        title: 'National University of Defense Technology · College of Optoelectronic Science and Technology',
        subtitle: 'M.Eng. in Optical Engineering',
      },
      {
        period: '2011.08 — 2015.07',
        title: 'Tsinghua University · Department of Precision Instrument',
        subtitle: 'B.Eng. in Measurement and Control Technology and Instruments',
      },
    ],
    experience: [
      {
        period: '2022.09 — present',
        title: 'National University of Defense Technology · College of Advanced Interdisciplinary Studies',
        subtitle: 'Lecturer',
      },
    ],
    awards: [],
    grants: [],
    projects: [
      {
        period: '2024.01 — 2026.12',
        title: 'Regulation of interfacial water dissociation on 2D materials via sub-nanopores',
        subtitle: 'PI · NSFC Young Scientists Fund (Type C)',
        detail: 'Grant No. 52303387 · ¥300,000 · Ongoing',
      },
      {
        period: '2024.07 — 2027.07',
        title: 'Huxiang Young Talent (Science & Technology Innovation) — Junhao Cai',
        subtitle: 'PI · Hunan Provincial Science & Technology Department Talent Program',
        detail: 'Grant No. 2024RC3114 · ¥300,000 · Ongoing',
      },
    ],
    patents: [
      {
        date: '2024-02-02',
        title: '一种光谱分布不随功率改变的超连续谱产生方法及装置',
        country: '中国',
        number: 'CN201910640456.7',
        inventors: ['陈胜平', '徐荷', '陶悦', '蔡君豪', '侯静', '姜宗福'],
        granted: true,
      },
      {
        date: '2024-03-08',
        title: '高峰值功率耗散孤子共振锁模激光器',
        country: '中国',
        number: '2018109948436',
        inventors: ['徐荷', '陈胜平', '蔡君豪', '侯静', '姜宗福'],
        granted: true,
      },
      {
        date: '2024-03-08',
        title: '一种超连续谱产生装置',
        country: '中国',
        number: '2018109948065',
        inventors: ['徐荷', '陈胜平', '蔡君豪', '侯静', '姜宗福'],
        granted: true,
      },
    ],
    courses: [
      {
        name: 'Semiconductor Physics and Devices',
        level: 'Undergraduate',
        terms: ['Spring 2024', 'Spring 2025', 'Spring 2026'],
        description: 'Covers the fundamental concepts, basic theories, underlying principles, physical models and analytical methods of semiconductors, along with introductory device physics.',
      },
      {
        name: 'Fundamentals of Nanomaterials Experiments',
        level: 'Undergraduate',
        terms: ['Spring 2024', 'Spring 2025', 'Spring 2026'],
        description: "Teaches the laboratory module 'Plasma Etching of Nanofilms'.",
      },
      {
        name: 'Comprehensive Nanotechnology Experiments',
        level: 'Undergraduate',
        terms: ['Autumn 2024', 'Autumn 2025', 'Autumn 2026'],
        description: "Teaches the laboratory module 'Fabrication and Spectroscopic Characterization of Dielectric Artificial Micro/Nano Structures'.",
      },
      {
        name: 'Introduction to Carbon-Based Nanoelectronics',
        level: 'Undergraduate',
        terms: ['Autumn 2024', 'Autumn 2025', 'Autumn 2026'],
        description: 'Covers the basic structure and physical properties of carbon-based nanomaterials, controllable synthesis and characterization techniques, carbon-based digital integrated circuits, and carbon-based optoelectronic devices.',
      },
      {
        name: 'Comprehensive Practice on Micro/Nano Optoelectronic Functional Materials and Devices',
        level: 'Undergraduate',
        terms: ['Spring 2025', 'Spring 2026'],
        description: "Teaches the practice module 'Polarized Optical Devices and Their Applications'.",
      },
      {
        name: 'Introduction to Graphene and 2D Electronics',
        level: 'Graduate',
        terms: ['Spring 2026'],
        description: 'Covers the structure and physical properties of bilayer graphene, graphene and 2D-material heterostructures, photodetectors, and light-emitting devices.',
      },
    ],
    teaching: [],
    service: [],
    skills: [
      {
        group: 'Research skills',
        items: [
          'Mechanical exfoliation and transfer of 2D materials',
          'Electrical and photoresponse measurements',
          'LabVIEW automated test-software development',
        ],
      },
      {
        group: 'Languages',
        items: ['Chinese (native)', 'English (full professional; 4 years in the UK)'],
      },
    ],
  },
};

/** 取当前语言的简历数据 */
export function cvData(lang: Lang): CvData {
  return CV_BY_LANG[lang] ?? CV_BY_LANG.zh;
}

/**
 * 用于识别「本人」的作者名变体。
 * 填写你在论文署名中可能出现的各种写法（含缩写），
 * 匹配上的作者会在论文列表中加粗高亮。
 * 匹配规则：忽略大小写与标点后，比较 姓 或 全名。
 */
export const SELF_NAME_VARIANTS: string[] = [
  'Junhao Cai',
  'Jun-Hao Cai',
  'Cai, Junhao',
  'Cai, Jun-Hao',
  'J. Cai',
  'Cai, J.',
];

/** CV 页是否按类型分组展示论文；false 则按年份一条龙 */
export const GROUP_PUBLICATIONS_BY_TYPE = true;
