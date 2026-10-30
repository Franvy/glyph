// Files uploaded in /admin: project images and videos. They live in R2 under the SHA-256 of their
// bytes, so a key never changes its content and the Worker can serve it with a year-long cache.

export type MediaExt = "png" | "jpg" | "gif" | "webp" | "avif" | "svg" | "mp4" | "webm";
export type MediaKind = "image" | "video";
/** Where the file goes: a project card takes an image or a video. Skill icons are SVG code, not files (src/lib/svg.ts). */
export type MediaSlot = "project";

const TYPES: Record<MediaExt, { mime: string; kind: MediaKind }> = {
  png: { mime: "image/png", kind: "image" },
  jpg: { mime: "image/jpeg", kind: "image" },
  gif: { mime: "image/gif", kind: "image" },
  webp: { mime: "image/webp", kind: "image" },
  avif: { mime: "image/avif", kind: "image" },
  svg: { mime: "image/svg+xml", kind: "image" },
  mp4: { mime: "video/mp4", kind: "video" },
  webm: { mime: "video/webm", kind: "video" },
};

const MB = 1024 * 1024;
const RULES: Record<MediaSlot, { exts: MediaExt[]; max: Partial<Record<MediaKind, number>>; label: string }> = {
  project: { exts: ["png", "jpg", "gif", "webp", "avif", "mp4", "webm"], max: { image: 5 * MB, video: 25 * MB }, label: "PNG, JPG, GIF, WebP or AVIF images, or MP4 or WebM videos" },
};

const KEY = /^[0-9a-f]{64}\.(png|jpg|gif|webp|avif|svg|mp4|webm)$/;
export const isMediaKey = (key: string) => KEY.test(key);
export const mediaUrl = (key: string) => `/media/${key}`;

const ascii = (b: Uint8Array, start: number, end: number) => String.fromCharCode(...b.subarray(start, end));

/** The file type from its first bytes. The name and the type the browser sends are never trusted. */
export function sniff(b: Uint8Array): MediaExt | null {
  if (b[0] === 0x89 && ascii(b, 1, 4) === "PNG") return "png";
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "jpg";
  if (ascii(b, 0, 4) === "GIF8") return "gif";
  if (ascii(b, 0, 4) === "RIFF" && ascii(b, 8, 12) === "WEBP") return "webp";
  if (ascii(b, 4, 8) === "ftyp") return /^avi[fs]$/.test(ascii(b, 8, 12)) ? "avif" : "mp4";
  if (b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3) return "webm";
  // SVG is text: an optional XML prolog and comments, then the <svg> root.
  const head = new TextDecoder().decode(b.subarray(0, 1024)).replace(/^﻿/, "");
  if (/^\s*(<\?xml[^>]*>\s*)?(<!--[\s\S]*?-->\s*)*(<!DOCTYPE svg[^>]*>\s*)?<svg[\s>]/i.test(head)) return "svg";
  return null;
}

export type UploadCheck = { ok: true; ext: MediaExt; kind: MediaKind } | { ok: false; error: string };

export function checkUpload(b: Uint8Array, slot: MediaSlot): UploadCheck {
  const rule = RULES[slot];
  if (b.length === 0) return { ok: false, error: "The file is empty. Choose another file." };
  const ext = sniff(b);
  if (!ext || !rule.exts.includes(ext)) return { ok: false, error: `This file type is not supported. You can only upload ${rule.label} here.` };
  const { kind } = TYPES[ext];
  const max = rule.max[kind] ?? 0;
  if (b.length > max) return { ok: false, error: `The file is too large. ${kind === "video" ? "Videos" : "Images"} here can be ${max >= MB ? `${max / MB} MB` : `${max / 1024} KB`} at most. Compress it and upload again.` };
  return { ok: true, ext, kind };
}

/** Stores the bytes and returns their key. The same bytes always get the same key. */
export async function putMedia(bucket: R2Bucket, b: Uint8Array<ArrayBuffer>, ext: MediaExt): Promise<string> {
  const hash = new Uint8Array(await crypto.subtle.digest("SHA-256", b));
  const key = `${Array.from(hash, (x) => x.toString(16).padStart(2, "0")).join("")}.${ext}`;
  if (!(await bucket.head(key))) await bucket.put(key, b, { httpMetadata: { contentType: TYPES[ext].mime } });
  return key;
}

/** The response for GET /media/<key>. Answers range requests, which Safari needs to play a video. */
export async function serveMedia(bucket: R2Bucket, key: string, request: Request): Promise<Response> {
  if (!isMediaKey(key)) return new Response("File not found.", { status: 404 });
  const object = await bucket.get(key, { range: request.headers });
  if (!object) return new Response("File not found.", { status: 404 });

  const ext = key.split(".")[1] as MediaExt;
  const headers = new Headers({
    "content-type": TYPES[ext].mime,
    "cache-control": "public, max-age=31536000, immutable",
    "x-content-type-options": "nosniff",
    "accept-ranges": "bytes",
    etag: object.httpEtag,
  });
  // An SVG opened on its own would run its scripts on this origin. This policy stops that.
  if (ext === "svg") headers.set("content-security-policy", "default-src 'none'; style-src 'unsafe-inline'; script-src 'none'; sandbox");

  const range = object.range as { offset?: number; length?: number } | undefined;
  if (request.headers.has("range") && range && range.offset !== undefined) {
    const length = range.length ?? object.size - range.offset;
    headers.set("content-range", `bytes ${range.offset}-${range.offset + length - 1}/${object.size}`);
    headers.set("content-length", String(length));
    return new Response(object.body, { status: 206, headers });
  }
  headers.set("content-length", String(object.size));
  return new Response(object.body, { headers });
}
