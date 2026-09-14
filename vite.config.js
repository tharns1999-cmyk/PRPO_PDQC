import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Custom plugin to ensure Code.gs is safely placed in the gas/ output folder if maintained at root
function preserveCodeGsPlugin() {
  return {
    name: 'preserve-code-gs',
    closeBundle() {
      const rootCodeGs = path.resolve(__dirname, 'Code.gs');
      const gasCodeGs = path.resolve(__dirname, 'gas', 'Code.gs');
      if (fs.existsSync(rootCodeGs)) {
        const rootContent = fs.readFileSync(rootCodeGs, 'utf-8');
        fs.writeFileSync(gasCodeGs, rootContent, 'utf-8');
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
    target: 'es2020',

    // Disable source maps in production (reduces output size significantly)
    sourcemap: false,

    // Minify with terser (maximum compression & dead-code elimination)
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
        pure_funcs: ['console.log', 'console.info', 'console.debug', 'console.warn'],
      },
      format: {
        comments: false,
      },
    },

    // Minify CSS as well
    cssMinify: true,

    // Raise chunk size warning limit (large views are expected in a single-file GAS app)
    chunkSizeWarningLimit: 3500,

    rollupOptions: {
      output: {
        // Merge all chunks into a single output for GAS single-file deployment
        manualChunks: undefined,
      },
    },
  },
});


