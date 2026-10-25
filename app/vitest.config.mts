import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  // Same "@/..." imports as tsconfig.json, set here directly so they also
  // work in acceptance/, which tsconfig leaves out of the type check.
  resolve: {
    alias: { '@': fileURLToPath(new URL('./', import.meta.url)) },
  },
  // tsconfig's "jsx": "preserve" leaves JSX for Next to compile, which vitest
  // doesn't go through, so tell esbuild to handle it here.
  esbuild: {
    jsx: 'automatic',
  },
  test: {
    environment: 'jsdom',
    include: ['**/*.test.ts', '**/*.test.tsx'],
    exclude: ['node_modules', '.next'],
    setupFiles: ['./vitest.setup.ts'],
  },
})
