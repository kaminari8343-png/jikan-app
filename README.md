# きょうのよてい（jikan-app）

小学生が、帰宅後のスケジュールを自分で並べて、音声ガイドつきで実行するための PWA です。
React + Vite + TypeScript / データは localStorage に保存。

## 開発

```sh
npm install
npm run dev      # http://localhost:5173/jikan-app/
npm test         # 時間計算・読み上げ(かな)のテスト
npm run build
```

## セリフを変える
`src/phrases.ts` だけ編集します（`{name}` `{min}` `{next}` が使えます）。
アプリの ⚙️ せってい →「テストさいせい」で、読み間違いがないか確認できます。

## 公開（GitHub Pages）
1. GitHub の **Settings → Pages → Source** を **GitHub Actions** にする（最初の1回だけ）
2. `main` に push すると `.github/workflows/deploy.yml` が自動でビルド＆デプロイ
3. `https://<ユーザー名>.github.io/jikan-app/` を iPad/スマホの Safari で開き、共有 →「ホーム画面に追加」

リポジトリ名を変えたら `vite.config.ts` の `REPO_NAME` も変えてください。

## アイコンの作り直し
`public/favicon.svg` を編集して `CHROMIUM_PATH=<chromiumのパス> npm run icons`。
