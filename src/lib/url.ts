/** 生成带 base 前缀的站内链接，项目站（/<repo>/）部署时无需改代码 */
export function url(path: string): string {
  const raw = import.meta.env.BASE_URL || '/';
  const base = raw.endsWith('/') ? raw : `${raw}/`;
  return `${base}${String(path).replace(/^\/+/, '')}`;
}

/** 生成绝对 URL（用于 canonical / RSS / OG） */
export function absolute(path: string, site?: string): string {
  const origin = (site ?? import.meta.env.SITE ?? '').replace(/\/+$/, '');
  return `${origin}${url(path)}`;
}

/**
 * 去掉 pathname 前端的 BASE_URL。
 * 项目页部署时 Astro.url.pathname 是 /jhcai.github.io/cv/，需要变成 /cv/
 * 才能传给语言切换、canonical、导航高亮等只认路由路径的函数。
 */
export function stripBase(pathname: string): string {
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  if (base && pathname.startsWith(base + '/')) {
    return pathname.slice(base.length);
  }
  return pathname;
}
