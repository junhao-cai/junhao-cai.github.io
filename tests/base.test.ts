/**
 * src/lib/base.ts —— Base Authority（ADR-003）行为单测（T-08，Phase 1 基地址收口）。
 *
 * 本文件是「双 base 场景表」：用户站 BASE_URL='/'（junhao-cai.github.io）与
 * 项目站 BASE_URL='/repo/'（GitHub Pages 项目仓库）两种部署下的权威行为规范。
 * golden 值三来源：
 *   1. 与 tests/url.test.ts 同输入的 golden 逐字一致（表征对齐，T-09 迁移后
 *      url.test.ts 必须仍绿）；
 *   2. basePath/localizedPath 的归一规则为本模块新定义的权威行为（首次写死）；
 *   3. 畸形输入（空串 / 多前导斜杠 / 恰等 base / 段前缀不匹配）的行为在本文件
 *      定义并锁定，实现必须防御性一致。
 *
 * mock 方式：vi.stubEnv + vi.unstubAllEnvs（本仓 vitest 5.0.0 下对
 * import.meta.env 直接赋值不会传导到被测模块，见 tests/url.test.ts 头注实证）。
 * 实现必须**惰性**读 env（函数内部读取，不做模块级缓存），否则 stubEnv 失效。
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { absoluteUrl, basePath, localizedPath, stripBase, stripBaseSuffix, withBase } from '../src/lib/base';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('basePath() — BASE_URL 归一为「带前导+尾斜杠」形态', () => {
  const CASES: Array<[string, string, string]> = [
    ["BASE_URL 空串 → '/'（回退根）", '', '/'],
    ["BASE_URL '/' → '/'（幂等）", '/', '/'],
    ["BASE_URL 'repo' → '/repo/'（无前导斜杠，权威归一补齐）", 'repo', '/repo/'],
    ["BASE_URL '/repo' → '/repo/'（补尾斜杠）", '/repo', '/repo/'],
    ["BASE_URL '/repo/' → '/repo/'（幂等）", '/repo/', '/repo/'],
  ];
  for (const [name, input, expected] of CASES) {
    it(name, () => {
      vi.stubEnv('BASE_URL', input);
      expect(basePath()).toBe(expected);
    });
  }
});

describe("withBase() — BASE_URL = '/'（用户站 junhao-cai.github.io，golden 对齐 url.test.ts）", () => {
  beforeEach(() => {
    vi.stubEnv('BASE_URL', '/');
  });

  it("withBase('/cv') → '/cv'", () => {
    expect(withBase('/cv')).toBe('/cv');
  });

  it("withBase('cv') → '/cv'（前导斜杠被吞，与带斜杠形态等价）", () => {
    expect(withBase('cv')).toBe('/cv');
  });

  it("withBase('/') → '/'（base 与 path 双斜杠归一，不产生 '//'）", () => {
    expect(withBase('/')).toBe('/');
  });
});

describe("withBase() — BASE_URL = '/repo/'（项目站，golden 对齐 url.test.ts）", () => {
  beforeEach(() => {
    vi.stubEnv('BASE_URL', '/repo/');
  });

  it("withBase('/cv') → '/repo/cv'", () => {
    expect(withBase('/cv')).toBe('/repo/cv');
  });

  it("withBase('cv') → '/repo/cv'", () => {
    expect(withBase('cv')).toBe('/repo/cv');
  });

  it("withBase('/') → '/repo/'（不产生 '/repo//'）", () => {
    expect(withBase('/')).toBe('/repo/');
  });

  it("withBase('/a/b/') → '/repo/a/b/'（尾斜杠保留）", () => {
    expect(withBase('/a/b/')).toBe('/repo/a/b/');
  });
});

describe('withBase() — 畸形输入（防御性行为，权威定义并锁定）', () => {
  beforeEach(() => {
    vi.stubEnv('BASE_URL', '/repo/');
  });

  it("withBase('') → '/repo/'（空路径 = base 本身）", () => {
    expect(withBase('')).toBe('/repo/');
  });

  it("withBase('///') → '/repo/'（前导多斜杠全部吞掉）", () => {
    expect(withBase('///')).toBe('/repo/');
  });

  it("withBase('/a//b') → '/repo/a//b'（仅归一前导斜杠，内部斜杠不折叠——与 url() 现状一致）", () => {
    expect(withBase('/a//b')).toBe('/repo/a//b');
  });
});

describe("stripBase() — BASE_URL = '/repo/'（golden 对齐 url.test.ts）", () => {
  beforeEach(() => {
    vi.stubEnv('BASE_URL', '/repo/');
  });

  it("'/repo/cv/' → '/cv/'", () => {
    expect(stripBase('/repo/cv/')).toBe('/cv/');
  });

  it("'/cv/' → '/cv/'（不匹配前缀 → 原样回退）", () => {
    expect(stripBase('/cv/')).toBe('/cv/');
  });

  it("'/repo/cv' → '/cv'（无尾斜杠也剥）", () => {
    expect(stripBase('/repo/cv')).toBe('/cv');
  });

  it("'/repo' → '/repo'（恰好等于 base 但无后续 '/' → 不剥，回退原样）", () => {
    expect(stripBase('/repo')).toBe('/repo');
  });

  it("'/repository/x' → 原样（前缀按整段匹配 '/repo/'，不吃 '/repo' 子串）", () => {
    expect(stripBase('/repository/x')).toBe('/repository/x');
  });

  it("'' → ''（空输入原样回退）", () => {
    expect(stripBase('')).toBe('');
  });
});

describe("stripBase() — BASE_URL = '/'（base 归一后为空 → 恒等，golden 对齐 url.test.ts）", () => {
  beforeEach(() => {
    vi.stubEnv('BASE_URL', '/');
  });

  it("'/cv/' → '/cv/'", () => {
    expect(stripBase('/cv/')).toBe('/cv/');
  });

  it("'/repo/cv/' → '/repo/cv/'（用户站下任何 pathname 都不剥）", () => {
    expect(stripBase('/repo/cv/')).toBe('/repo/cv/');
  });
});

describe('localizedPath() — 语言前缀（D9：规则内联，零 i18n 依赖）', () => {
  describe('zh → 恒等（原样返回，含畸形输入）', () => {
    it("('/cv', 'zh') → '/cv'", () => {
      expect(localizedPath('/cv', 'zh')).toBe('/cv');
    });

    it("('/', 'zh') → '/'", () => {
      expect(localizedPath('/', 'zh')).toBe('/');
    });

    it("('/posts/x/', 'zh') → '/posts/x/'（尾斜杠保留）", () => {
      expect(localizedPath('/posts/x/', 'zh')).toBe('/posts/x/');
    });

    it("('', 'zh') → ''（畸形输入恒等）", () => {
      expect(localizedPath('', 'zh')).toBe('');
    });

    it("('cv', 'zh') → 'cv'（无前导斜杠原样）", () => {
      expect(localizedPath('cv', 'zh')).toBe('cv');
    });
  });

  describe("en → 加 '/en' 前缀（纯前缀拼接：斜杠拼接无重复，尾斜杠随输入）", () => {
    it("('/cv', 'en') → '/en/cv'", () => {
      expect(localizedPath('/cv', 'en')).toBe('/en/cv');
    });

    it("('/', 'en') → '/en'（不是 '/en/'）", () => {
      expect(localizedPath('/', 'en')).toBe('/en');
    });

    it("('/posts/x/', 'en') → '/en/posts/x/'（尾斜杠保留，不做 withLang 式归一）", () => {
      expect(localizedPath('/posts/x/', 'en')).toBe('/en/posts/x/');
    });

    it("('/cv/', 'en') → '/en/cv/'（输入带尾斜杠则输出带尾斜杠）", () => {
      expect(localizedPath('/cv/', 'en')).toBe('/en/cv/');
    });

    it("('cv', 'en') → '/en/cv'（无前导斜杠补齐）", () => {
      expect(localizedPath('cv', 'en')).toBe('/en/cv');
    });

    it("('', 'en') → '/en'", () => {
      expect(localizedPath('', 'en')).toBe('/en');
    });

    it("('///cv', 'en') → '/en/cv'（前导多斜杠吞掉）", () => {
      expect(localizedPath('///cv', 'en')).toBe('/en/cv');
    });

    it("('/en/cv', 'en') → '/en/en/cv'（纯前缀不查重；去既有 /en 是调用方职责）", () => {
      expect(localizedPath('/en/cv', 'en')).toBe('/en/en/cv');
    });
  });
});

describe('absoluteUrl() — canonical / RSS / OG（golden 对齐 url.test.ts，含双拼怪癖）', () => {
  it("site 含尾斜杠 + BASE_URL '/repo/' → 现状双拼（site 已含 repo，withBase 再拼 BASE_URL）", () => {
    vi.stubEnv('BASE_URL', '/repo/');
    expect(absoluteUrl('/cv', 'https://x.github.io/repo/')).toBe('https://x.github.io/repo/repo/cv');
  });

  it("site 不含尾斜杠 'https://x.github.io/repo' → 双拼现状一致", () => {
    vi.stubEnv('BASE_URL', '/repo/');
    expect(absoluteUrl('/cv', 'https://x.github.io/repo')).toBe('https://x.github.io/repo/repo/cv');
  });

  it("BASE_URL '/' + site origin → 单拼（无双拼陷阱），path 尾斜杠保留", () => {
    vi.stubEnv('BASE_URL', '/');
    expect(absoluteUrl('/cv/', 'https://junhao-cai.github.io/')).toBe('https://junhao-cai.github.io/cv/');
  });

  it('site 缺省 → 回退 import.meta.env.SITE（含尾斜杠，去尾斜杠后单拼）', () => {
    vi.stubEnv('BASE_URL', '/');
    vi.stubEnv('SITE', 'https://junhao-cai.github.io/');
    expect(absoluteUrl('/cv/')).toBe('https://junhao-cai.github.io/cv/');
  });

  it('site 缺省 → SITE 不含尾斜杠同样处理', () => {
    vi.stubEnv('BASE_URL', '/');
    vi.stubEnv('SITE', 'https://junhao-cai.github.io');
    expect(absoluteUrl('/cv/')).toBe('https://junhao-cai.github.io/cv/');
  });

  it("SITE 为空串 → origin 为空串，结果是相对路径（?? 不拦空串，现状如此）", () => {
    vi.stubEnv('BASE_URL', '/repo/');
    vi.stubEnv('SITE', '');
    expect(absoluteUrl('/cv/')).toBe('/repo/cv/');
  });

  it('SITE 未设（env 无该键）→ origin 空串 → 相对路径', () => {
    vi.stubEnv('BASE_URL', '/');
    const env = import.meta.env as any;
    const had = 'SITE' in env;
    const saved = env.SITE;
    delete env.SITE;
    try {
      expect(absoluteUrl('/cv/')).toBe('/cv/');
    } finally {
      if (had) env.SITE = saved;
    }
  });
});

describe('stripBaseSuffix() — 站点源地址去 base 后缀（T-09 自 site.config.ts SITE.url 原样迁入，追加场景）', () => {
  it("BASE_URL '/repo/' + 'https://x.github.io/repo/' → 'https://x.github.io'（带尾斜杠）", () => {
    vi.stubEnv('BASE_URL', '/repo/');
    expect(stripBaseSuffix('https://x.github.io/repo/')).toBe('https://x.github.io');
  });

  it("BASE_URL '/repo/' + 'https://x.github.io/repo' → 'https://x.github.io'（无尾斜杠）", () => {
    vi.stubEnv('BASE_URL', '/repo/');
    expect(stripBaseSuffix('https://x.github.io/repo')).toBe('https://x.github.io');
  });

  it("BASE_URL '/' + 'https://junhao-cai.github.io/' → 去尾斜杠（用户站，无可删 base 段）", () => {
    vi.stubEnv('BASE_URL', '/');
    expect(stripBaseSuffix('https://junhao-cai.github.io/')).toBe('https://junhao-cai.github.io');
  });

  it("BASE_URL '/' + 'https://example.github.io' → 原样（默认 env 现状锚，正则 '//?$' 不命中）", () => {
    vi.stubEnv('BASE_URL', '/');
    expect(stripBaseSuffix('https://example.github.io')).toBe('https://example.github.io');
  });

  it("BASE_URL '/repo/' + 'https://x.io/repo/team' → 原样（正则锚定结尾，中段不误删）", () => {
    vi.stubEnv('BASE_URL', '/repo/');
    expect(stripBaseSuffix('https://x.io/repo/team')).toBe('https://x.io/repo/team');
  });

  it("BASE_URL '/v1.2/' + 'https://x.io/v1.2' → 'https://x.io'（正则元字符转义，与原实现同一字符类）", () => {
    vi.stubEnv('BASE_URL', '/v1.2/');
    expect(stripBaseSuffix('https://x.io/v1.2')).toBe('https://x.io');
  });

  it("BASE_URL '/repo/' + 'https://x.io/repo/repo/' → 'https://x.io/repo'（结尾只删一处）", () => {
    vi.stubEnv('BASE_URL', '/repo/');
    expect(stripBaseSuffix('https://x.io/repo/repo/')).toBe('https://x.io/repo');
  });

  it("BASE_URL 'repo'（无前导斜杠）+ 'https://x.io/repo/' → 'https://x.io'（归一与原实现一致）", () => {
    vi.stubEnv('BASE_URL', 'repo');
    expect(stripBaseSuffix('https://x.io/repo/')).toBe('https://x.io');
  });
});

describe('D9 架构守卫 — base.ts 零 i18n 依赖', () => {
  it('src/lib/base.ts 源码不得 import src/i18n/*（语言前缀规则必须内联）', () => {
    const source = readFileSync(fileURLToPath(new URL('../src/lib/base.ts', import.meta.url)), 'utf8');
    expect(/from\s+['"][^'"]*i18n/.test(source), 'base.ts 不得 import src/i18n/*（D9）').toBe(false);
  });
});
