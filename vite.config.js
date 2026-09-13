import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Custom plugin to ensure Code.gs is safely preserved and placed in the gas/ output folder
function preserveCodeGsPlugin() {
  let codeGsContent = null;

  return {
    name: 'preserve-code-gs',
    buildStart() {
      // Retain Code.gs content from candidate locations (gas/Code.gs or root Code.gs)
      const candidates = [
        path.resolve(__dirname, 'Code.gs'),
        path.resolve(__dirname, 'gas', 'Code.gs'),
      ].filter((p) => fs.existsSync(p));

      if (candidates.length > 0) {
        candidates.sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
        codeGsContent = fs.readFileSync(candidates[0], 'utf-8');
      }
    },
    closeBundle() {
      const gasDir = path.resolve(__dirname, 'gas');
      const targetFile = path.resolve(gasDir, 'Code.gs');

      if (!fs.existsSync(gasDir)) {
        fs.mkdirSync(gasDir, { recursive: true });
      }

      if (codeGsContent) {
        fs.writeFileSync(targetFile, codeGsContent, 'utf-8');
      }
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    viteSingleFile(),
    preserveCodeGsPlugin(),
  ],

  build: {
    // Output directly to gas/ directory for GAS deployment
    outDir: 'gas',

    // Do not empty outDir so Code.gs is never deleted by Vite
    emptyOutDir: false,

    // Prevent copying raw public static assets into the GAS deployment directory
    copyPublicDir: false,

    // Target modern browsers — balances bundle size with compatibility
    target: 'es2017',

    // Disable source maps in production (reduces output size significantly)
    sourcemap: false,

    // Minify with oxc (Vite 8 built-in, fastest, no extra install needed)
    minify: true,

    // Minify CSS as well
    cssMinify: true,

    // Raise chunk size warning limit (large views are expected in a single-file GAS app)
    chunkSizeWarningLimit: 2500,

    rollupOptions: {
      output: {
        // Merge all chunks into a single output for GAS single-file deployment
        manualChunks: undefined,
      },
    },
  },

  // esbuild options: drop console.* and debugger statements from the production bundle
  esbuild: {
    drop: ['console', 'debugger'],
  },
});


