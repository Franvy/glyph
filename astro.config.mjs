// @ts-check
import cloudflare from "@astrojs/cloudflare";
import react from "@astrojs/react";
import sitemap from "@astrojs/sitemap";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig, fontProviders } from "astro/config";

// Pages are prerendered. Only routes with `export const prerender = false` run in the Worker.
export default defineConfig({
  site: "https://franvy.cc",
  // Images are optimised by sharp at build time; no Images binding, no KV-backed sessions.
  adapter: cloudflare({ imageService: "compile" }),
  session: false,
  integrations: [react(), sitemap({ filter: (page) => !new URL(page).pathname.startsWith("/admin") })],
  vite: {
    plugins: [tailwindcss()],
    // The E2E build (E2E_FIXTURES=1) draws sample contribution counts instead of asking GitHub,
    // and holds the page ground still.
    define: { "import.meta.env.E2E_FIXTURES": JSON.stringify(process.env.E2E_FIXTURES === "1") },
    // The dev dependency scan crawls test/cf-env.ts, which imports wrangler (Node-only) for the tests.
    // Pre-bundling it for workerd fails, so keep it out.
    optimizeDeps: { exclude: ["wrangler"] },
    environments: {
      ssr: {
        // Only on-demand routes (api/*, index.md) import these, so the startup scan misses them.
        // A late re-optimize in workerd then points at deps_ssr files that never get written.
        // The same late re-optimize also splits React: islands keep the raw react cjs while
        // react-dom/server comes from the new deps_ssr bundle ("Invalid hook call").
        // So pre-bundle the whole React stack up front, and keep @lucide/astro (plain ESM .ts)
        // out of pre-bundling, so a new icon import never starts a re-optimize.
        optimizeDeps: {
          include: [
            "drizzle-orm",
            "drizzle-orm/d1",
            "drizzle-orm/sqlite-core",
            "react",
            "react/jsx-runtime",
            "react/jsx-dev-runtime",
            "react-dom",
            "react-dom/server",
            "lucide-react",
            "@paper-design/shaders-react",
          ],
          exclude: ["@lucide/astro"],
        },
      },
    },
  },
  fonts: [
    {
      // Prose: sentences, the name and the about text. Labels, numbers and ASCII stay in Paper Mono.
      name: "Inter",
      cssVariable: "--font-inter",
      provider: fontProviders.google(),
      weights: [400, 500, 600, 700],
      styles: ["normal"],
      subsets: ["latin"],
    },
    {
      name: "Paper Mono",
      cssVariable: "--font-paper-mono",
      provider: fontProviders.local(),
      fallbacks: ["monospace"],
      // The metric fallback is local("Courier New"). Linux has no Courier New, so that face fails to load.
      optimizedFallbacks: false,
      options: {
        variants: [{ weight: "100 800", style: "normal", src: ["./src/assets/fonts/PaperMono-Variable.woff2"] }],
      },
    },
  ],
});
