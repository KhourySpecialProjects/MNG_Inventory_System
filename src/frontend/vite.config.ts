import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      // Forward /api/* to the API dev server
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true
      }
    }
  },
  build: { outDir: 'dist' }
});
