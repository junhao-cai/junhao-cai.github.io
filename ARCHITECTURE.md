# 架构速览（ARCHITECTURE.md）

> 读者：下一个维护者 / agent。目标：5 分钟读懂架构分层、四关注点收口与改动红线。
> 本文档是两份深度文档的精炼版，与仓库**重构完成后**的现状对齐；细节与完整论证见
> `docs/architecture-review.md`（四层解析 / 风险 A-H / 完整 ADR）与 `docs/refactor-handoff.md`（约束 / 雷区 / 交接清单）。

## 1. 一句话定位

个人学术主页（NUDT 讲师 Junhao Cai）：**构建期静态生成（SSG）的模块化单体**，无运行时后端，产物可被任意静态托管。

技术栈：**Astro 5 + Vue（仅 islands）+ remark/rehype 插件链 + Pagefind 搜索**；部署为 GitHub Actions + 多阶段 Docker/nginx。双语 zh/en（中文无前缀、英文 `/en/`，`prefixDefaultLocale: false` 勿改）。

## 2. 四层架构（重构后现状）

```
内容源层            构建管线层                渲染/客户端层               部署/运行时层
─────────          ─────────                ────────────              ────────────
Obsidian vault  →  sync-obsidian.mjs     →  pages（shell 驱动）      →  GitHub Actions
posts.bib/TS 数据  astro.config 插件链        components/shell/*          deploy.yml（check+test+build）
                   bibtex.ts 解析            lib/client/{filter,cite,toc}  Pages（base 按仓库名推导）
                   content.ts 门面           BaseLayout + Toc/PostToc     Docker 多阶段 → nginx
                   vitest 表征测试护栏        i18n 字典 DICT              Pagefind 后构建索引
```

### 2.1 内容源层（三类数据源，统一经门面读取）

| 数据 | 位置 | 维护方式 |
|---|---|---|
| 笔记 / 独立页面 | `src/content/posts`、`src/content/pages`（Markdown） | Obsidian vault 经 `scripts/sync-obsidian.mjs` 白名单同步（`npm run sync` / `sync:dry`） |
| 论文 | `src/data/pubs.bib` | 手维护 BibTeX，构建期零依赖解析 |
| 结构化信息 | `src/site.config.ts`、`src/data/cv.ts` | 手维护 TypeScript（个人 / 导航 / 简历含 `cvSections`） |

**曾是**三类数据各自为政、组件直接 import 底层源；**现为**统一经 `src/lib/content.ts` 门面暴露：`loadProfile / loadNews / loadContact / loadCv / loadPublications / loadSelectedPublications`（类型化、语言感知，屏蔽数据来自 `.bib` 还是 TS）。

### 2.2 构建管线层

- `astro.config.mjs`：集成 vue / sitemap；Markdown 链 `remark-gfm → remark-math → remark-obsidian（自研，src/lib/remark-obsidian.mjs）→ rehype-katex/slug/autolink`；i18n 路由见上。
- BibTeX：`pubs.bib → src/lib/bibtex.ts → src/lib/publications.ts`（构建期解析，模块级缓存共享）。
- 预处理：`sync-obsidian.mjs` 构建前做白名单过滤、wikilink 解析、附件复制到 `public/attachments/`、层级标签展平；是唯一能拿到完整 vault 上下文、在发布前报死链的环节。

### 2.3 渲染 / 客户端层

