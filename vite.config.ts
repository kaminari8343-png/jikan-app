import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// GitHub Pages のリポジトリ名に合わせる（https://<user>.github.io/jikan-app/）
const REPO_NAME = 'jikan-app'

// ビルドした日時と、コミットの短い番号（GitHub Actions の GITHUB_SHA）。画面の「バージョン」に出して、
// 「いま見ている画面が、いつの版か」を たしかめられるようにする（キャッシュで古い版のままか、見わけるため）
const BUILD = { time: new Date().toISOString(), sha: (process.env.GITHUB_SHA ?? 'dev').slice(0, 7) }

/** ビルドの情報を version.json として公開する。アプリは これを見て「あたらしい版が出ているか」をたしかめる */
const emitVersionJson = {
  name: 'emit-version-json',
  generateBundle(this: { emitFile: (f: { type: 'asset'; fileName: string; source: string }) => void }) {
    this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify(BUILD) })
  },
}

export default defineConfig({
  base: `/${REPO_NAME}/`,
  define: { __BUILD__: JSON.stringify(BUILD) },
  plugins: [
    react(),
    emitVersionJson,
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['apple-touch-icon.png', 'favicon.svg'],
      manifest: {
        name: 'きょうのよてい',
        short_name: 'よてい',
        description: 'かえってから じぶんでよていを きめて すすめるアプリ',
        lang: 'ja',
        theme_color: '#ffb84d',
        background_color: '#fff6e5',
        display: 'standalone',
        orientation: 'any',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: { globPatterns: ['**/*.{js,css,html,svg,png}'] },
    }),
  ],
  test: { include: ['src/**/*.test.{ts,tsx}'] },
})
