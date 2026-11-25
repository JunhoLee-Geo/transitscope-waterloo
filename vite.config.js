import { defineConfig } from 'vite';
export default defineConfig({
  base: process.env.GITHUB_ACTIONS ? '/transitscope-waterloo/' : './',
  // Python inputs/environments are not application source; avoid Windows file locks.
  server: { watch: { ignored: ['**/.venv/**', '**/data/reference/**', '**/data/raw/**', '**/data/processed/**', '**/.prepare-*/**'] } },
});

