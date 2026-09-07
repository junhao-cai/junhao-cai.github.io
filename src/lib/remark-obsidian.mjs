/**
 * remark-obsidian
 * ---------------------------------------------------------------------------
 * 把 Obsidian 风味的 Markdown 语法降级成标准 mdast，使其能被 remark-rehype
 * 正常渲染。本插件只处理「不需要跨文件上下文」的语法：
 *
 *   1. Callout         > [!warning] 标题      → blockquote.callout[data-callout]
 *   2. 高亮            ==文字==               → <mark>
 *   3. 块引用/注释     %%……%%                → 删除
 *   4. 嵌入兜底        ![[image.png]]         → 图片节点
 *   5. Wikilink 兜底   [[目标|显示名]]        → 普通链接
 *
 * 跨文件的部分（Wikilink 解析、附件路径、frontmatter 规范化、publish 过滤）
 * 由 scripts/sync-obsidian.mjs 在同步阶段完成 —— 那里能拿到完整 vault 上下文，
 * 可以在发布前就报出死链，而不是等构建失败。
 */

const CALLOUT_RE = /^\[!\s*([\w-]+)\s*\]\s*([+-]?)\s*([\s\S]*)$/;

/** callout 类型的中文默认标题 */
const CALLOUT_TITLES = {
  note: '注释',
  abstract: '摘要',
  summary: '摘要',
  tldr: '摘要',
  info: '信息',
  todo: '待办',
  tip: '提示',
  hint: '提示',
  important: '重要',
  success: '成功',
  check: '成功',
  done: '成功',
  question: '问题',
  help: '问题',
  faq: '问题',
  warning: '警告',
  caution: '警告',
  attention: '警告',
  failure: '失败',
  fail: '失败',
  missing: '失败',
  danger: '危险',
  error: '错误',
  bug: '缺陷',
  example: '示例',
  quote: '引用',
  cite: '引用',
};

/** 需要原样保留、不做行内替换的节点类型 */
const SKIP_TYPES = new Set(['code', 'inlineCode', 'math', 'inlineMath', 'yaml', 'html', 'definition']);

/** 已生成的目标节点，不再递归处理 */
const GENERATED = new Set(['link', 'image', 'linkReference', 'imageReference']);

function text(value) {
  return { type: 'text', value };
}

// ---------------------------------------------------------------------------
// 行内语法
// ---------------------------------------------------------------------------

const TOKEN_RE =
  /%%([\s\S]*?)%%|!\[\[([^\]\n]+?)\]\]|\[\[([^\]\n]+?)\]\]|==([^=\n]+)==/g;

/**
 * 把一段纯文本切分成节点数组。
 * @param {string} value
 * @param {{embedBase: string, onWikilink: (t:string)=>void}} ctx
 */
