/**
 * lib/url —— Base Authority（src/lib/base.ts）的薄封装（T-09 基地址收口）。
 * BASE_URL 的读取唯一发生在 base.ts；本文件仅保留既有导出名（url / absolute /
 * stripBase）与签名，全站既有 import 点无需改动。新代码请直接 import './base'。
 */
import { absoluteUrl, stripBase as stripBaseFromBase, withBase } from './base';

/** 生成带 base 前缀的站内链接，项目站（/<repo>/）部署时无需改代码 */
export function url(path: string): string {
  return withBase(path);
}

/** 生成绝对 URL（用于 canonical / RSS / OG） */
export function absolute(path: string, site?: string): string {
  return absoluteUrl(path, site);
}

/**
 * 去掉 pathname 前端的 BASE_URL。
 * 项目页部署时 Astro.url.pathname 是 /jhcai.github.io/cv/，需要变成 /cv/
 * 才能传给语言切换、canonical、导航高亮等只认路由路径的函数。
 */
export function stripBase(pathname: string): string {
  return stripBaseFromBase(pathname);
}
