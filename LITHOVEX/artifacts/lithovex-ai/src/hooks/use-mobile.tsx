import * as React from "react"

// ─── Single source of truth for the mobile breakpoint ──────────────────────
// 768px (Tailwind's `md:`) — anything <768px is treated as mobile.
const MOBILE_BREAKPOINT = 768

export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(undefined)

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
    const onChange = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    }
    mql.addEventListener("change", onChange)
    setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    return () => mql.removeEventListener("change", onChange)
  }, [])

  return !!isMobile
}

// ─── useViewportHeight ─────────────────────────────────────────────────────
// Returns the live `window.innerHeight` and updates on resize / orientation
// change. Useful as a JS fallback when `100dvh` is not available (legacy
// iOS Safari) or when a component needs a numeric pixel height for inline
// styles, virtualised lists, or canvas sizing. SSR-safe (returns 0 until
// the effect runs in the browser).
export function useViewportHeight(): number {
  const [height, setHeight] = React.useState<number>(() => {
    if (typeof window === "undefined") return 0
    return window.innerHeight
  })

  React.useEffect(() => {
    const onResize = () => setHeight(window.innerHeight)
    onResize()
    window.addEventListener("resize", onResize)
    window.addEventListener("orientationchange", onResize)
    return () => {
      window.removeEventListener("resize", onResize)
      window.removeEventListener("orientationchange", onResize)
    }
  }, [])

  return height
}
