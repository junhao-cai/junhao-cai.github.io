# Academic Homepage

个人学术主页 —— 科研向简历 + 可对接 Obsidian 的博客。Astro 5 静态构建，零服务器成本，部署到 GitHub Pages。

## 一键跑起来

```bash
npm install
npm run dev          # http://localhost:4321
npm run build        # 产物在 dist/
npm run preview      # 预览构建产物
npm run sync         # 从 Obsidian 同步笔记（需先 export VAULT=/path/to/vault）
```

## Docker 本地预览

不想在本机装 Node，或想验证「上线后长什么样」，用 Docker：

```bash
docker-compose up dev              # 开发模式（热更新） → http://localhost:4321
docker-compose up -d preview      # 生产预览（nginx 托管 dist 产物） → http://localhost:8080
docker-compose down                # 停止（node_modules_dev 卷保留依赖缓存）
```

- 端口在 `.env` 里改：`DEV_PORT=4321`、`PREVIEW_PORT=8080`
- **注意用 `docker-compose`（带连字符）**：本机是 v5.5.0 独立版，`docker compose` 插件不可用
- Windows 坑：宿主机 `node_modules` 含 win32 二进制，Linux 容器跑不了 —— dev 服务用命名卷 `node_modules_dev` 遮蔽 `/app/node_modules`；启动时检测卷内已有依赖则直接跳过安装
- 首次 `npm ci` 受网络影响可能很慢，可从镜像构建缓存直接灌依赖（秒级；`MSYS_NO_PATHCONV=1` 仅 Git Bash 需要，PowerShell/CMD 去掉）：

  ```bash
  docker build --target builder -t academic-builder-cache .
  MSYS_NO_PATHCONV=1 docker run --rm -v academicpage_node_modules_dev:/target \
    academic-builder-cache sh -c "cp -a /app/node_modules/. /target/"
  docker-compose up -d dev
  ```
- 生产预览改代码后需重建：`docker-compose up -d --build preview`
- 本机实测：Windows 文件监听事件不穿透 Docker Desktop 共享，dev 服务**默认已开启** `CHOKIDAR_USEPOLLING=1`（轮询）；若改文件后页面没变，`docker-compose restart dev` 即可

## 三个文件改完就上线

| 改这里 | 改完会变什么 |
|--------|--------------|
| `src/site.config.ts` | 站名、姓名、简介、联系、导航 |
| `src/data/pubs.bib` | 论文列表（直接覆盖 Zotero 导出的 .bib） |
| `src/data/cv.ts` | 教育/工作/获奖/项目/教学/服务/技能 |

`src/content/posts/` 是博客文章目录，可以手写，也可以让 Obsidian 同步进来。

## Obsidian 同步

```bash
export VAULT=/d/Notes           # 你的 vault 根目录
export ROOTS=Posts,Pages       # 只同步这几个一级目录下的笔记
npm run sync                    # 实际写入
npm run sync:dry                # 只看会被写入哪些文件
npm run sync -- --prune         # 报告 public/attachments/ 中 vault 已不引用的残留附件（dry-run，不删）
npm run sync -- --prune --delete  # 同上，并真正删除这些残留
```

vault 里的笔记 frontmatter 需要 `publish: true` 才会被同步，否则留在 vault。

转换规则：

- `[[Note#Heading|别名]]` → `/posts/<slug>/#Heading` 或站内页面链接，**死链会在终端打印警告**
- `![[image.png]]` → 复制附件到 `public/attachments/`，链接替换为 `/attachments/...`
- `> [!note] / 提示` 等 callout、==高亮==、`%%注释%%` 由 `src/lib/remark-obsidian.mjs` 在构建时渲染

> [!warning] 隐私
> vault 里**任何**没标 `publish: true` 的文章都不会进仓库。脚本只复制白名单文件，不会泄露其他目录。

## 部署（GitHub Pages）

推到 GitHub 即自动发布，无需手动构建、也无需改 `astro.config.mjs`。

1. 创建仓库并推送：
   - **用户/主页仓库** `<user>.github.io` → 站点在根 `https://<user>.github.io/`
   - **普通项目仓库** `<user>/<repo>` → 站点在 `https://<user>.github.io/<repo>/`
   - `base` 与 `site` 由 `.github/workflows/deploy.yml` 按仓库名**自动推导**：项目仓库会自动加 `/<repo>/` 前缀，Pagefind 搜索等子目录资源也随之适配，不用手动设环境变量。
2. 开启 Pages：仓库 `Settings → Pages → Build and deployment → Source` 选 **GitHub Actions**。
3. 触发部署：push 到 `main` 或 `master`（工作流同时监听两者），或在 `Actions → Deploy to GitHub Pages` 手动 `Run workflow`。

部署完成后站点 URL 会显示在 Actions 运行页与仓库 `Settings → Pages` 中。

> 国内访问慢：可绑定自定义域名 + Cloudflare CDN，或改用 Cloudflare Pages（同样是 push 即部署）。

### 部署前自检

- [ ] `npm run build` 无报错，`dist/` 已生成
- [ ] `npm run postbuild:search` 已跑，搜索可用（否则 `/search` 页会提示「索引尚未生成」）
- [ ] 仓库 `Settings → Pages → Source` 已选 **GitHub Actions**（不是 *Deploy from a branch*）
- [ ] 推送分支是 `main` 或 `master`（工作流同时监听两者）
- [ ] **不需要** `.nojekyll`（`actions/deploy-pages` 直接发布构建产物，不经过 Jekyll）

