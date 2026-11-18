import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Le proxy redirige /api vers le backend local (port 4000 par défaut).
export default defineConfig({
  plugins: [react()],
  server: { port: 5173, proxy: { '/api': process.env.VITE_API_URL || 'http://localhost:4000' } },
});
