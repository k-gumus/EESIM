/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { fileURLToPath } from 'node:url';

// `npm run build`         → dist/ (GitHub Pages / Vercel uyumlu, göreli yollar)
// `npm run build:single`  → dist-single/index.html (çift tıkla açılan tek dosya; WebLLM hariç)
export default defineConfig(({ mode }) => {
  const single = mode === 'single';
  return {
    base: './',
    plugins: [react(), ...(single ? [viteSingleFile()] : [])],
    define: { __SINGLE_FILE__: JSON.stringify(single) },
    resolve: single
      ? { alias: { '@mlc-ai/web-llm': fileURLToPath(new URL('./src/ai/webllm-stub.ts', import.meta.url)) } }
      : undefined,
    build: {
      outDir: single ? 'dist-single' : 'dist',
      assetsInlineLimit: single ? 100_000_000 : 4096,
      chunkSizeWarningLimit: 4000,
    },
    test: { environment: 'node', include: ['src/**/*.test.ts'] },
  };
});
