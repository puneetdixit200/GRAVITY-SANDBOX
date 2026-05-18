"use client";

import { useEffect, useRef } from "react";

export function useAnimationLoop(callback: (dt: number, now: number) => void, enabled = true) {
  const callbackRef = useRef(callback);
  const previousTimeRef = useRef<number | null>(null);

  callbackRef.current = callback;

  useEffect(() => {
    if (!enabled) {
      return;
    }

    let frame = 0;
    let cancelled = false;

    const tick = (now: number) => {
      if (cancelled) {
        return;
      }

      const previous = previousTimeRef.current ?? now;
      const dt = Math.min(0.05, Math.max(0, (now - previous) / 1000));
      previousTimeRef.current = now;
      callbackRef.current(dt, now);
      frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);

    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      previousTimeRef.current = null;
    };
  }, [enabled]);
}
