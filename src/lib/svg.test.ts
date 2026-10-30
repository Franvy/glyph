import { describe, expect, it } from "vitest";
import { cleanSvg } from "./svg";
import { SKILL_MARKS } from "./skill-marks";

const ok = (input: string) => {
  const r = cleanSvg(input);
  if (!r.ok) throw new Error(r.error);
  return r.svg;
};
const error = (input: string) => {
  const r = cleanSvg(input);
  if (r.ok) throw new Error(`accepted: ${r.svg}`);
  return r.error;
};

describe("cleanSvg", () => {
  it("keeps the shapes, sizes the icon from the viewBox and lets it follow the text colour", () => {
    expect(ok(`<svg viewBox="0 0 24 24"><path d="M0 0h24v24H0z"/></svg>`)).toBe(
      `<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true" focusable="false"><path d="M0 0h24v24H0z"/></svg>`,
    );
  });

  it("drops what a design tool adds: the prolog, comments, titles, xmlns, sizes and editor data", () => {
    const pasted = `<?xml version="1.0" encoding="UTF-8"?>
<!-- Generator: Figma -->
<svg xmlns="http://www.w3.org/2000/svg" xmlns:inkscape="x" width="48" height="48" viewBox="0 0 48 48" class="logo" data-name="Layer 1">
  <title>Rust</title>
  <metadata><rdf:RDF/></metadata>
  <sodipodi:namedview id="n"/>
  <path inkscape:label="a" fill="#000" d="M1 1h2"/>
</svg>`;
    expect(ok(pasted)).toBe(
      `<svg viewBox="1 0 2 2" width="14" height="14" fill="currentColor" aria-hidden="true" focusable="false"><path fill="currentColor" d="M1 1h2"/></svg>`,
    );
  });

  it("needs no viewBox when the SVG has a width and a height", () => {
    expect(ok(`<svg width="20" height="10"><rect width="20" height="10"/></svg>`)).toContain(`viewBox="0 -5 20 20" width="14" height="14"`);
  });

  it("keeps clip paths and internal references", () => {
    const svg = ok(
      `<svg viewBox="0 0 10 10" fill="none"><defs><clipPath id="c"><rect width="5" height="5"/></clipPath></defs><g clip-path="url(#c)"><circle cx="5" cy="5" r="5" fill="#000"/></g><use href="#c"/></svg>`,
    );
    expect(svg).toContain(`fill="none" aria-hidden`);
    expect(svg).toContain(`<g clip-path="url(#c)">`);
    expect(svg).toContain(`<use href="#c"/>`);
  });

  describe("one colour for every icon", () => {
    const paints = (svg: string) => [...svg.matchAll(/ (?:fill|stroke)="([^"]*)"/g)].map((m) => m[1]);

    it("paints a one-colour icon in the text colour, whatever colour it had", () => {
      for (const colour of ["#0091FF", "#FFFFFF", "#fff", "white", "rgb(217, 119, 87)", "red", "#2CB300cc"]) {
        const svg = ok(`<svg viewBox="0 0 24 24"><path fill="${colour}" stroke="${colour}" d="M0 0h24v24H0z"/></svg>`);
        expect(paints(svg), colour).toEqual(["currentColor", "currentColor", "currentColor"]);
      }
    });

    it("keeps none, and the colours the built-in marks use on purpose", () => {
      const svg = ok(
        `<svg viewBox="0 0 24 24" fill="none"><path stroke="#000" d="M0 0h24v24H0z"/><path fill="var(--bg)" d="M1 1h2v2z"/><path fill="color-mix(in srgb, currentColor 65%, var(--ink))" d="M3 3h2v2z"/></svg>`,
      );
      expect(paints(svg)).toEqual(["none", "currentColor", "var(--bg)", "color-mix(in srgb, currentColor 65%, var(--ink))"]);
    });

    it("cuts the light parts out of an icon that also has dark parts, so a two-tone icon keeps its detail", () => {
      const svg = ok(
        `<svg viewBox="0 0 24 24"><defs><linearGradient id="blue"><stop stop-color="#1A65FD"/><stop offset="1" stop-color="#2A78FF"/></linearGradient><linearGradient id="pale"><stop stop-color="#D5E2F9"/><stop offset="1" stop-color="#FFFFFF"/></linearGradient></defs><path fill="url(#blue)" d="M0 0h24v24H0z"/><path fill="#D4E3FC" d="M2 2h8v8H2z"/><path fill="url(#pale)" d="M12 12h8v8h-8z"/><path stroke="#1450C4" d="M4 4h4"/></svg>`,
      );
      // The root, the blue base, the two pale tiles, the dark stroke.
      expect(paints(svg)).toEqual(["currentColor", "currentColor", "var(--bg)", "var(--bg)", "currentColor"]);
    });
  });

  describe("one size for every icon", () => {
    const box = (svg: string) => svg.match(/viewBox="([^"]*)"/)![1].split(" ").map(Number);

    it("fits the viewBox to the drawing, as a square with the drawing in the middle", () => {
      // A small drawing in a big canvas fills the icon.
      expect(box(ok(`<svg viewBox="0 0 1024 1024"><path d="M100 200h400v200H100z"/></svg>`))).toEqual([100, 100, 400, 400]);
      // Every icon is 14 by 14, so wide and tall marks get the same room.
      expect(ok(`<svg viewBox="0 0 1024 1024"><path d="M100 200h400v200H100z"/></svg>`)).toContain(`width="14" height="14"`);
    });

    it("ignores what is not drawn: invisible boxes, defs and clip paths", () => {
      expect(
        box(ok(`<svg viewBox="0 0 24 24"><path d="M0 0h24v24H0z" fill="none"/><rect width="24" height="24" opacity="0"/><defs><rect x="-50" width="100" height="100"/></defs><circle cx="12" cy="12" r="6"/></svg>`)),
      ).toEqual([6, 6, 12, 12]);
    });

    it("counts half the stroke width around a stroked line", () => {
      expect(box(ok(`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 12h16"/></svg>`))).toEqual([3, 3, 18, 18]);
    });

    it("follows transforms, relative commands, smooth curves and arcs", () => {
      expect(box(ok(`<svg viewBox="0 0 100 100"><g transform="translate(10 0) scale(2)"><rect width="5" height="5"/></g></svg>`))).toEqual([10, 0, 10, 10]);
      expect(box(ok(`<svg viewBox="0 0 100 100"><path d="M0 0 Q 5 10 10 0 T 20 0"/></svg>`))).toEqual([0, -10, 20, 20]);
      expect(box(ok(`<svg viewBox="0 0 100 100"><path d="m2 12a10 10 0 1 0 20 0a10 10 0 1 0 -20 0z"/></svg>`))).toEqual([2, 2, 20, 20]);
      expect(box(ok(`<svg viewBox="0 0 100 100"><polygon points="0,0 8,0 4,4"/><line x1="0" y1="0" x2="0" y2="8" stroke="#000" stroke-width="0"/></svg>`))).toEqual([0, -2, 8, 8]);
    });

    it("keeps the viewBox when it cannot find a drawing", () => {
      expect(box(ok(`<svg viewBox="0 0 24 24"><use href="#x"/></svg>`))).toEqual([0, 0, 24, 24]);
    });

    it("drops a style that would give the icon another size", () => {
      const svg = ok(`<svg viewBox="0 0 24 24" style="height: 33px; width: 33px"><path style="fill: red" d="M0 0h24v24H0z"/></svg>`);
      expect(svg).not.toContain("style");
      expect(svg).toContain(`width="14" height="14"`);
    });
  });

  it("keeps filters such as a drop shadow from Figma", () => {
    const svg = ok(
      `<svg viewBox="0 0 24 24"><g filter="url(#s)"><path d="M0 0h24v24H0z"/></g><defs><filter id="s" x="-4" y="0" width="32" height="32" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB"><feFlood flood-opacity="0" result="BackgroundImageFix"/><feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha"/><feOffset dy="4"/><feGaussianBlur stdDeviation="2"/><feComposite in2="hardAlpha" operator="out"/><feBlend mode="normal" in2="BackgroundImageFix" result="effect1"/><feMerge><feMergeNode in="effect1"/><feMergeNode in="SourceGraphic"/></feMerge><feDropShadow dx="1" dy="1" stdDeviation="1" flood-color="#000"/></filter></defs></svg>`,
    );
    expect(svg).toContain(`<g filter="url(#s)">`);
    expect(svg).toContain(`<filter id="s" x="-4" y="0" width="32" height="32" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB">`);
    expect(svg).toContain(`<feGaussianBlur stdDeviation="2"/>`);
    expect(svg).toContain(`<feComposite in2="hardAlpha" operator="out"/>`);
    expect(svg).toContain(`<feMergeNode in="SourceGraphic"/>`);
    expect(svg).toContain(`<feDropShadow dx="1" dy="1" stdDeviation="1" flood-color="#000"/>`);
  });

  it("gives the same result when it cleans its own output", () => {
    for (const mark of Object.values(SKILL_MARKS)) expect(ok(ok(mark))).toBe(ok(mark));
  });

  it("accepts every built-in mark", () => {
    for (const [name, mark] of Object.entries(SKILL_MARKS)) expect(cleanSvg(mark).ok, name).toBe(true);
  });

  it("refuses anything that could run code or load another file", () => {
    expect(error(`<svg viewBox="0 0 1 1"><script>alert(1)</script></svg>`)).toMatch(/<script>/);
    expect(error(`<svg viewBox="0 0 1 1"><foreignObject><div/></foreignObject></svg>`)).toMatch(/<foreignObject>/);
    expect(error(`<svg viewBox="0 0 1 1"><image href="https://x.test/a.png"/></svg>`)).toMatch(/<image>/);
    expect(error(`<svg viewBox="0 0 1 1"><a href="javascript:alert(1)"><path d="M0 0"/></a></svg>`)).toMatch(/<a>/);
    expect(error(`<svg viewBox="0 0 1 1"><style>body{display:none}</style></svg>`)).toMatch(/<style>/);
    expect(error(`<svg viewBox="0 0 1 1"><filter id="f"><feImage href="https://x.test/a.png"/></filter></svg>`)).toMatch(/<feImage>/);
    expect(error(`<svg viewBox="0 0 1 1"><path filter="url(https://x.test/f.svg#f)" d="M0 0"/></svg>`)).toMatch(/url/);
    expect(error(`<svg viewBox="0 0 1 1" onload="alert(1)"><path d="M0 0"/></svg>`)).toMatch(/onload/);
    expect(error(`<svg viewBox="0 0 1 1"><path ONCLICK="x" d="M0 0"/></svg>`)).toMatch(/onclick/i);
    expect(error(`<svg viewBox="0 0 1 1"><use href="https://x.test/s.svg#a"/></svg>`)).toMatch(/href/);
    expect(error(`<svg viewBox="0 0 1 1"><use xlink:href="data:image/svg+xml,x"/></svg>`)).toMatch(/href/);
    expect(error(`<svg viewBox="0 0 1 1"><path fill="url(https://x.test/a)" d="M0 0"/></svg>`)).toMatch(/url/);
    // A style is dropped, so a url() in it never reaches the page.
    expect(ok(`<svg viewBox="0 0 1 1"><path style="background:url(//x.test/a)" d="M0 0"/></svg>`)).not.toContain("url");
    expect(error(`<svg viewBox="0 0 1 1"><![CDATA[x]]></svg>`)).toMatch(/CDATA/);
  });

  it("never lets a value break out of its attribute", () => {
    const svg = ok(`<svg viewBox="0 0 1 1"><path d='M0 0"><img src=x onerror=alert(1)>'/></svg>`);
    expect(svg).toContain(`d="M0 0&quot;&gt;&lt;img src=x onerror=alert(1)&gt;"`);
    expect(svg).not.toContain("<img");
  });

  it("says what is wrong with SVG code that is not valid", () => {
    expect(error("")).toMatch(/Paste/);
    expect(error(`<div></div>`)).toMatch(/<svg>/);
    expect(error(`<svg viewBox="0 0 1 1"><path d="M0 0"></svg>`)).toMatch(/not closed|does not match/);
    expect(error(`<svg viewBox="0 0 1 1"></svg><svg viewBox="0 0 1 1"></svg>`)).toMatch(/one <svg>/);
    expect(error(`<svg viewBox="0 0 1 1">hello</svg>`)).toMatch(/text/);
    expect(error(`<svg><path d="M0 0"/></svg>`)).toMatch(/viewBox/);
    expect(error(`<svg viewBox="0 0 0 0"><path d="M0 0"/></svg>`)).toMatch(/viewBox/);
  });
});
