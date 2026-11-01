// Chinese A4 editions. Reuse the scene art from `pnpm garden:covers`.
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { chromium } from "@playwright/test";

const source = new URL("../design/garden-covers/", import.meta.url);
const out = new URL("zh-CN/", source);
await mkdir(out, { recursive: true });
const chinese = {
  clear: { title: ["晴天，", "慢慢逛。"], caption: "小小的花园，一整天的好时光。", label: "晴天" },
  cloudy: { title: ["看云", "慢慢走。"], caption: "今天不着急，看云从头顶经过。", label: "多云" },
  rain: { title: ["雨天，", "多坐一会儿。"], caption: "雨落在外面，树下还有一个干爽的位置。", label: "雨天" },
  storm: { title: ["外面打雷，", "屋里有猫。"], caption: "两只小眼睛，安心躲在屋里。", label: "雷雨" },
  snow: { title: ["初雪来了，", "脚印也来了。"], caption: "新落的雪，熟悉的小小猫爪印。", label: "下雪" },
  fog: { title: ["雾里，", "慢一点。"], caption: "花园不着急，慢慢从雾里出现。", label: "雾天" },
  spring: { title: ["再放一朵", "小烟花。"], caption: "今晚没有月亮，煤球还有烟花。", label: "春节" },
  halloween: { title: ["今晚有点", "小神秘。"], caption: "借来一顶帽子，等一位害羞的小客人。", label: "万圣节" },
};
const mono = (await readFile(new URL("../src/assets/fonts/PaperMono-Variable.woff2", import.meta.url))).toString("base64");
const regular = (await readFile(new URL("fonts/NotoSansSC-Regular-subset.woff2", out))).toString("base64");
const medium = (await readFile(new URL("fonts/NotoSansSC-Medium-subset.woff2", out))).toString("base64");
const items = JSON.parse(await readFile(new URL("manifest.json", source), "utf8")).map((c) => ({ ...c, ...chinese[c.scene] }));
const fontCss = `@font-face{font-family:Paper Mono;src:url(data:font/woff2;base64,${mono}) format('woff2');font-weight:100 800}@font-face{font-family:Noto Sans SC;src:url(data:font/woff2;base64,${regular}) format('woff2');font-weight:400}@font-face{font-family:Noto Sans SC;src:url(data:font/woff2;base64,${medium}) format('woff2');font-weight:500}text{font-family:Noto Sans SC,sans-serif;font-weight:400}.number{font-family:Paper Mono,monospace}.title{font-weight:500}`;
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 840, height: 1188 }, deviceScaleFactor: 2 });
  for (const c of items) {
    const art = await readFile(new URL(`${c.scene}-scene.svg`, source), "utf8");
    const scene = art.replace('<svg ', '<svg y="382" ');
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="210mm" height="297mm" viewBox="0 0 840 1188" lang="zh-CN">
<title>煤球的花园 · ${c.label}</title><defs><style>${fontCss}</style></defs>
<rect width="840" height="1188" fill="${c.bg}"/>
<text x="48" y="59" fill="${c.dim}" font-size="14" letter-spacing="1">FRANVY / 煤球的花园</text>
<text class="number" x="792" y="58" text-anchor="end" fill="${c.accent}" font-size="12">${c.number} / 08</text>
<path d="M48 86H792" stroke="${c.line}" stroke-dasharray="3 5"/>
<text class="title" x="44" y="189" fill="${c.ink}" font-size="84" letter-spacing="-1.7">${c.title[0]}</text>
<text class="title" x="44" y="289" fill="${c.ink}" font-size="84" letter-spacing="-1.7">${c.title[1]}</text>
<text x="48" y="343" fill="${c.dim}" font-size="17">${c.caption}</text>
${scene}
<path d="M48 1094H792" stroke="${c.line}" stroke-dasharray="3 5"/>
<text x="48" y="1131" fill="${c.accent}" font-size="16">${c.label}</text>
<text x="792" y="1131" text-anchor="end" fill="${c.dim}" font-size="13">花园系列 / ${c.number}</text>
<text x="48" y="1158" fill="${c.dim}" font-size="13">小小的花园，住着一只煤球。</text>
</svg>`;
    await writeFile(new URL(`${c.scene}.svg`, out), svg);
    await page.setContent(`<style>html,body{margin:0;width:840px;height:1188px}body>svg{display:block;width:840px;height:1188px}</style>${svg}`);
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: new URL(`${c.scene}.png`, out).pathname });
    console.log(`wrote zh-CN/${c.scene}.svg + .png`);
  }
  await writeFile(new URL("manifest.json", out), JSON.stringify(items, null, 2) + "\n");
  const gallery = `<style>html,body{margin:0;background:#353535}.covers{display:grid;grid-template-columns:repeat(4,420px)}img{display:block;width:420px;height:594px}</style><div class="covers">${items.map((c) => `<img src="${c.scene}.png" alt="${c.label}封面">`).join("")}</div>`;
  await writeFile(new URL("index.html", out), `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>煤球的花园 · 中文封面</title>${gallery}</html>`);
  const sheet = await browser.newPage({ viewport: { width: 1680, height: 1188 }, deviceScaleFactor: 1 });
  const images = await Promise.all(items.map(async (c) => `<img src="data:image/png;base64,${(await readFile(new URL(`${c.scene}.png`, out))).toString("base64")}" alt="${c.label}">`));
  await sheet.setContent(gallery.replace(/<div class="covers">[\s\S]*<\/div>/, `<div class="covers">${images.join("")}</div>`));
  await sheet.evaluate(() => Promise.all([...document.images].map((img) => img.decode())));
  await sheet.screenshot({ path: new URL("overview.png", out).pathname });
} finally { await browser.close(); }
