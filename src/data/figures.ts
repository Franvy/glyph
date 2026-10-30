/** The drawing for each project, by name (figures/). An image or video uploaded in /admin comes first. */
const FIGURES: Record<string, string> = { "limns.cc": "limns-cc", "limns.dev": "limns-dev", Gtab: "gtab", Ignite: "ignite" };

export const figureOf = (project: string): string | undefined => FIGURES[project];
