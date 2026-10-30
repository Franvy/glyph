import { describe, expect, it } from "vitest";
import { cueFor, gate, soundOn } from "./sound";

const page = new URL("https://franvy.dev/posts/hello-world/");

describe("soundOn", () => {
  it("is on unless the reader turned it off", () => {
    expect(soundOn(null)).toBe(true);
    expect(soundOn("on")).toBe(true);
    expect(soundOn("junk")).toBe(true);
    expect(soundOn("off")).toBe(false);
  });
});

describe("cueFor", () => {
  it("plays navigate for a link inside the site, in-page jumps too", () => {
    expect(cueFor({ tag: "A", href: "/" }, page)).toBe("navigate");
    expect(cueFor({ tag: "a", href: "https://franvy.dev/rss.xml" }, page)).toBe("navigate");
    expect(cueFor({ tag: "a", href: "#projects" }, page)).toBe("navigate");
  });

  it("plays tap for a link that leaves the site", () => {
    expect(cueFor({ tag: "a", href: "https://github.com/franvy" }, page)).toBe("tap");
    expect(cueFor({ tag: "a", href: "mailto:hi@franvy.dev" }, page)).toBe("tap");
  });

  it("plays tap for a same-site download", () => {
    expect(cueFor({ tag: "a", href: "/cv.pdf", download: true }, page)).toBe("tap");
  });

  it("stays silent for an anchor without a href", () => {
    expect(cueFor({ tag: "a", href: null }, page)).toBeNull();
    expect(cueFor({ tag: "a" }, page)).toBeNull();
  });

  it("plays toggle for a button with a pressed state, tap for any other button", () => {
    expect(cueFor({ tag: "button", pressed: "true" }, page)).toBe("toggle");
    expect(cueFor({ tag: "BUTTON", pressed: "false" }, page)).toBe("toggle");
    expect(cueFor({ tag: "button" }, page)).toBe("tap");
  });

  it("stays silent for other elements", () => {
    expect(cueFor({ tag: "div" }, page)).toBeNull();
    expect(cueFor({ tag: "li" }, page)).toBeNull();
  });
});

describe("gate", () => {
  it("lets one event through per gap", () => {
    const open = gate(50);
    expect(open(1000)).toBe(true);
    expect(open(1020)).toBe(false);
    expect(open(1049)).toBe(false);
    expect(open(1050)).toBe(true);
    expect(open(1060)).toBe(false);
  });

  it("keeps each gate apart", () => {
    const a = gate(50);
    const b = gate(50);
    expect(a(0)).toBe(true);
    expect(b(10)).toBe(true);
  });
});