- **页面由 shell 组件驱动**：`src/pages/*` 与 `src/pages/en/*` 均是薄包装（如 `src/pages/en/cv.astro` 仅 3 行，包装 `src/components/shell/CvView.astro` 并传 `lang`）；视图逻辑集中在 `src/components/shell/`（`PageShell` + `HomeView / CvView / AboutView / PublicationsView / BlogIndexView / PostView / TagsIndexView / TagDetailView`）。**曾是** en 树与根树整页复制。
- **简历数据驱动**：`src/data/cv.ts → cvSections` 配置数组驱动 `CvView` 的正文分区与侧边目录；加板块 = 加一条配置。**曾是** `cv.astro` 硬编码分区顺序、id 与 TOC。
- **客户端行为模块化**：论文筛选 / 目录 scrollspy / 引用切换抽为 `src/lib/client/{filter,cite,toc}.ts`（可单测）；**曾是**页面内 `is:inline` 字符串脚本。
- **基地址唯一权威**：`src/lib/base.ts`（`basePath / withBase / stripBase / localizedPath / absoluteUrl / stripBaseSuffix`）；`src/lib/url.ts` 退化为薄封装（新代码直接 import `./base`）。**曾是** base 概念散落 5 处（site.config 正则手术 / url.ts / switchLangPath / Header.isActive / canonical）。
- **目录双组件**：`Toc.astro`（cv-toc，首页/简历/关于右栏，scrollspy **基于滚动位置**）与 `PostToc.astro`（文章页，桌面 IntersectionObserver 粘性目录 + 移动端块级目录兜底）。
- i18n：`src/i18n/index.ts` 提供 `getLangFromUrl / withLang / switchLangPath / useT`，UI 字典 `DICT`；数据层 i18n 干净，页面层靠 shell 组件去重。

### 2.4 部署 / 运行时层

- `.github/workflows/deploy.yml`：`npm run check` + `npm test` 先行，再 build（注入 SITE_URL/BASE_PATH）→ `postbuild:search`（Pagefind）→ 上传 Pages artifact；**base 按仓库名推导**（用户站 `junhao-cai.github.io` → `/`，项目站 → `/repo/`）。
- Docker：多阶段（node:22-alpine builder → nginx:alpine），`docker-compose.yml` 提供 dev / preview（`PREVIEW_PORT=8080`），`nginx.conf` 处理 `_astro` 缓存、`.bib` MIME、404。
- 运行时：纯静态 + 少量客户端 JS；搜索由 Pagefind 后构建索引支撑。

### 2.5 测试护栏

`vitest`（`vitest.config.ts`，`npm test`）：`tests/` 下 9 文件 188 用例，覆盖 `base` / `url` / `bibtex` / `content` / `publications` / `client-filter` / `cv-sections` / `sync-wikilinks` / `sync-e2e`。解析器与同步脚本已先锁行为再改（Phase 0 护栏）。

## 3. 关键设计决策（ADR 摘要）

源自 `docs/architecture-review.md` §6，一句一个：

- **ADR-001 保持 SSG，不上 SSR / 元框架**：个人站无需运行时；代价是无动态特性（Pagefind 已覆盖静态搜索）。
- **ADR-002 内容用「混合 + 门面」**：散文类走 Markdown（Obsidian 友好），结构化类走带 schema 的 TS 源，统一经 `content.ts` 门面暴露；不全量转 Markdown。
- **ADR-003 基地址收口单模块**：`src/lib/base.ts` 全站唯一权威，是消除 `/repo/repo` 类部署 bug 的唯一可靠手段。
- **ADR-004 i18n 先组件去重、后动态路由**：shell 组件去重已落地；动态 `[...locale]` 路由留到出现第三语言再做。
- **ADR-005 重构前先建测试护栏**：解析器 / 同步脚本是最易出边缘 case 的高风险区，先表征测试锁行为再改代码。

本轮执行补充决策（以仓库现状为准）：

- **渲染等价验收口径**：重构各步以「产物渲染等价」为验收（DOM / 输出不变，仅实现迁移；见 review §8「Phase 1/2 不改变产物 DOM 结构」）。
- **PostToc / Toc 双算法不合并**：文章页与栏目页的目录场景不同（滚动位置 vs IntersectionObserver、移动端兜底各异），保持两组件分工，不强行统一。
- **附件清理 `--prune` 默认 dry-run**：**规划中**（`scripts/sync-obsidian.mjs` 尚无 prune 实现；落地时须默认 dry-run、显式才真删）。

### 2.6 风险收口对照（review §4 风险 A-H → 现状）

