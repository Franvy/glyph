import { beforeAll, describe, expect, it } from "vitest";
import { isAdminPath, verifyAccessJwt } from "./access";

const ISSUER = "https://glyph.cloudflareaccess.com";
const AUD = "test-aud-tag";
const NOW = 1_800_000_000;

let keys: JsonWebKey[];
let sign: (payload: object, header?: object) => Promise<string>;
let otherSign: typeof sign;

const b64url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
const encode = (value: object) => b64url(new TextEncoder().encode(JSON.stringify(value)));

async function signer(kid: string) {
  const pair = (await crypto.subtle.generateKey(
    { name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" },
    true,
    ["sign", "verify"],
  )) as CryptoKeyPair;
  const jwk = { ...(await crypto.subtle.exportKey("jwk", pair.publicKey)), kid } as JsonWebKey;
  const fn = async (payload: object, header: object = { alg: "RS256", kid }) => {
    const input = `${encode(header)}.${encode(payload)}`;
    const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", pair.privateKey, new TextEncoder().encode(input));
    return `${input}.${b64url(new Uint8Array(sig))}`;
  };
  return { jwk, fn };
}

beforeAll(async () => {
  const a = await signer("key-a");
  const b = await signer("key-b");
  keys = [a.jwk];
  sign = a.fn;
  otherSign = b.fn;
});

const claims = (over: object = {}) => ({
  aud: [AUD],
  iss: ISSUER,
  email: "fran@example.com",
  exp: NOW + 60,
  iat: NOW - 60,
  ...over,
});
const verify = (token: string) => verifyAccessJwt(token, { keys, aud: AUD, issuer: ISSUER, now: NOW });

describe("verifyAccessJwt", () => {
  it("accepts a token that Access signed for this app and returns the email", async () => {
    expect(await verify(await sign(claims()))).toBe("fran@example.com");
    expect(await verify(await sign(claims({ aud: AUD })))).toBe("fran@example.com");
  });

  it("rejects an expired token, or one that is not valid yet", async () => {
    expect(await verify(await sign(claims({ exp: NOW - 1 })))).toBeNull();
    expect(await verify(await sign(claims({ nbf: NOW + 120 })))).toBeNull();
  });

  it("rejects a token for another app or from another team", async () => {
    expect(await verify(await sign(claims({ aud: ["other-app"] })))).toBeNull();
    expect(await verify(await sign(claims({ iss: "https://evil.cloudflareaccess.com" })))).toBeNull();
  });

  it("rejects a token signed by a key that is not in the set", async () => {
    expect(await verify(await otherSign(claims()))).toBeNull();
    expect(await verify(await otherSign(claims(), { alg: "RS256", kid: "key-a" }))).toBeNull();
  });

  it("rejects a token with another algorithm or no signature", async () => {
    expect(await verify(await sign(claims(), { alg: "none", kid: "key-a" }))).toBeNull();
    const [h, p] = (await sign(claims())).split(".");
    expect(await verify(`${h}.${p}.`)).toBeNull();
    expect(await verify(`${h}.${p}`)).toBeNull();
  });

  it("rejects a token whose claims were changed after signing", async () => {
    const [h, , s] = (await sign(claims())).split(".");
    expect(await verify(`${h}.${encode(claims({ email: "evil@example.com" }))}.${s}`)).toBeNull();
  });

  it("rejects garbage", async () => {
    for (const token of ["", "a.b.c", "....", "not a token"]) expect(await verify(token)).toBeNull();
  });

  it("rejects everything when the app is not configured", async () => {
    const token = await sign(claims());
    expect(await verifyAccessJwt(token, { keys, aud: "", issuer: ISSUER, now: NOW })).toBeNull();
    expect(await verifyAccessJwt(token, { keys, aud: AUD, issuer: "", now: NOW })).toBeNull();
  });
});

describe("isAdminPath", () => {
  it("matches the admin page and the admin API, in any case or encoding", () => {
    for (const path of ["/admin", "/admin/", "/api/admin", "/api/admin/content", "/ADMIN", "/Api/Admin/x", "/%61dmin"]) {
      expect(isAdminPath(path), path).toBe(true);
    }
  });

  it("leaves the rest of the site alone", () => {
    for (const path of ["/", "/administrator", "/posts/admin/", "/api/likes", "/api/counters"]) {
      expect(isAdminPath(path), path).toBe(false);
    }
  });
});
