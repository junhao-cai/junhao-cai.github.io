/**
 * 论文引用交互：APA/IEEE/MLA 切换 + 复制（事件委托，全站一份）。
 *
 * 抽自 BaseLayout 的 is:inline + define:vars 内联脚本（Phase 2 / Wave 3 T-12）。
 * 事件委托逻辑逐字迁移：选择器、is-active class、aria-pressed、hidden、剪贴板、
 * 1600ms 还原时序全部保留。
 * 文案不再由 define:vars 闭包注入，改从 document.body.dataset 读取
 * data-cite-copied-text / data-cite-copy-text（由 BaseLayout 按 lang 渲染），
 * 兜底为 zh 文案（与旧 lang=zh 分支一致）。
 */

const FALLBACK_COPIED_TEXT = '已复制';
const FALLBACK_COPY_TEXT = '复制引用';

export function initCiteInteraction(): void {
  const copiedText = document.body.dataset.citeCopiedText || FALLBACK_COPIED_TEXT;
  const copyText = document.body.dataset.citeCopyText || FALLBACK_COPY_TEXT;

  document.addEventListener('click', (e) => {
    const t = e.target instanceof Element ? e.target : null;
    if (!t) return;
    const tab = t.closest<HTMLElement>('[data-cite-tab]');
    if (tab) {
      const box = tab.closest('details');
      if (!box) return;
      box.querySelectorAll('[data-cite-tab]').forEach((b) => {
        b.classList.toggle('is-active', b === tab);
        b.setAttribute('aria-pressed', String(b === tab));
      });
      box.querySelectorAll<HTMLElement>('[data-cite-text]').forEach((d) => {
        d.hidden = d.dataset.citeText !== tab.dataset.citeTab;
      });
      return;
    }
    const copyBtn = t.closest('[data-cite-copy]');
    if (copyBtn && navigator.clipboard) {
      const box = copyBtn.closest('details');
      const cur = box && box.querySelector('[data-cite-text]:not([hidden])');
      if (cur) {
        navigator.clipboard.writeText(cur.textContent!.trim()).then(() => {
          copyBtn.textContent = copiedText;
          setTimeout(() => {
            copyBtn.textContent = copyText;
          }, 1600);
        });
      }
    }
  });
}

initCiteInteraction();