| 风险（重构前） | 现状 |
|---|---|
| A 内容建模分裂（`.bib` vs TS 对象） | 底层范式仍分裂，读取已由 `content.ts` 门面屏蔽（ADR-002 的既定策略） |
| B i18n 页面树复制 | 已收口：shell 组件驱动，en 页薄包装 |
| C/D 客户端筛选重造查询、内联字符串脚本 | 已收口：`src/lib/client/*` 模块化 + 单测 |
| E BASE_PATH 散落 5 处 | 已收口：`src/lib/base.ts` 唯一权威 |
| F 简历页硬编码 | 已收口：`cvSections` 数据驱动 |
| G 解析器零测试 | 已收口：vitest 表征测试（bibtex / sync / filter 等） |
| H 附件不同步清理 | 未处理：`--prune` 规划中（见 §3 补充决策） |

## 4. 目录导览

| 路径 | 职责 |
|---|---|
| `src/lib/base.ts` | 基地址唯一权威（ADR-003） |
| `src/lib/content.ts` | 内容门面：类型化、语言感知的统一读取 API（ADR-002） |
| `src/lib/bibtex.ts` / `publications.ts` | BibTeX 零依赖解析 + 模块级缓存 |
| `src/lib/client/{filter,cite,toc}.ts` | 客户端行为模块（可单测） |
| `src/lib/url.ts` / `tags.ts` / `semester.ts` / `inline.ts` / `remark-obsidian.mjs` | URL 薄封装、标签、学期、内联引用、wikilink remark 插件 |
| `src/components/shell/` | `PageShell` + 各页视图组件（根树与 en 树共用，i18n 去重载体） |
| `src/components/Toc.astro` / `PostToc.astro` | 栏目页目录（滚动位置 scrollspy）/ 文章页目录 |
| `src/layouts/BaseLayout.astro` | HTML 外壳、SEO/OG/JSON-LD、引用切换事件委托 |
| `src/data/` | `pubs.bib`、`cv.ts`（含 `cvSections` 配置数组） |
| `src/i18n/index.ts` | 语言工具 + UI 字典 `DICT` |
| `tests/` | vitest 表征 / 单元 / e2e 测试（9 文件 188 用例） |
| `scripts/sync-obsidian.mjs` | Obsidian vault → 内容集合 + 附件的构建前同步 |
| `.github/workflows/deploy.yml` | CI：check + test + build + Pages 部署 |

## 5. 改动前必读（红线）

动代码前先读 `AGENTS.md`（硬规则摘要）与 `docs/refactor-handoff.md` §4（完整雷区清单）。最易踩中的三条：

1. **i18n URL 不变**：中文无前缀、英文 `/en/`；`astro.config.mjs` 的 `prefixDefaultLocale: false` 勿改，既有链接不得破坏。
2. **Toc 禁止加「点击锁定」**：scrollspy 基于滚动位置，曾因点击锁定导致高亮永久卡死；右栏统一 240px / gap 2rem，关于页 / 简历页须在 `BaseLayout` 传 `wide`。
3. **双 base 验证**：任何部署相关改动后，须核对用户站 `/` 与项目站 `/repo/` 两种 base 均正常（本地 `:8080` 预览，必要时走 Docker cp 旁路——容器内 `npm ci` 可能 `ECONNRESET`）。

其他高频雷区：Astro 组件 `<script>` 被内联进各页 HTML（验证内联脚本要 grep 构建后 **HTML**，不是 `dist/_astro/*.js`）；`posts` 集合为空的构建警告是良性的；GitHub 鉴权用账号 `junhao-cai` 经 `gh`（勿用 `SeveNOlogy7`，会 403）；原子提交 + Conventional Commits，不自动推送。

改完自检：`npm run check` 0 errors + `npm test` 全绿，再走预览核对双 base。

## 6. 常用命令

```
npm run dev        # 本地开发（astro dev）
npm run build      # 静态构建 → dist/
npm run check      # astro check（CI 与改动后自检）
npm test           # vitest run（188 用例）
npm run sync       # Obsidian vault → 内容集合（VAULT=/path/to/vault 前置）
npm run sync:dry   # 同步 dry-run，零写入
npm run preview    # astro preview；Docker 预览见 docker-compose（PREVIEW_PORT=8080）
```

