// Everything the home page says lives here. Placeholder entries are marked.

import type { Project, Skill } from "./content";
import type { DuolingoProfile } from "./duolingo";
import type { GitHubProfile } from "./github-profile";
import { buildYear, sampleCounts } from "./contributions";
import { SKILL_MARKS } from "./skill-marks";
import { cleanSvg } from "./svg";

export const site = {
  handle: "franvy",
  domain: "franvy.cc",
  url: "https://franvy.cc",
  name: "Franvy",
  email: "hi@franvy.dev",
  github: "https://github.com/franvy",
  repo: "https://github.com/franvy/glyph", // placeholder: this site's source; confirm once it is pushed
  x: "https://x.com/franvy", // placeholder: confirm the handle
  /** The Duolingo username. Duolingo shows the display name "Franvy Dev". */
  duolingo: "001023.6354OwBA",
  /** "Book an intro call" on the home page. */
  booking: "https://cal.com/franvy",
  city: "Shanghai",
  country: "China",
  timeZone: "Asia/Shanghai",
  /** The line under the name in the Who band. */
  headline: "Full-Stack Developer",
  roles: ["full-stack developer", "open-source tool maker", "product builder"],
};

/** Whose GitHub contribution calendar the home page shows. */
export const githubLogin = "franvy";

// The E2E build shows these fixed sample counts, so no test depends on GitHub or on today's date.
const lastDay = new Date("2026-10-20T00:00:00Z");
export const sampleContributions = buildYear(sampleCounts(985, lastDay), lastDay);

/** The GitHub hover card in the E2E build: fixed numbers, and badges as GitHub draws them. */
export const sampleProfile: GitHubProfile = {
  login: githubLogin,
  name: "Franvy",
  stars: 128,
  followers: 42,
  achievements: [
    { slug: "pull-shark", name: "Pull Shark", icon: "https://github.githubassets.com/assets/pull-shark-silver-0643f87ac9fd.png", tier: 3 },
    { slug: "quickdraw", name: "Quickdraw", icon: "https://github.githubassets.com/assets/quickdraw-default-39c6aec8ff89.png", tier: null },
    { slug: "yolo", name: "YOLO", icon: "https://github.githubassets.com/assets/yolo-default-be0bbff04951.png", tier: null },
  ],
};

/** The Duolingo hover card in the E2E build. */
export const sampleDuolingo: DuolingoProfile = { username: site.duolingo, name: "Franvy Dev", streak: 181, totalXp: 28781, learning: "English" };

// The order on the home page. Each name has a cover in src/data/covers.ts; an image uploaded in /admin replaces it.
// The art shows only when a project has neither.
export const projects: Project[] = [
  {
    name: "limns.cc",
    status: "beta",
    description: "Chat with many AI models and make images.",
    site: "https://limns.cc",
    shot: "Chat",
    art: [
      " [ model: ▾ choose ]",
      "",
      "  > draw a quiet desk at dawn",
      "  .----------------.",
      "  |   _||_   ~ ~   |",
      "  |  [____]  ~~~   |",
      "  '----------------'",
    ].join("\n"),
  },
  {
    name: "limns.dev",
    status: "live",
    description: "A board of design worth saving and sharing.",
    site: "https://limns.dev",
    shot: "Board",
    art: [
      "+--------+--------+--------+",
      "| .----. | ~~~~~~ | /\\  /\\ |",
      "| |    | | ~~~~   |/  \\/  \\|",
      "| '----' | ~~~~~~ |        |",
      "+--------+--------+--------+",
      "|  ♥ 128   ★ 42   ◌ 9      |",
      "+--------------------------+",
    ].join("\n"),
  },
  {
    name: "Gtab",
    status: "live",
    description: "Ghostty workspaces, opened with one key.",
    github: "https://github.com/Franvy/gtab",
    shot: "Workspaces",
    art: [
      " $ gtab",
      " +------------+-------------+",
      " | > blog     | ~/glyph     |",
      " |   api      +-------------+",
      " |   notes    | pnpm dev    |",
      " +------------+-------------+",
      "   ⌘G open   ⏎ launch",
    ].join("\n"),
  },
  {
    name: "Ignite",
    status: "dev",
    description: "Start a project from a stack plan.",
    // No link yet: the repo is not public. The card shows a greyed-out GitHub mark.
    shot: "New project",
    art: [
      " $ ignite",
      " +- [ new project ] ------+",
      " | name   glyph           |",
      " | stack  6 · content     |",
      " | [x] paper  [x] hooks   |",
      " +------------------------+",
      "   ⏎ create",
    ].join("\n"),
  },
];

/** A built-in mark from skill-marks.ts, cleaned the way /admin cleans pasted SVG code. */
const mark = (name: string) => {
  const check = cleanSvg(SKILL_MARKS[name]);
  if (!check.ok) throw new Error(`The built-in mark for ${name} is not valid: ${check.error}`);
  return check.svg;
};

/** Tech chips. Each icon is SVG code; /admin can paste a new one for any skill. */
export const skills: Skill[] = [
  { name: "Next.js", svg: mark("Next.js") },
  { name: "React", svg: mark("React") },
  { name: "TypeScript", svg: mark("TypeScript") },
  { name: "shadcn/ui" },
  { name: "BoardUI" },
  { name: "Claude" },
  { name: "Cloudflare", svg: mark("Cloudflare") },
  { name: "PostgreSQL" },
  { name: "Spring Boot" },
  { name: "Java" },
  { name: "Rust" },
  { name: "Swift" },
  { name: "Figma" },
  { name: "Paper", svg: mark("Paper") },
];

export type Snapshot = { label: string; art: string };

// Placeholder: stand-ins until real photos exist.
export const snapshots: Snapshot[] = [
  {
    label: "01 · desk",
    art: [" .----------.", " | >_ ▌    |", " |          |", " '----------'", "    __||__", " [=========]"].join("\n"),
  },
  {
    label: "02 · the bund",
    art: ["      |", "     /^\\    |", "  _ | o |  /#\\", " |#|| o |_|###|", " |#||   |#|###|", "~~~~~~~~~~~~~~"].join("\n"),
  },
  {
    label: "03 · mochi",
    art: ["   /\\_/\\", "  ( o.o )", "   > ^ <", "  /     \\", " (|     |)", "  \\_____/__~"].join("\n"),
  },
  {
    label: "04 · flat white",
    art: ["    ( (", "     ) )", "  .______.", "  |      |]", "  \\      /", "   `----'"].join("\n"),
  },
  {
    label: "05 · sketchbook",
    art: [" ____________", "|o ~~~~~~~~  |", "|o ~~~~~ ~~  |", "|o [ ]--[ ]  |", "|o    \\_/    |", "|o___________|"].join("\n"),
  },
];

export const nowText = [
  "building   limns.dev",
  "building   limns.cc",
  "keeping    Gtab, open source",
  "building   Ignite",
];
