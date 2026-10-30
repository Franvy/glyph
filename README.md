<div align="center">

# glyph

An ASCII-style personal site with a pixel garden that follows the real sky.

[**franvy.cc**](https://franvy.cc) · [Run locally](#run-locally) · [Deploy your own](#deploy-your-own)

**English** · [简体中文](README.zh-CN.md)

<img src=".github/assets/screenshot.png" alt="The glyph home page: a pixel garden at night above the intro, the links and a contribution calendar" width="720">

</div>

## Highlights

- **A live banner.** The garden shows the local time, the moon phase and the current weather in Shanghai.
- **Festival themes.** On Chinese festivals, such as Spring Festival and Mid-Autumn, the page gets a new theme.
- **Isometric project figures.** Each project is a small animated machine, drawn by the scripts in `figures/`.
- **Meiqiu (煤球).** A pixel cat lives in the footer. Pet it. The site counts every pet.
- **Readable by agents.** [`/index.md`](https://franvy.cc/index.md) serves the home page as Markdown.
- **Its own editor.** `/admin` edits the home page. Cloudflare Access protects it.

## Stack

[Astro](https://astro.build) 7 and TypeScript on one [Cloudflare Worker](https://developers.cloudflare.com/workers/).
D1 (with Drizzle) holds the content and the counters. R2 holds the uploaded media.
Tailwind CSS v4 for styles, React only for the interactive islands.
Vitest and Playwright for tests.

## Run locally

You need Node.js 24 and pnpm (`corepack enable` gets the pinned version).

```sh
git clone https://github.com/Franvy/glyph.git && cd glyph
pnpm install
pnpm db:migrate:local   # create the local D1 tables
pnpm dev                # http://localhost:4321
```

The site runs without tokens. To get the live data, copy `.env.example` to `.dev.vars` and add
`GITHUB_TOKEN` (contribution calendar) and `CAIYUN_TOKEN` (weather).

Before you open a pull request, run `pnpm check && pnpm test && pnpm e2e`.
[`CLAUDE.md`](CLAUDE.md) holds the code, database and test rules.

## Deploy your own

1. Put your own content in `src/lib/site.ts`, and replace the images in `src/assets/`.
2. Create the database and the bucket:
   `pnpm dlx wrangler d1 create glyph-db` and `pnpm dlx wrangler r2 bucket create glyph-media`.
3. In `wrangler.jsonc`, set your `database_id`, your domain and your Cloudflare Access values.
   Set the same domain as `site` in `astro.config.mjs`.
4. Add the tokens with `pnpm dlx wrangler secret put <NAME>`.
5. Add `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` to the GitHub repository secrets.
   Each push to `main` then runs the checks, applies the migrations and deploys.

## License

The code is under the [MIT License](LICENSE). The Paper Mono font is under the
[SIL Open Font License](src/assets/fonts/PaperMono-OFL.txt).
The avatar, the personal content and the third-party logos are not part of this license.
