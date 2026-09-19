import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";
import {
  animate,
  motion,
  useMotionValue,
  useSpring,
  useTransform,
} from "framer-motion";
import React, { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import "./LiquidToggle.css";

interface LiquidToggleProps {
  /** 0 to 100 — higher = snappier spring chase (default 87). */
  speed?: number;
  /** 0 to 100 — how far the liquid drop trails the thumb (default 36). */
  stretch?: number;
  /** Called with the new state after a toggle (true = dark). */
  onToggle?: (isDark: boolean) => void;
  className?: string;
}

/**
 * Liquid fluid spring toggle — a gooey SVG-filter blob where a chasing
 * "drop" liquid-stretches behind the main thumb as it springs between
 * sun (light) and moon (dark).
 *
 * Theme state is owned by next-themes (the app's ThemeProvider): class
 * strategy, persisted to localStorage, hydration-safe. All LiquidToggle
 * and ThemeToggle instances across the app stay in sync.
 */
export function LiquidToggle({
  speed = 87,
  stretch = 36,
  onToggle,
  className,
}: LiquidToggleProps) {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const isDark = mounted && resolvedTheme === "dark";

  // Track geometry: 72px wide, 28px thumb, 4px inset → travel 36px
  // (72 − 2 border − 28 thumb − 4 inset = 36). Equal insets keep the
  // thumb a full 4px clear of both edges — no border clipping.
  const THUMB_ON = 36;
  const THUMB_OFF = 4;

  // Motion physics
  const x = useMotionValue(isDark ? THUMB_ON : THUMB_OFF);
  const stiffnessValue = 100 + speed * 2;
  // The chasing drop trails the thumb by `stretch` % of the travel.
  const dropLag = (stretch / 100) * (THUMB_ON - THUMB_OFF);
  const chase = useSpring(x, { stiffness: stiffnessValue, damping: 22, mass: 1 });
  const dropX = useTransform(
    chase,
    (v) => v - (isDark ? -dropLag : dropLag),
  );

  // Keep the spring in sync when the theme changes from OUTSIDE this
  // component (e.g. another ThemeToggle instance elsewhere in the app).
  useEffect(() => {
    x.set(isDark ? THUMB_ON : THUMB_OFF);
  }, [isDark, x]);

  const toggleTheme = () => {
    const nextState = !isDark;
    // next-themes updates the <html> class, persists to localStorage and
    // notifies every subscriber — no manual classList manipulation here.
    setTheme(nextState ? "dark" : "light");
    onToggle?.(nextState);

    animate(x, nextState ? THUMB_ON : THUMB_OFF, {
      type: "spring",
      stiffness: stiffnessValue,
      damping: 18,
      mass: 0.9,
    });
  };

  return (
    <div
      className={cn("liq-toggle-wrapper", className)}
      onClick={toggleTheme}
      role="switch"
      aria-checked={isDark}
      aria-label="Ndrysho temën"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          toggleTheme();
        }
      }}
    >
      {/* SVG Gooey Filter */}
      <svg className="liq-svg-filter" aria-hidden>
        <defs>
          <filter id="liq-goo">
            <feGaussianBlur stdDeviation="7" result="smear" />
            <feColorMatrix
              in="smear"
              type="matrix"
              values="1 0 0 0 0
                      0 1 0 0 0
                      0 0 1 0 0
                      0 0 0 19 -9"
            />
          </filter>
        </defs>
      </svg>

      {/* Track Container */}
      <div className="liq-track" data-dark={isDark}>
        {/* Liquid Chasing Drop — inside the goo filter, melts/stretches. */}
        <div className="liq-goo-layer">
          <motion.div className="liq-drop" style={{ x: dropX }} />
        </div>
        {/* Main Thumb — OUTSIDE the goo layer so the SVG filter can never
            deform it: always a perfect 28×28 circle. */}
        <motion.div className="liq-thumb" style={{ x }} />

        {/* Icons Overlay */}
        <div className="liq-icons">
          <Sun
            className={cn(
              "size-4 transition-colors",
              mounted && !isDark ? "text-amber-400" : "text-slate-500",
            )}
          />
          <Moon
            className={cn(
              "size-4 transition-colors",
              isDark ? "text-blue-400" : "text-slate-500",
            )}
          />
        </div>
      </div>
    </div>
  );
}
