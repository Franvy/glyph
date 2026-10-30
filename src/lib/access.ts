// Cloudflare Access sits in front of /admin and /api/admin and signs every request it lets through
// (Cf-Access-Jwt-Assertion). The Worker checks that signature too, so a request that reaches the Worker some other
// way, such as the workers.dev URL, is still refused. Web Crypto only: no dependency.

/** True for the admin page and the admin API. Decoded and lower-cased first, so /ADMIN or /%61dmin cannot skip it. */
export function isAdminPath(pathname: string): boolean {
  let path = pathname;
  try {
    path = decodeURIComponent(pathname);
  } catch {
    // A malformed escape: test the raw path.
  }
  return /^\/(api\/)?admin(\/|$)/.test(path.toLowerCase());
}

type VerifyOptions = {
  /** The public keys from https://<team>.cloudflareaccess.com/cdn-cgi/access/certs */
  keys: JsonWebKey[];
  /** The Application Audience (AUD) tag of the Access application. */
  aud: string;
  /** https://<team>.cloudflareaccess.com */
  issuer: string;
  /** Seconds since the epoch. Tests pass a fixed value. */
  now?: number;
};

const decode = (part: string) => {
  const b64 = part.replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(b64.padEnd(b64.length + ((4 - (b64.length % 4)) % 4), "=")), (c) => c.charCodeAt(0));
};
const json = (part: string): Record<string, unknown> => JSON.parse(new TextDecoder().decode(decode(part)));

/** Returns the signed-in email when the token is valid for this app, otherwise null. Never throws. */
export async function verifyAccessJwt(token: string, { keys, aud, issuer, now }: VerifyOptions): Promise<string | null> {
  if (!aud || !issuer) return null; // not configured: refuse everyone
  try {
    const [h, p, s] = token.split(".");
    if (!h || !p || !s || token.split(".").length !== 3) return null;
    const header = json(h);
    if (header.alg !== "RS256") return null;
    const jwk = keys.find((k) => (k as { kid?: string }).kid === header.kid);
    if (!jwk) return null;

    const key = await crypto.subtle.importKey("jwk", jwk, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, [
      "verify",
    ]);
    const signed = new TextEncoder().encode(`${h}.${p}`);
    if (!(await crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, decode(s), signed))) return null;

    const claims = json(p);
    const t = now ?? Math.floor(Date.now() / 1000);
    const audiences = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
    if (!audiences.includes(aud)) return null;
    if (claims.iss !== issuer) return null;
    if (typeof claims.exp !== "number" || claims.exp <= t) return null;
    if (typeof claims.nbf === "number" && claims.nbf > t) return null;
    return typeof claims.email === "string" ? claims.email : null;
  } catch {
    return null;
  }
}

let cached: { issuer: string; keys: JsonWebKey[]; at: number } | undefined;

/** Fetches the team's signing keys. Kept for 10 minutes per isolate; Access rotates them every 6 weeks. */
export async function accessKeys(issuer: string): Promise<JsonWebKey[]> {
  if (cached && cached.issuer === issuer && Date.now() - cached.at < 600_000) return cached.keys;
  const res = await fetch(`${issuer}/cdn-cgi/access/certs`);
  if (!res.ok) return [];
  const { keys } = (await res.json()) as { keys?: JsonWebKey[] };
  cached = { issuer, keys: keys ?? [], at: Date.now() };
  return cached.keys;
}
