import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Amplify v6 uses browser globals that Vite doesn't polyfill by default.
  define: {
    global: 'globalThis',
  },
  resolve: {
    alias: {
      // Point Vite directly at the shared package source so TypeScript
      // changes there are reflected immediately without a rebuild step.
      '@united-portal/shared': path.resolve(__dirname, '../shared/src/index.ts'),
    },
  },
});
