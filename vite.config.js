import { defineConfig } from 'vite';
import basicSsl from '@vitejs/plugin-basic-ssl';
import { viteSingleFile } from 'vite-plugin-singlefile';

// mode "quest": server di sviluppo in https sulla rete locale (il Quest richiede https per WebXR)
// mode "single": un unico file HTML autosufficiente (utile per anteprime e condivisione)
export default defineConfig(({ mode }) => ({
  base: './',
  plugins: [
    mode === 'quest' && basicSsl(),
    mode === 'single' && viteSingleFile(),
  ].filter(Boolean),
  build: {
    outDir: mode === 'single' ? 'dist-single' : 'dist',
    target: 'es2020',
  },
  server: { host: mode === 'quest' },
}));
