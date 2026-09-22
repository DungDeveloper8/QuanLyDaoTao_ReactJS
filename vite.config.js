import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { createApplication } from './server.mjs';

function developmentApi() {
  return {
    name: 'development-api',
    configureServer(server) {
      server.middlewares.use(createApplication());
    },
  };
}

export default defineConfig({
  plugins: [developmentApi(), react()],
});
