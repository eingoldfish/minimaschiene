/// <reference types="vitest/config" />
import { defineConfig } from 'vite';

export default defineConfig({
  // Relative base path so the build also works in a sub folder (e.g. GitHub Pages).
  base: './',
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    // tests/styles.test.ts reads styles.css as text; without this, Vitest replaces CSS by an empty file
    css: { include: [/styles\.css/] },
  },
});
