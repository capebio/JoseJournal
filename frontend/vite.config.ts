import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tsconfigPaths from 'vite-tsconfig-paths';

// Path aliases come from tsconfig.json `paths` via vite-tsconfig-paths — robust to
// project-root path casing on Windows (where manual string aliases mis-match).
export default defineConfig({
  plugins: [react(), tsconfigPaths()],
  server: { port: 5280, host: true, strictPort: false },
});
