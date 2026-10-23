import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { preview } from 'vite'
import { findBrowser, launch } from './cdp.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const out = path.join(root, 'docs/screenshots')
const plugin = JSON.parse(fs.readFileSync(path.join(root, 'utools/plugin.json'), 'utf8'))
if (!findBrowser()) throw new Error('请安装 Chrome 或通过 CHROME_PATH 指定 Chromium 浏览器')
fs.mkdirSync(out, { recursive: true })
const server = await preview({ root, preview: { host: '127.0.0.1', port: 0, open: false } })
let browser
try {
  browser = await launch({ url: server.resolvedUrls.local[0] })
  const { session } = browser
  const errors = []
  const externalRequests = []
  session.on('Runtime.exceptionThrown', event => errors.push(event.exceptionDetails.text))
  session.on('Log.entryAdded', ({ entry }) => { if (entry.level === 'error') errors.push(entry.text) })
  session.on('Network.requestWillBeSent', ({ request }) => {
    if (/^https?:/.test(request.url) && new URL(request.url).hostname !== '127.0.0.1') externalRequests.push(request.url)
  })
  await session.send('Emulation.setTimezoneOverride', { timezoneId: 'Asia/Shanghai' })
  await session.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'light' }, { name: 'prefers-reduced-motion', value: 'reduce' }] })
  await session.send('Page.addScriptToEvaluateOnNewDocument', { source: `
    const RealDate = Date;
    globalThis.Date = class extends RealDate {
      constructor(...args) { super(...(args.length ? args : [RealDate.parse('2026-10-23T12:00:00+08:00')])); }
      static now() { return RealDate.parse('2026-10-23T12:00:00+08:00'); }
    };
  ` })
  async function viewport(width, height) {
    await session.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 2, mobile: false })
  }
  async function click(selector) {
    await session.evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`)
    await session.evaluate('new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))')
  }
  async function screenshot(name, fullPage = false) {
    await session.evaluate('document.fonts.ready')
    const overflow = await session.evaluate('document.documentElement.scrollWidth > innerWidth')
    assert.equal(overflow, false, `${name}: 页面横向溢出`)
    assert.equal(await session.evaluate(`Array.from(document.querySelectorAll('.lunar-label')).every(el => el.clientHeight >= parseFloat(getComputedStyle(el).lineHeight) - 1)`), true, `${name}: 农历文字被裁切`)
    const { cssContentSize } = await session.send('Page.getLayoutMetrics')
    if (!fullPage) assert.ok(cssContentSize.height <= plugin.pluginSetting.height, `${name}: 默认内容超出插件窗口`)
    const result = await session.send('Page.captureScreenshot', {
      format: 'png', captureBeyondViewport: fullPage,
      ...(fullPage ? { clip: { x: 0, y: 0, width: cssContentSize.width, height: cssContentSize.height, scale: 1 } } : {}),
    })
    fs.writeFileSync(path.join(out, `${name}.png`), Buffer.from(result.data, 'base64'))
    console.log(`${name}.png (${cssContentSize.width} × ${cssContentSize.height})`)
  }
  await viewport(800, plugin.pluginSetting.height)
  await browser.navigate()
  await session.waitForExpression('document.querySelectorAll(".day-cell").length === 42')
  await screenshot('home')
  await click('.view-switch button:last-child')
  await click('.activity-picker button:nth-child(2)')
  assert.equal(await session.evaluate('document.querySelector(".day-cell.selected").classList.contains("suitable")'), true)
  await screenshot('auspicious')
  await click('.theme-button')
  await click('.theme-button')
  assert.equal(await session.evaluate('document.documentElement.dataset.theme'), 'dark')
  await click('.view-switch button:first-child')
  await screenshot('dark')
  await click('.theme-button')
  await viewport(375, 812)
  await screenshot('mobile', true)
  await viewport(812, 375)
  assert.equal(await session.evaluate('document.documentElement.scrollWidth > innerWidth'), false, '横屏布局溢出')
  await viewport(800, plugin.pluginSetting.height)
  await click('[aria-label="下个月"]')
  assert.equal(await session.evaluate('document.querySelector("[aria-label=月份]").value'), '11')
  await click('.today-button')
  assert.equal(await session.evaluate('document.querySelector(".day-cell.selected").getAttribute("aria-current")'), 'date')
  assert.deepEqual(errors, [], '浏览器错误')
  assert.deepEqual(externalRequests, [], '离线插件不应请求外部资源')
  console.log('浏览器检查通过：日期导航、择吉、主题、响应式、无外部请求。')
} finally {
  await browser?.close()
  await new Promise(resolve => server.httpServer.close(resolve))
}
