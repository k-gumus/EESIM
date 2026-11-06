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
    plugins: [
      react(),
      ...(single ? [viteSingleFile()] : []),
      // Worker testleri schema.sql'i metin olarak içe aktarır (wrangler'daki "Text" kuralının karşılığı)
      { name: 'sql-as-text', transform: (code: string, id: string) => (id.endsWith('.sql') ? `export default ${JSON.stringify(code)};` : undefined) },
    ],
    define: { __SINGLE_FILE__: JSON.stringify(single) },
    resolve: single
      ? { alias: { '@mlc-ai/web-llm': fileURLToPath(new URL('./src/ai/webllm-stub.ts', import.meta.url)) } }
      : undefined,
    build: {
      outDir: single ? 'dist-single' : 'dist',
      assetsInlineLimit: single ? 100_000_000 : 4096,
      chunkSizeWarningLimit: 4000,
      // Tek dosya modunda her şey tek parçada olmalı; normal derlemede React/React Flow'u
      // ayrı "vendor" parçasına al: nadiren değişir, tarayıcı sürümler arası önbellekte tutar.
      rollupOptions: single
        ? undefined
        : { output: { manualChunks: { vendor: ['react', 'react-dom', '@xyflow/react', 'zustand'] } } },
    },
    test: { environment: 'node', include: ['src/**/*.test.ts', 'worker/**/*.test.ts'] },
  };
});
