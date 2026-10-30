import { useSyncExternalStore } from "react";
import { formatClock } from "@/lib/time";

// One shared minute tick for every clock on the page.
let minute = 0;
function subscribe(onTick: () => void) {
  const tick = () => {
    minute = Math.floor(Date.now() / 60_000);
    onTick();
  };
  tick();
  const id = window.setInterval(tick, 5_000);
  return () => window.clearInterval(id);
}
const getMinute = () => minute;
const getServerMinute = () => -1;

/** Host time. Renders "--:--" until hydrated. */
export function useHostClock(timeZone: string) {
  const current = useSyncExternalStore(subscribe, getMinute, getServerMinute);
  return current < 0 ? "--:--" : formatClock(new Date(current * 60_000), timeZone);
}

export function HostClock({ timeZone, city }: { timeZone: string; city: string }) {
  const time = useHostClock(timeZone);
  return (
    // A phone stacks the city under the time.
    <span className="flex shrink-0 text-xs leading-4 text-body tabular-nums max-sm:flex-col max-sm:items-end">
      {time}
      <span className="whitespace-pre max-sm:hidden"> · </span>
      <span className="max-sm:text-mute">{city}</span>
    </span>
  );
}
