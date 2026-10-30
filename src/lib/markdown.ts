import { defaultContent, duolingoLink, projectLink, type SiteContent, siteWith } from "./content";
import type { ContributionYear } from "./contributions";
import { sampleContributions } from "./site";

/** The home page as plain markdown, served at /index.md for readers and agents. */
export function homeMarkdown(
  content: SiteContent = defaultContent,
  contributions: ContributionYear = sampleContributions,
): string {
  const site = siteWith(content.profile);
  return [
    `# ${site.name}`,
    "",
    `${site.roles[0][0].toUpperCase()}${site.roles[0].slice(1)} in ${site.city}, ${site.country}.`,
    "",
    `- GitHub: ${site.github}`,
    `- X: ${site.x}`,
    ...(site.duolingo ? [`- Duolingo: ${duolingoLink(site.duolingo)}`] : []),
    `- Email: ${site.email}`,
    ...(site.booking ? [`- Intro call: ${site.booking}`] : []),
    "",
    "## Projects",
    "",
    ...content.projects.map(
      (p) => {
        const link = projectLink(p);
        return `- ${link ? `[${p.name}](${link})` : p.name} (${p.status}): ${p.description}${p.site && p.github ? ` · [GitHub](${p.github})` : ""}`;
      },
    ),
    "",
    "## Contributions",
    "",
    `${contributions.total} in the last 12 months · longest streak ${contributions.longest} d · current ${contributions.current} d`,
    "",
    "## Skills & Technologies",
    "",
    content.skills.map((s) => s.name).join(", "),
    "",
  ].join("\n");
}
