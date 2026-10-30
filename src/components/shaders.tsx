import { lazy, Suspense, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { GardenBanner } from "@/components/garden-banner";
import { WeatherReadout, useWeather } from "@/components/weather";
import { bannerScene } from "@/lib/garden/sky";
import { nextScene, SCENE_LABELS, type SceneName } from "@/lib/garden/themes";

// Loaded after hydration so the WebGL bundle never delays the page becoming interactive.
const Dithering = lazy(() => import("@paper-design/shaders-react").then((m) => ({ default: m.Dithering })));

// Shader colors can't read CSS variables, so each theme's values are mirrored here from globals.css.
const PALETTE = {
  dark: { bg: "#111111", grain: "#1c1c1b" },
  light: { bg: "#fbfaf8", grain: "#efede9" },
};


function subscribe(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
  motion.addEventListener("change", onChange);
  return () => {
    observer.disconnect();
    motion.removeEventListener("change", onChange);
  };
}

// "light" | "dark", plus "-still" when the visitor asked for less motion. Null until hydrated.
function getSnapshot() {
  const theme = document.documentElement.dataset.theme === "light" ? "light" : "dark";
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches ? `${theme}-still` : theme;
}
const getServerSnapshot = () => null;

function useShaderMood() {
  const mood = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  if (!mood) return null;
  const theme = mood.startsWith("light") ? "light" : "dark";
  return { colors: PALETTE[theme], theme, still: mood.endsWith("-still") } as const;
}

function subscribeIntro(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-intro"] });
  return () => observer.disconnect();
}

// True once the intro (base.astro) is over, or when it does not play. False until hydrated.
function useIntroOver() {
  return useSyncExternalStore(
    subscribeIntro,
    () => document.documentElement.dataset.intro !== "play",
    () => false,
  );
}

/** Page ground: a slow 8x8 dither, barely lighter than the background, seen in the side gutters. */
export function BackgroundShader() {
  const mood = useShaderMood();
  // Starting WebGL blocks the main thread for a moment. During the intro that stalls the opening circle.
  const introOver = useIntroOver();
  if (!mood || !introOver) return null;
  return (
    <Suspense>
    <Dithering
      aria-hidden
      className="shader-fade pointer-events-none fixed inset-0 -z-10"
      colorBack={mood.colors.bg}
      colorFront={mood.colors.grain}
      shape="simplex"
      type="8x8"
      size={2}
      scale={0.6}
      // The E2E build draws one frame: CI renders WebGL in software, and a moving ground starves the timed tests.
      speed={mood.still || import.meta.env.E2E_FIXTURES ? 0 : 0.15}
      maxPixelCount={1920 * 1080}
    />
    </Suspense>
  );
}

/**
 * Top banner: 煤球's pixel garden under the sky of Hangzhou. A festival garden wins over the weather;
 * the theme saved in /admin shows only while there is no live weather. The switch in the soil cycles
 * the themes for testing: it changes this page only, and a reload follows the weather again.
 */
export function BannerShader({ scene: saved = "clear" }: { scene?: SceneName }) {
  const mood = useShaderMood();
  const weather = useWeather();
  const [picked, setPicked] = useState<SceneName | null>(null);
  if (!mood) return null;
  const festival = document.documentElement.dataset.festival ?? null;
  const scene = bannerScene({ picked, festival, weather: weather?.kind ?? null, saved });
  return (
    <div className="shader-fade absolute inset-0">
      <FitGarden theme={mood.theme} still={mood.still} scene={scene} />
      <button
        type="button"
        aria-label={`Banner theme: ${SCENE_LABELS[scene]}. Click for the next one (this page only)`}
        title="For testing: try another banner theme. A reload follows the weather again."
        // data-live: the label follows the weather, so the layout screenshot masks it.
        data-live
        data-cuelume-select
        // Centred on the soil under the grass line, by the capitals, at every banner size.
        className="press absolute top-[calc(100%*192/220)] bottom-0 left-[7px] flex items-center text-[11px] leading-[14px] tracking-[0.08em] text-dim hover:text-body max-sm:left-[3px] max-sm:text-[9px] max-sm:leading-[10px] max-sm:tracking-[0.06em]"
        onClick={() => setPicked(nextScene(scene))}
      >
        <span className="[text-box:trim-both_cap_alphabetic]">{SCENE_LABELS[scene].toUpperCase()}</span>
      </button>
      <WeatherReadout weather={weather} />
    </div>
  );
}

/** The full-size banner. A smaller box shows this garden scaled down, so it keeps the tree and the fence. */
const BANNER_W = 666;
const BANNER_H = 220;

/**
 * The garden at the full banner height, scaled to fit the height of its box. At 220 px tall (desktop)
 * the scale is 1. A phone banner keeps the 666:220 shape, so the same garden is drawn smaller.
 */
function FitGarden({ theme, still, scene }: { theme: "dark" | "light"; still: boolean; scene: SceneName }) {
  const box = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<{ w: number; scale: number } | null>(null);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const fit = new ResizeObserver(() => {
      const scale = el.clientHeight / BANNER_H;
      setSize(scale > 0 ? { w: el.clientWidth / scale, scale } : null);
    });
    fit.observe(el);
    return () => fit.disconnect();
  }, []);
  return (
    <div ref={box} className="absolute inset-0 overflow-hidden">
      {size && (
        <div
          className="absolute top-0 left-0 origin-top-left"
          style={{ width: size.w, height: BANNER_H, transform: size.scale === 1 ? undefined : `scale(${size.scale})` }}
        >
          <GardenBanner theme={theme} still={still} scene={scene} />
        </div>
      )}
    </div>
  );
}

/** A full-size garden scaled to fit its box, so the preview in /admin has the tree and fence of the real banner. */
export function BannerPreview({ scene }: { scene: SceneName }) {
  const mood = useShaderMood();
  return (
    <div className="relative w-full overflow-hidden bg-bg" style={{ aspectRatio: `${BANNER_W} / ${BANNER_H}` }}>
      {mood && <FitGarden theme={mood.theme} still={mood.still} scene={scene} />}
    </div>
  );
}
