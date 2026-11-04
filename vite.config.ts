import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// React Native roda no navegador via react-native-web
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { 'react-native': 'react-native-web' },
    extensions: ['.web.tsx', '.web.ts', '.tsx', '.ts', '.js'],
  },
  define: { __DEV__: JSON.stringify(true) },
});
