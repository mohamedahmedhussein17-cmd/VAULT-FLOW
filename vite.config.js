import { defineConfig } from 'vite';

export default defineConfig({
  // Use relative base path so it works on any subpath (like GitHub Pages)
  base: './',
  build: {
    rollupOptions: {
      input: {
        main: 'index.html',
        dashboard: 'dashboard.html',
      },
    },
  },
});
