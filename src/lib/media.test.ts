import { afterAll, describe, expect, it } from "vitest";
import { proxy } from "../../test/cf-env";
import { checkUpload, isMediaKey, putMedia, serveMedia, sniff } from "./media";

const bucket = proxy.env.MEDIA;
afterAll(() => proxy.dispose());

const bytes = (...parts: (number[] | string)[]) =>
  new Uint8Array(parts.flatMap((p) => (typeof p === "string" ? [...new TextEncoder().encode(p)] : p)));

const PNG = bytes([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], "rest of a png");
const JPEG = bytes([0xff, 0xd8, 0xff, 0xe0], "jpeg");
const GIF = bytes("GIF89a....");
const WEBP = bytes("RIFF", [0, 0, 0, 0], "WEBPVP8 ");
const AVIF = bytes([0, 0, 0, 0x1c], "ftypavif");
const MP4 = bytes([0, 0, 0, 0x18], "ftypisom", "0123456789");
const WEBM = bytes([0x1a, 0x45, 0xdf, 0xa3], "webm");
const SVG = bytes(`<?xml version="1.0"?>\n<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M0 0h24v24H0z"/></svg>`);

describe("sniff", () => {
  it("reads the file type from the bytes", () => {
    expect(sniff(PNG)).toBe("png");
    expect(sniff(JPEG)).toBe("jpg");
    expect(sniff(GIF)).toBe("gif");
    expect(sniff(WEBP)).toBe("webp");
    expect(sniff(AVIF)).toBe("avif");
    expect(sniff(MP4)).toBe("mp4");
    expect(sniff(WEBM)).toBe("webm");
    expect(sniff(SVG)).toBe("svg");
    expect(sniff(bytes("  <svg viewBox='0 0 1 1'></svg>"))).toBe("svg");
  });

  it("does not trust anything else", () => {
    for (const b of [bytes(""), bytes("hello"), bytes("<html><svg></svg></html>"), bytes("%PDF-1.7")]) {
      expect(sniff(b)).toBeNull();
    }
  });
});

describe("checkUpload", () => {
  it("accepts images and videos for a project", () => {
    for (const b of [PNG, JPEG, GIF, WEBP, AVIF]) expect(checkUpload(b, "project")).toEqual({ ok: true, ext: sniff(b), kind: "image" });
    for (const b of [MP4, WEBM]) expect(checkUpload(b, "project")).toEqual({ ok: true, ext: sniff(b), kind: "video" });
  });

  it("refuses the wrong type for the slot", () => {
    expect(checkUpload(SVG, "project").ok).toBe(false);
    expect(checkUpload(bytes("plain text"), "project").ok).toBe(false);
  });

  it("refuses an empty or oversized file", () => {
    expect(checkUpload(bytes(""), "project").ok).toBe(false);
    const big = (head: Uint8Array, size: number) => {
      const b = new Uint8Array(size);
      b.set(head);
      return b;
    };
    expect(checkUpload(big(PNG, 5 * 1024 * 1024 + 1), "project").ok).toBe(false);
    expect(checkUpload(big(MP4, 25 * 1024 * 1024 + 1), "project").ok).toBe(false);
    expect(checkUpload(big(MP4, 25 * 1024 * 1024), "project").ok).toBe(true);
  });
});

describe("isMediaKey", () => {
  it("accepts only content-addressed keys", () => {
    expect(isMediaKey(`${"a".repeat(64)}.png`)).toBe(true);
    for (const key of ["", "x.png", `${"a".repeat(64)}.exe`, `../${"a".repeat(64)}.png`, `${"A".repeat(64)}.png`]) {
      expect(isMediaKey(key), key).toBe(false);
    }
  });
});

describe("media in R2", () => {
  it("stores a file under the hash of its bytes, once", async () => {
    const a = await putMedia(bucket, PNG, "png");
    const b = await putMedia(bucket, PNG, "png");
    expect(a).toBe(b);
    expect(isMediaKey(a)).toBe(true);
    const c = await putMedia(bucket, JPEG, "jpg");
    expect(c).not.toBe(a);
  });

  it("serves a file with its type and a long cache", async () => {
    const key = await putMedia(bucket, PNG, "png");
    const res = await serveMedia(bucket, key, new Request(`http://x/media/${key}`));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/png");
    expect(res.headers.get("cache-control")).toContain("immutable");
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(PNG);
  });

  it("serves an SVG so that scripts in it never run", async () => {
    const key = await putMedia(bucket, SVG, "svg");
    const res = await serveMedia(bucket, key, new Request(`http://x/media/${key}`));
    expect(res.headers.get("content-type")).toBe("image/svg+xml");
    expect(res.headers.get("content-security-policy")).toContain("script-src 'none'");
  });

  it("answers a range request with part of a video", async () => {
    const key = await putMedia(bucket, MP4, "mp4");
    const res = await serveMedia(bucket, key, new Request(`http://x/media/${key}`, { headers: { range: "bytes=0-3" } }));
    expect(res.status).toBe(206);
    expect(res.headers.get("content-range")).toBe(`bytes 0-3/${MP4.length}`);
    expect(res.headers.get("accept-ranges")).toBe("bytes");
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(MP4.slice(0, 4));
  });

  it("is a 404 for an unknown or malformed key", async () => {
    expect((await serveMedia(bucket, `${"0".repeat(64)}.png`, new Request("http://x"))).status).toBe(404);
    expect((await serveMedia(bucket, "../secret", new Request("http://x"))).status).toBe(404);
  });
});
