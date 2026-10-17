const fs = require('node:fs')
const path = require('node:path')
const assert = require('node:assert/strict')
const crypto = require('node:crypto')
const { chromium, openComic, root } = require('../tests/helpers/browser.cjs')

async function main() {
  const directory = path.join(root, 'dist/verification')
  const frames = path.join(directory, 'launcher-frames')
  fs.mkdirSync(frames, { recursive: true })
  const browser = await chromium.launch({ headless: true })
  try {
    const { page, context } = await openComic(browser, { count: 1, settings: { themePreset: 'aurora', effectLevel: 2 } })
    await page.locator('#ten-close').click()
    await page.evaluate(() => window.__menus.find(menu => menu.label.includes('显示/隐藏')).action())
    const css = await page.locator('#ten-comic-style').textContent()
    const launcher = await page.locator('#ten-comic-launcher').evaluate(element => element.outerHTML)
    await context.close()
    const themes = [
      ['aurora', '极光流银', '银蓝流光环'], ['cloud', '云白浮雕', '柔和呼吸光'], ['obsidian', '黑曜鎏金', '金色彗光'],
      ['carbon', '霓虹炭黑', '蓝粉双弧'], ['titanium', '深空钛蓝', '冷蓝扫描光'], ['mist', '晨雾晶璃', '原有效果 · 保持不变']
    ]
    const cells = themes.map(([theme, name, effect]) => `<section><h2>${name}</h2><p>${effect}</p><div class="demo" data-theme="${theme}"></div></section>`).join('')
    const script = `const template=document.getElementById('theme-styles');const hosts=[...document.querySelectorAll('.demo')];for(const host of hosts){const shadow=host.attachShadow({mode:'open'});shadow.append(template.content.cloneNode(true));const root=document.createElement('div');root.id='ten-comic-root';Object.assign(root.dataset,{theme:host.dataset.theme,effects:'2',motion:'standard',shape:'standard'});root.innerHTML=${JSON.stringify(launcher)};shadow.append(root)}document.getElementById('strength').addEventListener('change',e=>hosts.forEach(host=>host.shadowRoot.getElementById('ten-comic-root').dataset.effects=e.target.value));document.getElementById('pause').addEventListener('click',e=>{const paused=e.currentTarget.textContent==='暂停';hosts.forEach(host=>host.shadowRoot.getElementById('ten-comic-root').classList.toggle('is-page-hidden',paused));e.currentTarget.textContent=paused?'播放':'暂停'});`
    const html = `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>最小化按钮动效预览</title><style>body{margin:0;padding:24px;box-sizing:border-box;background:#edf2f7;color:#263d53;font:13px/1.5 'Microsoft YaHei',sans-serif}header{display:flex;align-items:center;justify-content:space-between;gap:18px;margin-bottom:18px}h1{font-size:21px;margin:0}header p{font-size:12px;margin:4px 0 0;color:#536a80}.controls{display:flex;align-items:center;gap:8px}select,button{font:inherit;border:1px solid #b9c9da;background:white;color:#263d53;border-radius:8px;padding:6px 10px}.grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px}section{background:#f9fbfe;border:1px solid #d6e0eb;border-radius:16px;overflow:hidden}h2{font-size:15px;margin:12px 14px 0}section p{font-size:11px;margin:3px 14px 0;color:#536a80}.demo{position:relative;transform:translateZ(0);isolation:isolate;height:137px}.demo[data-theme=obsidian]{background:radial-gradient(ellipse,#ede5d5,transparent 66%)}.demo[data-theme=carbon],.demo[data-theme=titanium]{background:radial-gradient(ellipse,#d9e5f2,transparent 66%)}@media(max-width:600px){.grid{grid-template-columns:repeat(2,minmax(0,1fr))}header{flex-wrap:wrap}}</style><header><div><h1>最小化按钮动效</h1><p>实际组件放大展示 · 悬停可查看反馈</p></div><div class="controls"><label for="strength">特效</label><select id="strength"><option value="0">关闭</option><option value="1">轻量</option><option value="2" selected>标准</option></select><button id="pause">暂停</button></div></header><div class="grid">${cells}</div><template id="theme-styles"><style>${css}\n#ten-comic-root #ten-comic-launcher{zoom:1.6;right:calc(50% - 26px)}</style></template><script>${script.replaceAll('<', '\\u003c')}</script></html>`
    const output = path.join(directory, 'launcher-effects-preview.html')
    fs.writeFileSync(output, html)
    const preview = await browser.newPage({ viewport: { width: 900, height: 540 } })
    const errors = []
    preview.on('pageerror', error => errors.push(error.message))
    await preview.setContent(html)
    assert.equal(await preview.locator('.demo').count(), 6)
    await preview.locator('#strength').selectOption('0')
    const disabled = await preview.evaluate(() => [...document.querySelectorAll('.demo')].filter(host => host.dataset.theme !== 'mist').every(host => getComputedStyle(host.shadowRoot.getElementById('ten-comic-launcher'), '::before').animationName === 'none'))
    assert.equal(disabled, true)
    await preview.locator('#strength').selectOption('2')
    await preview.locator('#pause').click()
    const paused = await preview.evaluate(() => [...document.querySelectorAll('.demo')].every(host => getComputedStyle(host.shadowRoot.getElementById('ten-comic-launcher'), '::before').animationPlayState === 'paused'))
    assert.equal(paused, true)
    await preview.locator('#pause').click()
    await preview.mouse.move(0, 0)
    await preview.evaluate(() => {
      for (const host of document.querySelectorAll('.demo')) for (const animation of host.shadowRoot.getElementById('ten-comic-launcher').getAnimations({ subtree: true })) animation.pause()
    })
    for (let frame = 0; frame < 80; frame++) {
      await preview.evaluate(time => {
        for (const host of document.querySelectorAll('.demo')) for (const animation of host.shadowRoot.getElementById('ten-comic-launcher').getAnimations({ subtree: true })) animation.currentTime = time
      }, frame * 100)
      await preview.screenshot({ path: path.join(frames, `${String(frame).padStart(3, '0')}.png`) })
    }
    await preview.evaluate(() => {
      for (const host of document.querySelectorAll('.demo')) for (const animation of host.shadowRoot.getElementById('ten-comic-launcher').getAnimations({ subtree: true })) animation.currentTime = 2200
    })
    await preview.screenshot({ path: path.join(directory, 'launcher-effects-preview.png') })
    assert.deepEqual(errors, [])
    const sha256 = crypto.createHash('sha256').update(fs.readFileSync(path.join(root, '10漫画—重制版.user.js'))).digest('hex')
    fs.writeFileSync(path.join(directory, 'launcher-effects-report.json'), JSON.stringify({ sha256, themes: themes.map(([theme]) => theme), frames: 80, frameDurationMs: 100, controls: 'effect strength and pause verified' }, null, 2))
    console.log('PASS six actual launcher previews, effect controls, and 80 animation frames')
  } finally { await browser.close() }
}
main().catch(error => { console.error(error); process.exitCode = 1 })
