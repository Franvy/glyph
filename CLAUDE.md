# CLAUDE.md

glyph: the ASCII-style personal site of franvy, a design engineer in Shanghai.
An Astro site. It runs as one Cloudflare Worker. Most pages are static HTML.

## Design
- Keep the ASCII / monospace visual language and the minimal style.

## Stack
- Astro 7, TypeScript strict, pnpm (`packageManager` pins the version).
- Deploy: @astrojs/cloudflare + wrangler. Bindings: wrangler.jsonc. Images are optimised at build time (sharp).
- UI: .astro components, Tailwind v4 and plain CSS in src/styles. React only for islands. Designs are in Paper.
- Dynamic: on-demand routes in src/pages/api (prerender = false).
  Data in Cloudflare D1 (binding DB). Drizzle (drizzle-orm/d1, sqlite-core).
- Analytics: Cloudflare Web Analytics.
- Tests: astro check, Vitest (local D1), Playwright (smoke tests, on the preview build).
- Logs: Workers Logs. No CMS.
- Admin: /admin edits the home page content (src/lib/content.ts, D1 table sections).
  Cloudflare Access protects /admin and /api/admin. src/middleware.ts verifies the
  Access JWT (vars ACCESS_TEAM_DOMAIN, ACCESS_AUD). pnpm dev skips the check.
- Media: project images/videos and skill icons uploaded in /admin go to R2
  (binding MEDIA, src/lib/media.ts). Keys are the SHA-256 of the bytes. /media/<key> serves them.

## Commands
pnpm dev                  # :4321, in workerd, local D1 in .wrangler/
pnpm preview              # build and run in workerd (same as prod)
pnpm db:generate          # schema.ts -> new SQL in migrations/
pnpm db:migrate:local     # apply migrations to local D1
pnpm cf-typegen           # after you change wrangler.jsonc
pnpm check && pnpm test
pnpm e2e                  # Playwright, against the preview build

## Code rules
- Pages are prerendered. Add prerender = false only to a route
  that reads or writes D1 (/, /index.md, /admin, api/*). Do not set output: 'server'.
- On an on-demand page, <Image /> does not resize (the "compile" image service
  passes files through). Use an asset that is already the right size.
- Use .astro components by default. Use a React island only
  when the reader must interact. Use client:visible. Use client:load only for
  an island that must listen before it is seen.
- Read bindings with import { env } from 'cloudflare:workers'.
  Do not use Astro.locals.runtime.
- Put D1 logic in src/lib. Its functions take a D1Database argument.
  Endpoints only validate input and call src/lib.
- src/lib must not import astro:* or cloudflare:workers. Code that needs
  them goes in src/data.
- Validate all input on the server with Zod before you use it.
- Every page gets a title and a description through the Base layout.
- Use <Image /> for local images. Give each image alt text.
- Only public values get the PUBLIC_ prefix. Secrets go in
  wrangler secret and .dev.vars. Add each new key name to .env.example.
- Do not add a CMS, another auth, analytics or cache service. Ask first.
- A new dependency must run on Workers. After you add one, run pnpm preview.
- Do not deploy from your machine. CI deploys main.

## Database rules
- The schema is src/db/schema.ts (sqlite-core). Change it,
  then pnpm db:generate.
- Apply migrations only with wrangler d1 migrations apply.
  Keep drizzle-kit on 0.31.x. Ask before you upgrade it.
- Never edit a migration that has run. Add a new one.
- Write rules as constraints (NOT NULL / UNIQUE / CHECK).
- Change a counter in one SQL statement. Do not read, add
  and write it back.
- Counters and business data go in D1, not KV.

## Test rules
- Fixing a bug: first write a test that fails because of the bug,
  then fix it.
- New feature: write the failing test first, then the code.
- Do not change, skip or delete an existing test to make it pass.
  Change a test only when the behaviour it pins was meant to
  change, and say so.
- Playwright is a smoke suite: broken links, lost counts, admin access,
  fonts. Do not add screenshot comparisons. Do not add a test that
  waits on an animation or a timer: CI renders WebGL in software and
  such tests fail at random. Check motion and layout in a real browser.
- Changing the database: add the constraint and an integration
  test for it.
- Database tests use local D1 (test/cf-env.ts). Never mock it.
- Vitest tests src/lib only. Test endpoints and pages with Playwright.
- Unit and integration tests: src/**/*.test.ts. E2E: e2e/*.spec.ts.
- client:visible islands hydrate only in view. In E2E, scroll to one before you assert on it.
- Test first what is most dangerous: broken links, lost counts,
  then the page layout.
- CI runs astro check, vitest and Playwright.
- After a UI change, look at it in a real browser before you say it is done.

## Writing
Code, comments and commit messages are in English.
For README, docs, commit messages, steps and user-facing text,
write in the spirit of ASD-STE100:
- Short sentences. One idea per sentence.
  Steps are numbered imperatives.
- Active voice. Say who does what.
- One word, one meaning. Use simple words.
- In a warning, give the instruction first, then the reason.
- Do not remove facts to make it shorter.

All text on the site is English, error text too. An error says what happened and
what to do next.
