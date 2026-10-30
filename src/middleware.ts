import { defineMiddleware } from "astro:middleware";
import { accessKeys, isAdminPath, verifyAccessJwt } from "@/lib/access";

const denied = (pathname: string) => {
  const message = "Access denied. Sign in with Cloudflare Access, then open /admin again.";
  return pathname.toLowerCase().includes("/api/")
    ? Response.json({ error: message }, { status: 403 })
    : new Response(message, { status: 403, headers: { "content-type": "text/plain; charset=utf-8" } });
};

// The one gate in front of /admin and /api/admin. Every other route passes straight through.
export const onRequest = defineMiddleware(async ({ url, request }, next) => {
  if (!isAdminPath(url.pathname)) return next();
  // `pnpm dev` only: the dev server never runs behind Access. Preview and production builds always check.
  if (import.meta.env.DEV) return next();

  const { env } = await import("cloudflare:workers");
  const issuer = env.ACCESS_TEAM_DOMAIN.replace(/\/+$/, "");
  const token = request.headers.get("cf-access-jwt-assertion");
  const email =
    token && issuer && env.ACCESS_AUD
      ? await verifyAccessJwt(token, { keys: await accessKeys(issuer), aud: env.ACCESS_AUD, issuer })
      : null;
  if (!email) return denied(url.pathname);
  return next();
});
