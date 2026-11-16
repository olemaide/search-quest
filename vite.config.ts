import path from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// One build produces the whole unpacked extension in dist/:
//  - app/app.html + app/panel.html  → React + shadcn/ui UI (full page + side panel)
//  - background.js                  → module service worker (shares lib/ chunks with the UI)
//  - public/                        → manifest, content script (vanilla, shadow DOM), icons
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@ext': path.resolve(import.meta.dirname, './lib'),
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    target: 'chrome116',
    chunkSizeWarningLimit: 900, // loaded from disk, not the network
    modulePreload: { polyfill: false },
    rollupOptions: {
      input: {
        app: path.resolve(import.meta.dirname, 'app/app.html'),
        panel: path.resolve(import.meta.dirname, 'app/panel.html'),
        background: path.resolve(import.meta.dirname, 'background.js'),
      },
      output: {
        entryFileNames: (chunk) => (chunk.name === 'background' ? 'background.js' : 'assets/[name]-[hash].js'),
      },
    },
  },
});
