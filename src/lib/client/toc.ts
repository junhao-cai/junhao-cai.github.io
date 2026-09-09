/**
 * 目录 scrollspy 客户端模块 —— 两套独立算法，各源自各组件，严禁合并（D4）。
 *
 * - `initToc`：来自 `src/components/Toc.astro`（`.cv-toc`，关于页/简历页侧栏）。
 *   基于滚动位置的「最后一个越过阈值(OFFSET=100)的栏目即当前栏目」算法，
 *   含 data-toc=auto 自动提取、触底强制激活末项。事件：window scroll/resize（passive）+ rAF 节流。
 *   ⛔ AGENTS.md 硬约束：此算法受保护，**禁止引入「点击锁定」**（历史事故：点击后置 locked
 *   导致高亮永久卡死）。本函数必须保持无任何 click 监听器的原状。
 *
 * - `initPostToc`：来自 `src/components/PostToc.astro`（文章页 `.toc-rail`）。
 *   IntersectionObserver 算法（rootMargin '-72px 0px -68% 0px'，threshold 0），
 *   visible Set 跟踪 + 死角兜底（未达首个→亮首项；越过末个→亮末项；否则保持 lastActive）。
 *   两套算法服务不同页面形态，各自原样迁移，不共享任何算法状态。
 */

/**
 * Toc.astro 的 setupToc 逐字迁移（仅改函数名为 initToc，逻辑逐行保留）。
 * 对每个 `.cv-toc` root 调用一次（与原「document.querySelectorAll('.cv-toc').forEach(setupToc)」
 * 的全局遍历语义一致，由调用方负责遍历）。
 */
export function initToc(root: HTMLElement): void {
  const nav = root.querySelector('nav ul');
  if (!nav) return;

  // 自动提取：从指定作用域内抓取 h2/h3 生成目录项
  if (root.dataset.toc === 'auto' && root.dataset.scope) {
    const scope = document.querySelector(root.dataset.scope);
    if (scope) {
      const heads = scope.querySelectorAll('h2, h3');
      const frag = document.createDocumentFragment();
      heads.forEach((h) => {
        const id = h.id;
        if (!id) return;
        const li = document.createElement('li');
        if (h.tagName === 'H3') li.className = 'is-sub';
        const a = document.createElement('a');
        a.href = '#' + id;
        a.dataset.id = id;
        // 去掉 rehype-autolink-headings 注入的锚点元素文本，仅保留标题文字
        const clone = h.cloneNode(true) as HTMLElement;
        clone.querySelectorAll('.heading-anchor, a').forEach((n) => n.remove());
        a.textContent = clone.textContent!.replace(/[¶§#]/g, '').trim();
        li.appendChild(a);
        frag.appendChild(li);
      });
      nav.appendChild(frag);
    }
  }

  const links = Array.from(root.querySelectorAll('a[href^="#"]')) as HTMLAnchorElement[];
  const map = new Map<string, { el: HTMLElement; a: HTMLAnchorElement }>();
  for (const a of links) {
    const id = decodeURIComponent(a.getAttribute('href')!.slice(1));
    const el = document.getElementById(id) as HTMLElement | null;
    if (el) map.set(id, { el, a });
  }
  if (!map.size) return;

  // 按文档顺序排序，保证「最后一个越过阈值的栏目」判断正确
  const sections = [...map.values()].sort((x, y) =>
    x.el.compareDocumentPosition(y.el) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1
  );

  const OFFSET = 100; // 吸顶导航高度 + 余量（跳转停位 scroll-margin 84px 需落在阈值内）
  let ticking = false;

  function update() {
    ticking = false;
    const scrollY = window.scrollY || window.pageYOffset;
    const scrollPos = scrollY + OFFSET;
    let currentId: string | null = null;
    for (const s of sections) {
      const top = s.el.getBoundingClientRect().top + scrollY;
      if (top <= scrollPos) currentId = s.el.id;
      else break;
    }
    // 顶部尚未越过任何栏目时，默认高亮第一项
    if (!currentId && sections.length) currentId = sections[0].el.id;
    // 触底：强制激活末项（末节往往太短，无法滚入顶部带）
    if (window.innerHeight + scrollY >= document.documentElement.scrollHeight - 2) {
      currentId = sections[sections.length - 1].el.id;
    }
    for (const s of sections) s.a.classList.toggle('is-active', s.el.id === currentId);
  }

  function onScroll() {
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(update);
    }
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll, { passive: true });
  update();
}

/**
 * PostToc.astro 的 IIFE 逐字迁移（仅外包为 initPostToc 并补 TS 类型，逻辑逐行保留）。
 * 原脚本为 is:inline 立即执行 + 全局查询 [data-toc-link]；迁移后由调用方在模块加载时调用，
 * 保持同样的全局查询语义（root 参数可选，缺省为 document，与原行为一致）。
 */
export function initPostToc(root?: HTMLElement | Document): void {
  const scope: Document | HTMLElement = root ?? document;
  const links = [...scope.querySelectorAll('[data-toc-link]')];
  if (!links.length || !('IntersectionObserver' in window)) return;
  const byId = new Map<string, Element>();
  for (const a of links) {
    byId.set(decodeURIComponent(a.getAttribute('href')!.slice(1)), a);
  }
  const targets = [...byId.keys()]
    .map((id) => document.getElementById(id))
    .filter((el): el is HTMLElement => Boolean(el));
  if (!targets.length) return;
  const setActive = (id: string): void => {
    for (const a of links) a.classList.remove('is-active');
    const a = byId.get(id);
    if (a) a.classList.add('is-active');
  };
  const visible = new Set<string>();
  let lastActive: string | null = null;
  const docTop = (el: HTMLElement): number => el.getBoundingClientRect().top + window.scrollY;
  const io = new IntersectionObserver(
    (entries) => {
      for (const en of entries) {
        if (en.isIntersecting) visible.add(en.target.id);
        else visible.delete(en.target.id);
      }
      const current = targets.find((t) => visible.has(t.id));
      if (current) {
        lastActive = current.id;
        setActive(current.id);
      } else {
        // 死角兜底：活跃带内无标题时——未到达第一个标题 → 亮第一项；
        // 已越过最后一个标题 → 亮最后一项；其余保持上一个高亮不闪变。
        const y = window.scrollY + 72;
        const first = targets[0];
        const last = targets[targets.length - 1];
        const pick = y < docTop(first) ? first.id : y > docTop(last) ? last.id : lastActive;
        if (pick) {
          lastActive = pick;
          setActive(pick);
        }
      }
    },
    { rootMargin: '-72px 0px -68% 0px', threshold: 0 }
  );
  targets.forEach((t) => io.observe(t));
}
