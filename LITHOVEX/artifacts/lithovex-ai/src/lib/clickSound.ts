import { useEffect } from "react";
import clickSoundUrl from "@/assets/click.wav";

const POOL_SIZE = 4;
const VOLUME = 0.35;

let pool: HTMLAudioElement[] | null = null;
let poolIndex = 0;
let unlocked = false;

function ensurePool() {
  if (pool) return pool;
  pool = Array.from({ length: POOL_SIZE }, () => {
    const a = new Audio(clickSoundUrl);
    a.preload = "auto";
    a.volume = VOLUME;
    return a;
  });
  return pool;
}

function unlockOnce() {
  if (unlocked) return;
  const p = ensurePool();
  p.forEach(a => {
    try {
      a.muted = true;
      const playPromise = a.play();
      if (playPromise && typeof playPromise.then === "function") {
        playPromise
          .then(() => {
            a.pause();
            a.currentTime = 0;
            a.muted = false;
          })
          .catch(() => {
            a.muted = false;
          });
      } else {
        a.pause();
        a.currentTime = 0;
        a.muted = false;
      }
    } catch {
      /* noop */
    }
  });
  unlocked = true;
}

export function playClickSound() {
  try {
    const p = ensurePool();
    const a = p[poolIndex];
    poolIndex = (poolIndex + 1) % p.length;
    a.currentTime = 0;
    const r = a.play();
    if (r && typeof r.catch === "function") r.catch(() => { /* autoplay blocked */ });
  } catch {
    /* noop */
  }
}

function isInteractive(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  const el = target.closest(
    'button, [role="button"], a[href], [role="menuitem"], [role="tab"], [role="switch"], [role="checkbox"], [role="option"], summary, label[for], input[type="button"], input[type="submit"], input[type="reset"], input[type="checkbox"], input[type="radio"], [data-click-sound]',
  );
  if (!el) return false;
  if (el.hasAttribute("data-no-click-sound")) return false;
  if (el.closest("[data-no-click-sound]")) return false;
  if ((el as HTMLButtonElement).disabled) return false;
  if (el.getAttribute("aria-disabled") === "true") return false;
  return true;
}

/**
 * Attaches a single, app-wide pointerdown listener that plays a short click
 * sound whenever an interactive element (button, link, switch, menu item, …)
 * is activated. Browsers require a user gesture before audio is allowed, so
 * the first interaction also unlocks the audio pool.
 *
 * Use `data-no-click-sound` on any element (or its ancestor) to opt out.
 */
export function useGlobalClickSound() {
  useEffect(() => {
    const onPointerDown = (e: PointerEvent) => {
      if (!isInteractive(e.target)) return;
      unlockOnce();
      playClickSound();
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Enter" && e.key !== " ") return;
      if (!isInteractive(e.target)) return;
      unlockOnce();
      playClickSound();
    };

    document.addEventListener("pointerdown", onPointerDown, { capture: true });
    document.addEventListener("keydown", onKeyDown, { capture: true });
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, { capture: true } as EventListenerOptions);
      document.removeEventListener("keydown", onKeyDown, { capture: true } as EventListenerOptions);
    };
  }, []);
}
