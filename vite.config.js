import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: '/skilltree3/',
  plugins: [react()],
  // Dedicated port so the dev server never collides with other local projects.
  server: { 
    host: true, port: 5180, strictPort: true },
});
