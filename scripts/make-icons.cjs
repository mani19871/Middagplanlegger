// Lager PWA-ikoner (PNG) fra public/icons/icon.svg med Playwright/Chromium.
// Bruk: node scripts/make-icons.cjs   (playwright finnes globalt i miljøet; ellers: npm i -D playwright)
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const dir = path.join(__dirname, '..', 'public', 'icons');
const svg = fs.readFileSync(path.join(dir, 'icon.svg'), 'utf8');
// «maskable»: hele flaten fylt og logoen innenfor sikker sone (70 %).
const maskable = svg.replace(/<rect[^>]*\/>/, '<rect width="512" height="512" fill="#17503b"/>').replace('<g id="leaf">', '<g transform="translate(76.8 76.8) scale(.7)">');
(async () => {
  const b = await chromium.launch();
  const render = async (markup, size, file) => {
    const p = await b.newPage({ viewport: { width: size, height: size }, deviceScaleFactor: 1 });
    await p.setContent(`<style>html,body{margin:0;background:transparent}svg{display:block;width:${size}px;height:${size}px}</style>${markup}`);
    await p.screenshot({ path: path.join(dir, file), omitBackground: true, clip: { x: 0, y: 0, width: size, height: size } });
    await p.close();
  };
  await render(svg, 192, 'icon-192.png'); await render(svg, 512, 'icon-512.png');
  await render(maskable, 192, 'maskable-192.png'); await render(maskable, 512, 'maskable-512.png');
  await render(svg, 180, 'apple-touch-icon.png');
  await b.close(); console.log('Ikoner skrevet til', dir);
})();
