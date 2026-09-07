# syntax=docker/dockerfile:1
# ============================================================================
#  学术主页 —— 多阶段构建
#    builder : node:22-alpine，npm ci + astro build + pagefind 索引
#    runtime : nginx:alpine，只托管 dist/ 静态产物
#  构建产物体积极小（约 2MB + dist），无 Node 运行时暴露在最终镜像中。
# ============================================================================

FROM node:22-alpine AS builder

# 子目录部署（GitHub Pages 项目仓库）时通过 build arg 传入，如 /repo/
ARG BASE_PATH=/
ENV BASE_PATH=$BASE_PATH

WORKDIR /app

# 先只拷贝依赖清单，最大化利用 Docker 层缓存
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

# 再拷贝源码并构建（含 Pagefind 搜索索引）
COPY . .
RUN npm run build && npm run postbuild:search

# 若设置了子目录 base（如 /repo/），把产物整体搬进对应子目录，
# 使 nginx 始终以根路径托管，本地即可复现 Pages 把产物挂到 /repo/ 的行为。
RUN if [ "$BASE_PATH" != "/" ]; then \
      SUB=$(echo "$BASE_PATH" | sed -e 's:^/::' -e 's:/$::') && \
      mv dist /tmp/dist_tmp && \
      mkdir -p "dist/$SUB" && \
      cp -r /tmp/dist_tmp/. "dist/$SUB/" && \
      rm -rf /tmp/dist_tmp; \
    fi

# ----------------------------------------------------------------------------

FROM nginx:alpine AS runtime

ARG BASE_PATH=/
ENV BASE_PATH=$BASE_PATH

COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

# 健康检查：按 base 路径探测首页 200 即视为存活
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- "http://127.0.0.1${BASE_PATH}" >/dev/null 2>&1 || exit 1

CMD ["nginx", "-g", "daemon off;"]
