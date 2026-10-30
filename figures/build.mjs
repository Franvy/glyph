// Draws the project figures (isometric machines, kit/iso-kit.mjs from the anatomy skill) and writes them to
// src/figures: the SVG for each, and the numbers its motion needs. Run with `pnpm figures` after you change one.
import { writeFileSync } from "node:fs";
import { figure as gtab } from "./gtab.mjs";
import { figure as ignite } from "./ignite.mjs";
import { figure as limnsCc } from "./limns-cc.mjs";
import { figure as limnsDev } from "./limns-dev.mjs";

const out = new URL("../src/figures/", import.meta.url);
const params = {};
for (const { name, svg, params: p } of [limnsCc, limnsDev, gtab, ignite]) {
  writeFileSync(new URL(`${name}.svg`, out), svg);
  params[name] = p;
  console.log(`wrote src/figures/${name}.svg (${Math.round(svg.length / 1024)} KB)`);
}
writeFileSync(new URL("params.json", out), `${JSON.stringify(params, null, 2)}\n`);
console.log("wrote src/figures/params.json");
