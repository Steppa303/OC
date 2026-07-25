import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { amyEnginePlugin } from '@amy/engine/vite';

export default defineConfig({
  plugins: [react(), amyEnginePlugin()],
});