## 本地预览（模拟线上）

部署前建议先在本地跑一遍生产构建，确认样式、搜索、内链都正常。

### 基础流程（适用于用户/主页仓库，base=/）

```bash
npm install
npm run build              # 产出 dist/
npm run postbuild:search   # 生成 Pagefind 索引（搜索功能依赖它）
npm run preview            # http://localhost:4321/
```

`npm run preview` 直接托管 `dist/`，URL 结构与线上 `https://<user>.github.io/` 完全一致，开箱即用。

> 注意：`astro preview` 不会重新构建，改了源码要先 `npm run build` 再 preview；只 build 不跑 `postbuild:search`，`/search` 页会提示「索引尚未生成」。

### 项目仓库（base=/repo/）的本地预览

GitHub Pages 会把整个构建产物挂在 `/<repo>/` 下，线上 `/<repo>/pagefind/...` 才正确。但本地 `npm run preview` 把 `dist/` 挂在根 `/`，**不会自动加 `/<repo>/` 前缀**，直接访问会导致带前缀的资源（CSS、JS、Pagefind）404——这是本地预览的固有限制，不是部署坏了。

两种本地验证方式：

1. **快速校验内容/搜索**（推荐日常用）：用根 base 构建预览，生产环境只是整体多一层 `/<repo>/` 前缀，功能逻辑一致。
   ```bash
   BASE_PATH=/ npm run build && npm run postbuild:search && npm run preview
   # 访问 http://localhost:4321/
   ```
2. **完全复现子目录行为**：把 `dist/` 包进 `repo/` 子目录再起静态服务，模拟 Pages 的挂载方式。
   ```bash
   BASE_PATH=/repo/ npm run build && npm run postbuild:search
   rm -rf _preview && mkdir -p _preview/repo && cp -r dist/* _preview/repo/
   cd _preview && python -m http.server 8080
   # 访问 http://localhost:8080/repo/
   ```

> 原理：Astro 在 `base=/repo/` 时只给内部 URL 加前缀、文件仍落在 `dist/` 根（不会生成 `dist/repo/`）。Pages 正好把产物整体挂到 `/repo/`，二者吻合；本地要复现就得自己把 `dist` 放到 `<某目录>/repo/` 下再服务。

### Docker 预览

不想装 Node 时可用 Docker（nginx 托管构建产物）：

- **用户/主页仓库（base=/）**：
  ```bash
  docker-compose up -d preview --build
  # 访问 http://localhost:8080
  ```
- **项目仓库（base=/repo/）**：通过 `BASE_PATH` 把产物整体挂到 `/repo/`，与 GitHub Pages 行为一致：
  ```bash
  BASE_PATH=/repo/ docker-compose up -d preview --build
  # 访问 http://localhost:8080/repo/
  ```
  也可在 `.env` 里写 `BASE_PATH=/repo/` 持久化。改了源码/配置后务必带 `--build` 重建（`dist` 在构建时烤进镜像，不复用旧产物）。

> 原理：Dockerfile 接收 `BASE_PATH` 构建参数；非根 base 时把 `dist/` 整体搬进 `dist/<repo>/` 子目录，nginx 始终以根路径托管，于是浏览器请求 `/repo/...` 正好命中——与 Pages 把产物挂到 `/repo/` 完全对齐。`dev` 容器同样感知 `BASE_PATH`。

> 开发热更新：`docker-compose up dev`（同样可带 `BASE_PATH`），`http://localhost:4321`。

## 项目结构

```
.
├── astro.config.mjs          站点配置（site / base / markdown 插件）
├── src/
│   ├── site.config.ts        个人信息的唯一来源
│   ├── data/
│   │   ├── cv.ts             结构化简历
│   │   └── pubs.bib          论文 BibTeX（自动驱动 publications / CV 页）
│   ├── content/
│   │   ├── posts/            博客（也可由 sync-obsidian 写入）
│   │   └── pages/            独立页面（about 等）
│   ├── components/           UI 组件
│   ├── layouts/              BaseLayout
│   ├── lib/                  bibtex / tags / remark-obsidian / url / inline / publications
│   ├── pages/                路由
│   └── styles/global.css     设计令牌 + 中文排版
├── public/
│   ├── avatar.svg / favicon.svg
│   └── attachments/          sync-obsidian 写入的附件
├── scripts/sync-obsidian.mjs
├── .github/workflows/deploy.yml
└── package.json
```

## 学术向能力

- BibTeX 解析与渲染：APA / IEEE / MLA 三种引用格式自动生成，每条论文可展开看 `.bib` 原文
- KaTeX 行内 / 行间数学公式
- Shiki 代码高亮（VS Code 同款）
- CJK 排版：`text-justify: inter-ideograph`、行高 1.85、`hanging-punctuation`
- OG / Twitter Card / JSON-LD 结构化数据 / RSS / sitemap / robots.txt
- Pagefind 全站搜索（构建后自动生成索引）
- 打印友好的简历页（`@media print` 已配置）

## License

MIT