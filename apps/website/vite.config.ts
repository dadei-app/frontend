import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
/** Monorepo frontend root (`frontend/.env` lives here). */
const frontendRoot = path.resolve(__dirname, '../..');

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, frontendRoot, '');

  const apiUrl = env.API_URL || 'http://localhost:8000';
  const beta = env.BETA || '';

  return {
    plugins: [react()],
    envDir: frontendRoot,
    base: '/',
    assetsInclude: ['**/*.onnx'],
    define: {
      'process.env.API_URL': JSON.stringify(apiUrl),
      'process.env.BETA': JSON.stringify(beta),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, 'src'),
        '@dadei/ui': path.resolve(__dirname, '../../packages/ui/src'),
      },
    },
    build: {
      outDir: 'dist',
      emptyOutDir: true,
    },
    server: {
      port: 5173,
      strictPort: true,
    },
  };
});
