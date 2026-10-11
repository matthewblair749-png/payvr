"use client";

import { motion, useMotionValue, useReducedMotion, useSpring } from "framer-motion";
import clsx from "clsx";
import { useEffect, useRef, useState } from "react";

export type MascotMood = "idle" | "thinking" | "happy";

interface MascotProps {
  mood?: MascotMood;
  /** Keep the right arm waving on a loop. */
  waving?: boolean;
  /** Accessible description. Omit to mark the mascot as decorative. */
  label?: string;
  className?: string;
}

// Geometry, in viewBox units (0 0 180 210).
const EYES = { left: 62, right: 98, y: 95 };
const PUPIL_TRAVEL = 5;
const NECK = "80px 132px"; // head tilts around here
const SHOULDER = "128px 102px"; // waving arm pivots here

/**
 * Babel's mascot: a little tower of three tiers. Eyes follow the pointer, it
 * blinks now and then, tilts its head while "thinking" (translating) and
 * bounces when happy. All looping motion stops under prefers-reduced-motion.
 */
export function Mascot({ mood = "idle", waving = true, label, className }: MascotProps) {
  const reduce = useReducedMotion() ?? false;
  const svgRef = useRef<SVGSVGElement>(null);
  const [blinking, setBlinking] = useState(false);

  // Pupil offset, smoothed with a spring so the eyes glide rather than jump.
  const rawX = useMotionValue(0);
  const rawY = useMotionValue(0);
  const pupilX = useSpring(rawX, { stiffness: 300, damping: 24 });
  const pupilY = useSpring(rawY, { stiffness: 300, damping: 24 });

  useEffect(() => {
    let frame = 0;
    function onMove(event: PointerEvent) {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const svg = svgRef.current;
        if (!svg) return;
        const rect = svg.getBoundingClientRect();
        const cx = rect.left + rect.width * (80 / 180);
        const cy = rect.top + rect.height * (EYES.y / 210);
        const dx = event.clientX - cx;
        const dy = event.clientY - cy;
        const distance = Math.hypot(dx, dy) || 1;
        // Look further the further away the pointer is, up to the eye's edge.
        const reach = Math.min(1, distance / 240) * PUPIL_TRAVEL;
        rawX.set((dx / distance) * reach);
        rawY.set((dy / distance) * reach);
      });
    }
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("pointermove", onMove);
    };
  }, [rawX, rawY]);

  // Random blinks every 2.5-6s, sometimes a quick double blink.
  useEffect(() => {
    if (reduce) return;
    let timer: ReturnType<typeof setTimeout>;
    function schedule() {
      timer = setTimeout(
        () => {
          setBlinking(true);
          const double = Math.random() < 0.2;
          timer = setTimeout(() => {
            setBlinking(false);
            if (double) {
              timer = setTimeout(() => {
                setBlinking(true);
                timer = setTimeout(() => {
                  setBlinking(false);
                  schedule();
                }, 110);
              }, 140);
            } else {
              schedule();
            }
          }, 120);
        },
        2500 + Math.random() * 3500,
      );
    }
    schedule();
    return () => clearTimeout(timer);
  }, [reduce]);

  const thinking = mood === "thinking";
  const happy = mood === "happy";

  return (
    <svg
      ref={svgRef}
      viewBox="0 0 180 210"
      className={clsx("h-auto w-full overflow-visible", className)}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
    >
      {/* Whole body: bounces when happy */}
      <motion.g
        animate={happy && !reduce ? { y: [0, -12, 0, -6, 0] } : { y: 0 }}
        transition={{ duration: 0.7, ease: "easeOut" }}
      >
        {/* Bottom tier and feet stay planted while the head moves */}
        <ellipse cx="62" cy="182" rx="12" ry="7" fill="#E04E30" />
        <ellipse cx="98" cy="182" rx="12" ry="7" fill="#E04E30" />
        <rect x="38" y="128" width="84" height="50" rx="18" fill="var(--mascot-coral)" />

        {/* Head: antenna, top tier, middle tier, arms and face */}
        <motion.g
          style={{ transformBox: "view-box", transformOrigin: NECK }}
          animate={thinking && !reduce ? { rotate: [0, -7, 4, -7, 0] } : { rotate: happy ? -3 : 0 }}
          transition={
            thinking && !reduce
              ? { duration: 1.6, ease: "easeInOut", repeat: Infinity }
              : { type: "spring", stiffness: 260, damping: 18 }
          }
        >
          {/* Antenna with a speech-bubble tip */}
          <path d="M80 40C80 31 83 25 88 19" fill="none" stroke="var(--ink)" strokeWidth="3" strokeLinecap="round" />
          <motion.g
            style={{ transformBox: "view-box", transformOrigin: "91px 14px" }}
            animate={thinking && !reduce ? { scale: [1, 1.12, 1] } : { scale: 1 }}
            transition={{ duration: 0.8, repeat: thinking && !reduce ? Infinity : 0 }}
          >
            <path
              d="M91 4a10 10 0 1 1-6.2 17.8L80 24l1.6-5.2A10 10 0 0 1 91 4Z"
              fill="var(--cream)"
              stroke="var(--ink)"
              strokeWidth="2.5"
              strokeLinejoin="round"
            />
            {thinking && (
              <g fill="var(--ink)">
                <circle cx="87" cy="14" r="1.6" />
                <circle cx="91.5" cy="14" r="1.6" />
                <circle cx="96" cy="14" r="1.6" />
              </g>
            )}
          </motion.g>

          <rect x="46" y="38" width="68" height="36" rx="16" fill="var(--violet)" />

          {/* Resting left arm */}
          <path d="M34 104C22 114 20 124 24 134" fill="none" stroke="var(--sun)" strokeWidth="10" strokeLinecap="round" />

          {/* Waving right arm */}
          <motion.g
            style={{ transformBox: "view-box", transformOrigin: SHOULDER }}
            animate={waving && !reduce ? { rotate: [0, 22, -4, 22, 0] } : { rotate: 0 }}
            transition={
              waving && !reduce
                ? { duration: happy ? 0.9 : 1.4, ease: "easeInOut", repeat: Infinity, repeatDelay: happy ? 0.2 : 1.8 }
                : { duration: 0.2 }
            }
          >
            <path d="M126 102C142 94 150 82 152 66" fill="none" stroke="var(--sun)" strokeWidth="10" strokeLinecap="round" />
            <circle cx="152" cy="60" r="8.5" fill="var(--sun)" />
          </motion.g>

          <rect x="28" y="66" width="104" height="68" rx="26" fill="var(--sun)" />

          {/* Eyes: whites, then pupils that track the pointer, then blink */}
          <motion.g
            style={{ transformBox: "view-box", transformOrigin: `80px ${EYES.y}px` }}
            animate={{ scaleY: blinking ? 0.1 : 1 }}
            transition={{ duration: 0.08 }}
          >
            <circle cx={EYES.left} cy={EYES.y} r="14" fill="#FFFFFF" />
            <circle cx={EYES.right} cy={EYES.y} r="14" fill="#FFFFFF" />
            <motion.g style={{ x: pupilX, y: pupilY }}>
              <circle cx={EYES.left} cy={EYES.y} r="7.5" fill="var(--ink)" />
              <circle cx={EYES.right} cy={EYES.y} r="7.5" fill="var(--ink)" />
              <circle cx={EYES.left + 2.6} cy={EYES.y - 2.8} r="2.4" fill="#FFFFFF" />
              <circle cx={EYES.right + 2.6} cy={EYES.y - 2.8} r="2.4" fill="#FFFFFF" />
            </motion.g>
          </motion.g>

          {/* Cheeks */}
          <ellipse cx="44" cy="116" rx={happy ? 9 : 8} ry={happy ? 6 : 5} fill="var(--cheek)" />
          <ellipse cx="116" cy="116" rx={happy ? 9 : 8} ry={happy ? 6 : 5} fill="var(--cheek)" />

          {/* Mouth changes with mood */}
          {happy ? (
            <path d="M69 113Q80 130 91 113Z" fill="var(--ink)" stroke="var(--ink)" strokeWidth="2" strokeLinejoin="round" />
          ) : thinking ? (
            <ellipse cx="80" cy="118" rx="4" ry="3.6" fill="var(--ink)" />
          ) : (
            <path d="M71 115Q80 124 89 115" fill="none" stroke="var(--ink)" strokeWidth="3.5" strokeLinecap="round" />
          )}
        </motion.g>
      </motion.g>
    </svg>
  );
}