function splitInline(value, ctx) {
  if (!/%%|\[\[|==/.test(value)) return [text(value)];

  const out = [];
  let last = 0;
  TOKEN_RE.lastIndex = 0;

  for (let m; (m = TOKEN_RE.exec(value)) !== null; ) {
    if (m.index > last) out.push(text(value.slice(last, m.index)));
    last = m.index + m[0].length;

    const [, comment, embed, wikilink, highlight] = m;

    if (comment !== undefined) {
      // Obsidian 注释：直接丢弃
      continue;
    }

    if (embed !== undefined) {
      const [rawTarget, alt = ''] = embed.split('|');
      out.push({
        type: 'image',
        url: resolveEmbed(rawTarget, ctx.embedBase),
        alt: alt || rawTarget.split('/').pop(),
        data: { hProperties: { className: ['obsidian-embed'] } },
      });
      continue;
    }

    if (wikilink !== undefined) {
      const [rawTarget, label] = wikilink.split('|');
      const [notePath, heading] = rawTarget.split('#');
      ctx.onWikilink?.(notePath);
      out.push({
        type: 'link',
        url: heading ? `#${slugify(heading)}` : '#',
        data: {
          hProperties: {
            className: ['internal-link', 'is-unresolved'],
            'data-wikilink': rawTarget,
          },
        },
        children: [text(label || notePath.split('/').pop() || rawTarget)],
      });
      continue;
    }

    if (highlight !== undefined) {
      out.push({
        type: 'emphasis',
        data: { hName: 'mark' },
        children: [text(highlight)],
      });
    }
  }

  if (last < value.length) out.push(text(value.slice(last)));
  return out.length ? out : [];
}

function resolveEmbed(rawTarget, embedBase) {
  const file = rawTarget.split('/').pop().trim();
  const withExt = /\.[a-z0-9]+$/i.test(file) ? file : `${file}.md`;
  if (/\.(md|canvas)$/i.test(withExt)) return '#'; // 笔记嵌入无法静态渲染，退化为锚点
  return `${embedBase.replace(/\/$/, '')}/${withExt}`;
}

function slugify(input) {
  return String(input)
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, '-')
    .replace(/[^\p{L}\p{N}-]/gu, '');
}

/** 递归处理所有块的行内内容 */
function walkInline(node, ctx) {
  if (!node || typeof node !== 'object') return;
  if (SKIP_TYPES.has(node.type)) return;
  if (!Array.isArray(node.children)) return;

  const next = [];
  for (const child of node.children) {
    if (child.type === 'text') {
      next.push(...splitInline(child.value, ctx));
    } else {
      next.push(child);
      if (!GENERATED.has(child.type)) walkInline(child, ctx);
    }
  }
  node.children = next;
}

// ---------------------------------------------------------------------------
// Callout
// ---------------------------------------------------------------------------

function transformCallouts(tree) {
  const visit = (node) => {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node.children)) {
      for (const child of node.children) visit(child);
    }
    if (node.type !== 'blockquote') return;

    const first = node.children[0];
    if (!first || first.type !== 'paragraph') return;

    const head = first.children[0];
    if (!head || head.type !== 'text') return;

    const m = CALLOUT_RE.exec(head.value.trim());
    if (!m) return;

    const kind = m[1].toLowerCase();
    const fold = m[2]; // '+' 展开 / '-' 折叠 / '' 默认
    const rest = m[3].trim();

    // 剥掉 `[!type]` 标记行，保留剩余文本作为标题
    const remainder = head.value.replace(CALLOUT_RE, '').trim();
    if (remainder) {
      head.value = remainder;
    } else {
      first.children.shift();
    }

    // 标题 paragraph 空了就整体丢弃
    if (first.children.length === 0) {
      node.children.shift();
    }

    const defaultTitle = CALLOUT_TITLES[kind] ?? kind;
    const hasTitle = rest.length > 0 || remainder.length > 0;
    if (!hasTitle) {
      node.children.unshift({
        type: 'paragraph',
        data: { hProperties: { className: ['callout-title'] } },
        children: [{ type: 'strong', children: [text(defaultTitle)] }],
      });
    } else {
      const titlePara = node.children[0];
      if (titlePara && titlePara.type === 'paragraph') {
        titlePara.data = {
          ...(titlePara.data ?? {}),
          hProperties: { className: ['callout-title'] },
        };
      }
    }

    node.data = {
      ...(node.data ?? {}),
      hProperties: {
        className: ['callout', `callout-${kind}`, fold === '-' ? 'is-folded' : ''],
        'data-callout': kind,
        'data-fold': fold || 'default',
      },
    };

    // 标题之后可能还有嵌套内容，继续下钻
    for (const child of node.children) visit(child);
  };

  visit(tree);
}

// ---------------------------------------------------------------------------

export function remarkObsidian(options = {}) {
  const ctx = {
    embedBase: options.embedBase ?? '/images',
    onWikilink: options.onWikilink ?? (() => {}),
  };

  return (tree) => {
    transformCallouts(tree);
    walkInline(tree, ctx);
  };
}

export default remarkObsidian;
