/// <reference types="vitest/config" />
/// <reference types="node" />
import { execSync } from 'node:child_process';
import { defineConfig } from 'vite';

/** Date (YYYY-MM-DD) and short hash of the last commit – shown as the version in the footer.
 *  GitHub Actions builds on every push to main, so the published version is always up to date. */
function gitVersion(): { date: string; commit: string } {
  try {
    const [date = '', commit = ''] = execSync('git log -1 --format=%cs%n%h', { encoding: 'utf8' }).trim().split('\n');
    return { date, commit };
  } catch {
    return { date: new Date().toISOString().slice(0, 10), commit: '' };
  }
}
const version = gitVersion();

export default defineConfig({
  // Relative base path so the build also works in a sub folder (e.g. GitHub Pages).
  base: './',
  define: {
    __BUILD_DATE__: JSON.stringify(version.date),
    __BUILD_COMMIT__: JSON.stringify(version.commit),
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    // tests/styles.test.ts reads styles.css as text; without this, Vitest replaces CSS by an empty file
    css: { include: [/styles\.css/] },
  },
});
