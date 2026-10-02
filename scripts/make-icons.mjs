// public/favicon.svg から PWA 用 PNG アイコンを作る（npm run icons）。Playwright の Chromium を使う。
import { chromium } from 'playwright'
import { readFileSync } from 'node:fs'

const svg = readFileSync(new URL('../public/favicon.svg', import.meta.url), 'utf8')
const exe = process.env.CHROMIUM_PATH
const browser = await chromium.launch({ executablePath: exe, args: ['--no-sandbox'] })

async function render(file, size, { maskable = false } = {}) {
  const page = await browser.newPage({ viewport: { width: size, height: size } })
  // maskable / apple-touch は角丸なしの全面ぬり＋内側に絵（セーフゾーン80%）
  const inner = maskable
    ? `<div style="position:absolute;inset:10%;">${svg.replace('<svg ', '<svg width="100%" height="100%" ')}</div>`
    : svg.replace('<svg ', '<svg width="100%" height="100%" ')
  const bg = maskable || file.startsWith('apple') ? '#ffb84d' : 'transparent'
  await page.setContent(`<body style="margin:0;background:${bg};position:relative;width:${size}px;height:${size}px">${inner}</body>`)
  await page.screenshot({ path: new URL(`../public/${file}`, import.meta.url).pathname, omitBackground: bg === 'transparent' })
  await page.close()
}

await render('icon-192.png', 192)
await render('icon-512.png', 512)
await render('icon-maskable-512.png', 512, { maskable: true })
await render('apple-touch-icon.png', 180)
await browser.close()
