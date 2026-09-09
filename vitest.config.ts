// Vitest 配置 — Phase 0 测试护栏（plan T-02）。
// passWithNoTests 仅为波次执行期「空测试集」的过渡开关：T-02 落地时 tests/ 尚无测试文件，
// 从 T-03 起将在 tests/ 下落地 bibtex / sync-obsidian / url 等真实表征测试，
// 届时该开关仅防「测试文件被误删/误改名导致静默通过」，不得作为掩盖真实测试失败的手段。
// 测试目录约定：tests/（所有 *.test.ts / *.test.mjs / *.test.js 放这里）。
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.{ts,mjs,js}'],
    passWithNoTests: true,
  },
});
