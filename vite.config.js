import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [tailwindcss(), vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  },
  optimizeDeps: {
    include: ['dayjs', 'lodash-es'],
    esbuildOptions: {}
  },
  server: {
    host: '0.0.0.0',
    port: 3800,
    open: false,
    proxy: {
      '/uploads': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true
      },
      // 通用接口
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true
      },
      '/updates': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true
      }
    }
  },
  css: {},
  build: {
    minify: 'esbuild', // 默认值：esbuild，它比 terser 快 20-40 倍，压缩率只差 1%-2%
    // 使用 esbuild，情况下配置
    esbuild: {
      drop: ['console', 'debugger']
    },
    rollupOptions: {
      output: {
        // experimentalMinChunkSize: 10 * 1024, // 单位b
        chunkFileNames: 'js/[name].[hash].js', // 引入文件名的名称
        entryFileNames: 'js/[name].[hash].js', // 包入口文件名称
        assetFileNames: '[ext]/[name].[hash].[ext]', // 资源文件字体和图片等
        // 最小化拆分包
        manualChunks(id) {
          if (id.includes('xe-utils')) return 'xe-utils'
          if (id.includes('node_modules')) return 'vendor'
          // }
        }
      }
    }
  }
})
