/**
 * 极简行内 Markdown：**粗体** *斜体* `代码` [文字](链接)
 * 只用于渲染配置文件里的短文本（CV 条目说明等），不处理长文。
 * 先做 HTML 转义再替换，因此不会引入 XSS。
 */
export function inlineMd(input?: string): string {
  if (!input) return '';
  const esc = String(input)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

  return esc
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>')
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '<a href="$2">$1</a>');
}

/** 日期格式化：中文「2026 年 9 月 6 日」/ 短格式 YYYY-MM-DD；英文「Sep 6, 2026」 */
export function formatDate(
  d: Date | string,
  style: 'long' | 'short' = 'long',
  lang: 'zh' | 'en' = 'zh'
): string {
  const date = typeof d === 'string' ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return String(d);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  if (style === 'short') return `${y}-${m}-${day}`;
  if (lang === 'en') {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${months[date.getMonth()]} ${date.getDate()}, ${y}`;
  }
  return `${y} 年 ${Number(m)} 月 ${Number(day)} 日`;
}
