// Build A4 covers from the same pixel functions as the live garden. No new runtime dependency.
import { mkdtemp, readFile, writeFile, rm, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";
import { chromium } from "@playwright/test";

const out = new URL("../design/garden-covers/", import.meta.url);
const temp = await mkdtemp(join(tmpdir(), "glyph-covers-"));
await mkdir(out, { recursive: true });
try {
  // Compile only the pure garden modules. They do not depend on Astro, React or Workers.
  await writeFile(join(temp, "package.json"), '{"type":"module"}');
  for (const name of ["scene", "moon", "palette", "themes", "sprites", "halloween", "meiqiu"]) {
    const source = await readFile(new URL(`../src/lib/garden/${name}.ts`, import.meta.url), "utf8");
    const { outputText } = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } });
    await writeFile(join(temp, `${name}.js`), outputText.replace(/from "(\.\/[^".]+)"/g, 'from "$1.js"'));
  }
  const load = (name) => import(pathToFileURL(join(temp, `${name}.js`)).href);
  const { layout, paintStatic, windows } = await load("scene");
  const { PALETTES } = await load("palette");
  const { SCENES, weather, crackers, burst, SCARF_ROW } = await load("themes");
  const { POSES, FEET, BUTTERFLY } = await load("sprites");
  const { decorations, WITCH_HAT, HAT_TOP, ghostFrame } = await load("halloween");
  const font = (await readFile(new URL("../src/assets/fonts/PaperMono-Variable.woff2", import.meta.url))).toString("base64");
  const themes = {
    clear: { title: ["Clear", "sky."], caption: "A small garden. A whole day ahead.", theme: "light", accent: "#1f6fe0", label: "Clear" },
    cloudy: { title: ["Cloud", "watching."], caption: "Nothing urgent. Just passing clouds.", theme: "light", accent: "#6a9ee9", label: "Cloudy" },
    rain: { title: ["Stay", "a little."], caption: "Rain outside. A dry spot under the tree.", theme: "dark", accent: "#4a8fef", label: "Rain" },
    storm: { title: ["Thunder", "rolls."], caption: "Two small eyes. Safely indoors.", theme: "dark", accent: "#8db4f0", label: "Storm" },
    snow: { title: ["First", "snow."], caption: "New snow. The same little paw prints.", theme: "light", accent: "#1f6fe0", label: "Snow" },
    fog: { title: ["Slow", "morning."], caption: "The garden takes its time to appear.", theme: "light", accent: "#8f8b83", label: "Fog" },
    spring: { title: ["One more", "firework."], caption: "No moon tonight. Meiqiu has fireworks.", theme: "dark", accent: "#f0603f", label: "Lunar New Year" },
    halloween: { title: ["A little", "spooky."], caption: "A borrowed hat. One shy visitor.", theme: "dark", accent: "#e99a45", label: "Halloween" },
  };
  const manifest = [];
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 840, height: 1188 }, deviceScaleFactor: 2 });
    for (const [index, scene] of SCENES.entries()) {
      const meta = themes[scene];
      const night = meta.theme === "dark";
      const palette = PALETTES[meta.theme];
      const l = layout(222, 172);
      const keys = paintStatic(l, night, scene, "waxingCrescent").keys;
      const put = (dots, ox = 0, oy = 0) => {
        for (const [dx, dy, key] of dots) {
          const x = Math.round(dx + ox), y = Math.round(dy + oy);
          if (x >= 0 && x < l.w && y >= 0 && y < l.h) keys[y * l.w + x] = key;
        }
      };
      const time = scene === "storm" ? 3.12 : 9.6;
      const sky = weather(l, scene, night, time);
      put(windows(l, night || scene === "rain" || scene === "storm"));
      put(sky.back);
      if (scene === "spring") {
        put(crackers(l, 0));
        put(burst({ x: 76, y: 51, born: 0, color: "red" }, 0.55));
        put(burst({ x: 136, y: 85, born: 0, color: "gold" }, 0.8));
      }
      if (scene === "halloween") {
        put(decorations(l, true, 9.6, true));
        put(ghostFrame({ x: 129, y: 92, born: 0 }, 0.6).dots);
      }
      const cx = scene === "rain" ? l.tree.x + 26 : 99;
      const pose = scene === "snow" ? "happy" : "idle";
      if (scene !== "storm") {
        put(POSES[pose], cx, l.ground - FEET[pose]);
        if (scene === "halloween") put(WITCH_HAT, cx + 2, l.ground - FEET[pose] + HAT_TOP[pose]);
        if (scene === "spring") {
          put(Array.from({ length: 12 }, (_, x) => [x + 1, SCARF_ROW[pose], "red"]), cx, l.ground - FEET[pose]);
          put([[6, SCARF_ROW[pose] + 1, "gold"]], cx, l.ground - FEET[pose]);
        }
      }
      if (["clear", "cloudy", "spring"].includes(scene)) put(BUTTERFLY[0], 110, l.ground - 30);
      put(sky.front);
      if (scene === "storm") put([[l.house.x + 7, l.ground - 11, "eye"], [l.house.x + 9, l.ground - 11, "eye"]]);
      if (scene === "snow") for (const x of [76, 81, 86, 91]) put([[x, l.ground, "snowShade"], [x + 2, l.ground, "snowShade"]]);

      // Merge horizontal runs into one path per colour to keep the SVG compact and editable.
      const paths = new Map();
      for (let y = 0; y < l.h; y++) for (let x = 0; x < l.w;) {
        const key = keys[y * l.w + x];
        const start = x++;
        while (x < l.w && keys[y * l.w + x] === key) x++;
        if (key) paths.set(key, (paths.get(key) ?? "") + `M${start} ${y}h${x - start}v1h-${x - start}z`);
      }
      const art = `<rect width="222" height="172" fill="${palette.bg}"/>` + [...paths].map(([key, d]) => `<path fill="${palette[key]}" d="${d}"/>`).join("");
      const sceneSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="840" height="650" viewBox="0 0 222 172" preserveAspectRatio="none" shape-rendering="crispEdges">${art}</svg>`;
      await writeFile(new URL(`${scene}-scene.svg`, out), sceneSvg);
      const ink = night ? "#edeae3" : "#1a1a19";
      const dim = night ? "#a7a39c" : "#6e6b65";
      const line = night ? "#3a3936" : "#d4d1ca";
      const number = String(index + 1).padStart(2, "0");
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="210mm" height="297mm" viewBox="0 0 840 1188">
<title>Meiqiu's Garden — ${meta.label}</title>
<defs><style>@font-face{font-family:Paper Mono;src:url(data:font/woff2;base64,${font}) format('woff2');font-weight:100 800}text{font-family:Paper Mono,monospace;font-weight:400}</style></defs>
<rect width="840" height="1188" fill="${palette.bg}"/>
<text x="48" y="58" fill="${dim}" font-size="12" letter-spacing="1.2">FRANVY / MEIQIU’S GARDEN</text>
<text x="792" y="58" text-anchor="end" fill="${meta.accent}" font-size="12">${number} / 08</text>
<path d="M48 86H792" stroke="${line}" stroke-dasharray="3 5"/>
<text x="44" y="180" fill="${ink}" font-size="84" letter-spacing="-2">${meta.title[0]}</text>
<text x="44" y="270" fill="${ink}" font-size="84" letter-spacing="-2">${meta.title[1]}</text>
<text x="48" y="320" fill="${dim}" font-size="15">${meta.caption}</text>
<svg y="382" width="840" height="650" viewBox="0 0 222 172" preserveAspectRatio="none" shape-rendering="crispEdges">${art}</svg>
<path d="M48 1094H792" stroke="${line}" stroke-dasharray="3 5"/>
<text x="48" y="1130" fill="${meta.accent}" font-size="14">${meta.label.toUpperCase()}</text>
<text x="792" y="1130" text-anchor="end" fill="${dim}" font-size="12">THE GARDEN SERIES / ${number}</text>
<text x="48" y="1154" fill="${dim}" font-size="11">A SMALL GARDEN. MEIQIU LIVES HERE.</text>
</svg>`;
      await writeFile(new URL(`${scene}.svg`, out), svg);
      await page.setContent(`<style>html,body{margin:0;width:840px;height:1188px}svg{display:block;width:840px;height:1188px}</style>${svg}`);
      await page.evaluate(() => document.fonts.ready);
      await page.screenshot({ path: new URL(`${scene}.png`, out).pathname });
      manifest.push({ scene, number, ...meta, bg: palette.bg, ink, dim, line });
      console.log(`wrote ${scene}.svg + ${scene}.png (A4, 210:297)`);
    }
    await writeFile(new URL("manifest.json", out), JSON.stringify(manifest, null, 2) + "\n");
    const gallery = `<style>html,body{margin:0;background:#353535}.covers{display:grid;grid-template-columns:repeat(4,420px)}img{display:block;width:420px;height:594px}</style><div class="covers">${manifest.map((c) => `<img src="${c.scene}.png" alt="${c.label} cover">`).join("")}</div>`;
    await writeFile(new URL("index.html", out), `<!doctype html><html lang="en"><meta charset="utf-8"><title>Meiqiu's Garden — A4 covers</title>${gallery}</html>`);
    const sheet = await browser.newPage({ viewport: { width: 1680, height: 1188 }, deviceScaleFactor: 1 });
    const images = await Promise.all(manifest.map(async (c) => `<img src="data:image/png;base64,${(await readFile(new URL(`${c.scene}.png`, out))).toString("base64")}" alt="${c.label}">`));
    await sheet.setContent(gallery.replace(/<div class="covers">[\s\S]*<\/div>/, `<div class="covers">${images.join("")}</div>`));
    await sheet.evaluate(() => Promise.all([...document.images].map((img) => img.decode())));
    await sheet.screenshot({ path: new URL("overview.png", out).pathname });
  } finally { await browser.close(); }
} finally { await rm(temp, { recursive: true, force: true }); }
