import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true
      },
      '/ws': {
        target: 'ws://localhost:3000',
        ws: true
      }
    },
    allowedHosts: ['localhost', 'mogiten-display.syutarou.xyz']
  },
  build: {
    outDir: 'dist/client',
    emptyOutDir: true
  }
});
