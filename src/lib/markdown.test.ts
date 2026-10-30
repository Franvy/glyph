import { describe, expect, it } from "vitest";
import { defaultContent, projectLink } from "./content";
import { homeMarkdown } from "./markdown";
import { projects, sampleContributions as contributions, site } from "./site";

describe("homeMarkdown", () => {
  const md = homeMarkdown();

  it("starts with the name as the only h1", () => {
    expect(md.startsWith(`# ${site.name}\n`)).toBe(true);
    expect(md.match(/^# /gm)).toHaveLength(1);
  });

  it("links every project that has a link, names the others, and reports the contribution total", () => {
    for (const p of projects) {
      const link = projectLink(p);
      expect(md).toContain(link ? `- [${p.name}](${link}) (${p.status})` : `- ${p.name} (${p.status})`);
    }
    expect(projects.some((p) => !projectLink(p))).toBe(true);
    expect(md).toContain(`${contributions.total} in the last 12 months`);
  });

  it("uses the content edited in /admin when it is given", () => {
    const edited = homeMarkdown({
      ...defaultContent,
      profile: { ...defaultContent.profile, name: "Fran", roles: ["tool maker"], city: "Hangzhou" },
      skills: [{ name: "Rust" }, { name: "Zig" }],
    });
    expect(edited.startsWith("# Fran\n\nTool maker in Hangzhou, China.\n")).toBe(true);
    expect(edited).toContain("Rust, Zig");
  });

  it("lists the booking link only when there is one", () => {
    expect(md).toContain(`- Email: ${site.email}\n- Intro call: ${site.booking}\n`);
    const unbooked = homeMarkdown({ ...defaultContent, profile: { ...defaultContent.profile, booking: undefined } });
    expect(unbooked).not.toContain("- Intro call:");
  });

  it("lists the Duolingo profile only when it is set, and no Reddit", () => {
    expect(md).toContain(`- X: ${site.x}\n- Duolingo: https://www.duolingo.com/profile/${site.duolingo}\n`);
    expect(md).not.toContain("Reddit");
    const without = homeMarkdown({ ...defaultContent, profile: { ...defaultContent.profile, duolingo: undefined } });
    expect(without).not.toContain("- Duolingo:");
  });

  it("adds the GitHub link when a project also has a website", () => {
    const md = homeMarkdown({
      ...defaultContent,
      projects: [{ name: "glyph", status: "live", description: "This site.", site: "https://franvy.dev", github: "https://github.com/franvy/glyph", shot: "Home" }],
    });
    expect(md).toContain("- [glyph](https://franvy.dev) (live): This site. · [GitHub](https://github.com/franvy/glyph)\n");
  });
});
