import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const isGas = mode === 'gas' || process.env.BUILD_GAS === 'true';

  return {
    plugins: [
      react(),
      isGas && viteSingleFile(),
    ].filter(Boolean),

    server: {
      port: 5173,
      proxy: {
        '/api': {
          target: 'http://localhost:3001',
          changeOrigin: true,
        },
      },
    },

    define: {
      ...(isGas ? { 'import.meta.env.VITE_USE_GAS': JSON.stringify('true') } : {}),
    },

    build: {
      outDir: isGas ? 'dist-gas' : 'dist',
      emptyOutDir: true,
      target: 'es2020',
      minify: isGas ? 'terser' : 'esbuild',
      terserOptions: isGas
        ? {
            compress: {
              drop_console: true,
              drop_debugger: true,
            },
          }
        : undefined,
      cssCodeSplit: !isGas,
      assetsInlineLimit: isGas ? 10240 : 4096,
      chunkSizeWarningLimit: 10000,
      sourcemap: false,
    },
  };
});
