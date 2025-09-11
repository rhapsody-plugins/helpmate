import path from 'path';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react-swc';

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [react(), tailwindcss()],
    base:
      env.VITE_ENVIRONMENT === 'dev'
        ? '/wp-content/plugins/helpmate/public/app/'
        : '/wp-content/plugins/helpmate/public/app/dist/',
    publicDir: false,
    server: {
      cors: true,
      headers: {
        'Access-Control-Allow-Origin': '*',
      },
    },
    build: {
      outDir: 'dist',
      assetsDir: 'assets',
      emptyOutDir: true,
    },
    optimizeDeps: {
      include: ['react', 'react-dom'],
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
      dedupe: ['react', 'react-dom'],
    },
  };
});
