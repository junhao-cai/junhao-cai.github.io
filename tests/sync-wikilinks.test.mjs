// 表征测试（characterization，Wave 1 / T-04）：锁定 scripts/sync-obsidian.mjs ::
// transformWikilinks 的**现有**行为，不代表设计意图。所有 golden 输出逐字取自真实运行
// 转录（.omz/runtime/team-refactor-academic-20260909/results/T-04.json），非人工推演。
// 本文件仅 import 模块：模块已带 CLI entry guard（T-04 加入），import 不触发任何同步副作用。
import { describe, expect, it, vi } from 'vitest';
import { transformWikilinks } from '../scripts/sync-obsidian.mjs';

// knownTitles 数据形状与源码 buildIndex() 一致：Map<小写标题, { url }>。
// posts url 无尾斜杠、pages url 带尾斜杠（与 buildIndex 的拼接规则一致）。
const knownTitles = new Map([
  ['hello world', { url: '/posts/hello-world' }],
  ['research notes', { url: '/pages/research-notes/' }],
]);

const spyLogger = () => ({ warn: vi.fn() });

describe('模块可安全 import（T-04 护栏前提）', () => {
  it('import 本模块不执行同步——若顶层副作用仍在（旧版顶层 VAULT exit(1)），vitest worker 会被杀掉，本测试无从通过', async () => {
    const mod = await import('../scripts/sync-obsidian.mjs');
    expect(typeof mod.transformWikilinks).toBe('function');
  });
});

describe('transformWikilinks · 命中（标题在 knownTitles 内）', () => {
  it('已知标题 → 行内链接，保留前后文（前导字符被正则消费后原样回填）', () => {
    const log = spyLogger();
    expect(transformWikilinks('见 [[Hello World]] 与后续', knownTitles, log)).toBe(
      '见 [Hello World](/posts/hello-world) 与后续'
    );
    expect(log.warn).not.toHaveBeenCalled();
  });

  it('位于串首 → 前导为空，直接产出链接', () => {
    expect(transformWikilinks('[[Hello World]] 开头', knownTitles, spyLogger())).toBe(
      '[Hello World](/posts/hello-world) 开头'
    );
  });

  it('[[目标|别名]] → 显示别名', () => {
    expect(transformWikilinks('[[Hello World|另一篇]]', knownTitles, spyLogger())).toBe(
      '[另一篇](/posts/hello-world)'
    );
  });

  it('别名与目标两侧空格被 trim 后仍命中', () => {
    expect(transformWikilinks('[[Hello World | 别名]]', knownTitles, spyLogger())).toBe(
      '[别名](/posts/hello-world)'
    );
  });

  it('#heading → encodeURIComponent 后拼到 url（空格 → %20）', () => {
    expect(transformWikilinks('[[Hello World#Section Two]]', knownTitles, spyLogger())).toBe(
      '[Hello World](/posts/hello-world#Section%20Two)'
    );
  });

  it('pages 目标（url 带尾斜杠）+ 中文/空格 heading', () => {
    expect(transformWikilinks('[[Research Notes#方法 论]]', knownTitles, spyLogger())).toBe(
      '[Research Notes](/pages/research-notes/#%E6%96%B9%E6%B3%95%20%E8%AE%BA)'
    );
  });

  it('键匹配大小写无关（knownTitles 键为小写）；display 保留原文写法，不改写为 canon 标题', () => {
    expect(transformWikilinks('[[hello WORLD]]', knownTitles, spyLogger())).toBe(
      '[hello WORLD](/posts/hello-world)'
    );
  });
});

describe('transformWikilinks · 未命中降级', () => {
  it('未知标题 → 反引号字面量 + internal-link is-unresolved 标记，data-wikilink 保留原始目标', () => {
    const log = spyLogger();
    expect(transformWikilinks('前文 [[Ghost Note]] 后文', knownTitles, log)).toBe(
      '前文 `Ghost Note`{class="internal-link is-unresolved" data-wikilink="Ghost Note"} 后文'
    );
    expect(log.warn).toHaveBeenCalledTimes(1);
    expect(log.warn).toHaveBeenCalledWith('  ↪ 死链：[[Ghost Note]]');
  });

  it('串首未命中同样降级（前导为空）', () => {
    expect(transformWikilinks('[[Ghost Note]]', knownTitles, spyLogger())).toBe(
      '`Ghost Note`{class="internal-link is-unresolved" data-wikilink="Ghost Note"}'
    );
  });

  it('未命中 + 别名：display 用别名，data-wikilink 用原始目标（不含别名）', () => {
    expect(transformWikilinks('[[Ghost Note|别名]]', knownTitles, spyLogger())).toBe(
      '`别名`{class="internal-link is-unresolved" data-wikilink="Ghost Note"}'
    );
  });

  it('logger 缺省（undefined）时未命中不抛错，降级输出不受影响', () => {
    expect(transformWikilinks('[[Ghost Note]]', knownTitles)).toBe(
      '`Ghost Note`{class="internal-link is-unresolved" data-wikilink="Ghost Note"}'
    );
  });
});

describe('transformWikilinks · 边界与畸形输入（锁现状）', () => {
  it('空串 → 空串', () => {
    expect(transformWikilinks('', knownTitles, spyLogger())).toBe('');
  });

  it('无链接文本原样返回', () => {
    expect(transformWikilinks('普通 markdown 文本，没有链接', knownTitles, spyLogger())).toBe(
      '普通 markdown 文本，没有链接'
    );
  });

  it('未闭合 [[unclosed 原样返回（不匹配、不 warn）', () => {
    const log = spyLogger();
    expect(transformWikilinks('看 [[unclosed 这里', knownTitles, log)).toBe('看 [[unclosed 这里');
    expect(log.warn).not.toHaveBeenCalled();
  });

  it('嵌入 ![[...]] 不由本函数转换（embed 由 syncOne 上游处理），同串内普通 wikilink 照常转换', () => {
    expect(transformWikilinks('![[image.png]] 与 [[Hello World]]', knownTitles, spyLogger())).toBe(
      '![[image.png]] 与 [Hello World](/posts/hello-world)'
    );
  });

  it('链接体内含换行 → 正则排除换行，原样返回', () => {
    expect(transformWikilinks('[[Hello\nWorld]]', knownTitles, spyLogger())).toBe('[[Hello\nWorld]]');
  });

  it('紧邻链接 [[A]][[B]]：仅第一个被转换（现有实现的 lead 消费怪癖，锁现状）', () => {
    expect(transformWikilinks('[[Hello World]][[Ghost Note]]', knownTitles, spyLogger())).toBe(
      '[Hello World](/posts/hello-world)[[Ghost Note]]'
    );
  });

  it('混合文档：命中/未命中各自转换，warn 次数 = 未命中数', () => {
    const log = spyLogger();
    const input = '# 笔记\n\n参见 [[Hello World]] 与 [[Ghost Note|缺文]] 与 [[Research Notes#方法 论]]。';
    expect(transformWikilinks(input, knownTitles, log)).toBe(
      '# 笔记\n\n参见 [Hello World](/posts/hello-world) 与 ' +
        '`缺文`{class="internal-link is-unresolved" data-wikilink="Ghost Note"} 与 ' +
        '[Research Notes](/pages/research-notes/#%E6%96%B9%E6%B3%95%20%E8%AE%BA)。'
    );
    expect(log.warn).toHaveBeenCalledTimes(1);
    expect(log.warn).toHaveBeenCalledWith('  ↪ 死链：[[Ghost Note]]');
  });
});
