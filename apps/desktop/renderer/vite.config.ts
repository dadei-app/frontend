import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const desktopRoot = path.resolve(__dirname, '..');
/** Monorepo frontend root (`frontend/.env` lives here). */
const frontendRoot = path.resolve(__dirname, '../../..');

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, frontendRoot, '');

  const apiUrl = env.API_URL || 'http://localhost:8000';
  const beta = env.BETA || '';
  /** Dedicated dev port (avoids clashing with website Vite on 5173 and other common tools). */
  const rendererDevPort = Number(env.RENDERER_DEV_PORT || '59247');

  return {
    root: __dirname,
    envDir: frontendRoot,
    base: './',
    assetsInclude: ['**/*.onnx'],
    plugins: [react()],
    define: {
      'process.env.API_URL': JSON.stringify(apiUrl),
      'process.env.BETA': JSON.stringify(beta),
    },
    resolve: {
      alias: {
        '@dadei/ui': path.resolve(__dirname, '../../../packages/ui/src'),
      },
    },
    build: {
      outDir: 'dist',
      emptyOutDir: true,
    },
    server: {
      port: rendererDevPort,
      strictPort: true,
      // Match wait-on / Electron dev URL (localhost) so HEAD/GET checks are reliable.
      host: '127.0.0.1',
    },
  };
});
