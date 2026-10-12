"use client";

import clsx from "clsx";
import { useEffect, useId, useRef, useState } from "react";
import styles from "./babi.module.css";

export type BabiMood = "idle" | "thinking" | "happy" | "celebrate" | "sleepy" | "curious" | "sorry";

interface BabiProps {
  mood?: BabiMood;
  /** Wave hello when Babi appears: every time, or only on the first visit this session. */
  wave?: boolean | "first-visit";
  /** Doze off after a quiet spell, and wake up on any movement. */
  autoSleep?: boolean;
  /** Accessible description. Omit to mark Babi as decorative. */
  label?: string;
  className?: string;
}

const SLEEP_AFTER_MS = 25_000;
const PUPIL_TRAVEL = 4.5;

/**
 * Babi, the Babel mascot: a round peach speech bubble wearing a three-tier
 * tower hat. Eyes follow the pointer, blinks come at natural random
 * intervals, and each mood is a CSS state (see babi.module.css), so Babi
 * costs no animation library and respects reduced motion.
 */
export function Babi({ mood = "idle", wave = false, autoSleep = false, label, className }: BabiProps) {
  const ref = useRef<SVGSVGElement>(null);
  const [blink, setBlink] = useState(false);
  const [waving, setWaving] = useState(wave === true);
  const [asleep, setAsleep] = useState(false);
  const clipId = useId().replace(/:/g, "");

  // Eyes follow the pointer, written straight to CSS variables (no re-render).
  useEffect(() => {
    let frame = 0;
    let sleepTimer: ReturnType<typeof setTimeout> | undefined;
    const wake = () => {
      if (!autoSleep) return;
      setAsleep(false);
      clearTimeout(sleepTimer);
      sleepTimer = setTimeout(() => setAsleep(true), SLEEP_AFTER_MS);
    };
    const onMove = (event: PointerEvent) => {
      wake();
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const svg = ref.current;
        if (!svg) return;
        const rect = svg.getBoundingClientRect();
        const dx = event.clientX - (rect.left + rect.width / 2);
        const dy = event.clientY - (rect.top + rect.height * 0.6);
        const distance = Math.hypot(dx, dy) || 1;
        const reach = Math.min(1, distance / 260) * PUPIL_TRAVEL;
        svg.style.setProperty("--lx", ((dx / distance) * reach).toFixed(2));
        svg.style.setProperty("--ly", ((dy / distance) * reach).toFixed(2));
      });
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("keydown", wake, { passive: true });
    wake();
    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(sleepTimer);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("keydown", wake);
    };
  }, [autoSleep]);

  // Natural blinking: every 2.5-6s, now and then a quick double blink.
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let timer: ReturnType<typeof setTimeout>;
    const close = (then: () => void) => {
      setBlink(true);
      timer = setTimeout(() => {
        setBlink(false);
        then();
      }, 110);
    };
    const schedule = () => {
      timer = setTimeout(() => {
        close(() => {
          if (Math.random() < 0.18) timer = setTimeout(() => close(schedule), 160);
          else schedule();
        });
      }, 2500 + Math.random() * 3500);
    };
    schedule();
    return () => clearTimeout(timer);
  }, []);

  // The wave plays once, then the arm rests. "first-visit" waves only the
  // first time Babi appears in this browser session.
  useEffect(() => {
    if (!wave) return;
    const timers: ReturnType<typeof setTimeout>[] = [];
    timers.push(
      setTimeout(() => {
        if (wave === "first-visit") {
          try {
            if (sessionStorage.getItem("babel:waved")) return;
            sessionStorage.setItem("babel:waved", "1");
          } catch {
            // Storage blocked: wave anyway.
          }
          setWaving(true);
        }
        timers.push(setTimeout(() => setWaving(false), 1600));
      }, 400),
    );
    return () => timers.forEach(clearTimeout);
  }, [wave]);

  const shown: BabiMood | "wave" = mood === "idle" && asleep ? "sleepy" : mood === "idle" && waving ? "wave" : mood;

  return (
    <svg
      ref={ref}
      viewBox="0 0 200 212"
      className={clsx(styles.root, className)}
      data-mood={shown}
      data-blink={blink && shown !== "sleepy" ? "true" : undefined}
      data-wave={waving ? "true" : undefined}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
    >
      <defs>
        <clipPath id={`babi-body-${clipId}`}>
          <path d="M100 74C142 74 166 98 166 131C166 165 140 190 100 190C60 190 34 165 34 131C34 98 58 74 100 74Z" />
        </clipPath>
        <clipPath id={`babi-left-${clipId}`}>
          <rect x="0" y="0" width="100" height="212" />
        </clipPath>
      </defs>

      <ellipse className={styles.ground} cx="100" cy="201" rx="46" ry="6" fill="var(--babi-ground)" />

      <g className={styles.body}>
        {/* Feet */}
        <ellipse cx="80" cy="193" rx="13" ry="7" fill="var(--babi-shade)" />
        <ellipse cx="120" cy="193" rx="13" ry="7" fill="var(--babi-shade)" />

        {/* Arms sit behind the body so they read as stubby */}
        <ellipse cx="40" cy="146" rx="9" ry="13" transform="rotate(25 40 146)" fill="var(--babi-body)" />
        <g className={styles.arm}>
          <ellipse cx="160" cy="146" rx="9" ry="13" transform="rotate(-25 160 146)" fill="var(--babi-body)" />
        </g>

        {/* Body: a round speech bubble, no tail */}
        <path
          d="M100 74C142 74 166 98 166 131C166 165 140 190 100 190C60 190 34 165 34 131C34 98 58 74 100 74Z"
          fill="var(--babi-body)"
        />
        {/* Soft shading on the lower right, a highlight on the upper left */}
        <g clipPath={`url(#babi-body-${clipId})`}>
          {/* Crescent shading: shade everything, then lay the body back on, nudged up-left */}
          <rect x="30" y="70" width="140" height="124" fill="var(--babi-shade)" opacity="0.55" />
          <path
            d="M100 74C142 74 166 98 166 131C166 165 140 190 100 190C60 190 34 165 34 131C34 98 58 74 100 74Z"
            transform="translate(-9 -11)"
            fill="var(--babi-body)"
          />
          <ellipse cx="66" cy="98" rx="17" ry="8" transform="rotate(-30 66 98)" fill="var(--babi-highlight)" />
          <circle cx="86" cy="86" r="3" fill="var(--babi-highlight)" />
        </g>
        {/* Rim light: only visible in dark mode */}
        <path
          d="M100 74C142 74 166 98 166 131C166 165 140 190 100 190C60 190 34 165 34 131C34 98 58 74 100 74Z"
          fill="none"
          stroke="var(--babi-rim)"
          strokeWidth="2.5"
          clipPath={`url(#babi-left-${clipId})`}
        />

        {/* Three-tier tower hat: coral, sunflower, violet */}
        <g className={styles.hat}>
          <rect x="72" y="58" width="56" height="21" rx="9" fill="#FF6B4A" />
          <rect x="75" y="71" width="50" height="6" rx="3" fill="#2A1F4D" opacity="0.1" />
          <rect x="79" y="40" width="42" height="20" rx="9" fill="#FFC24B" />
          <rect x="82" y="52" width="36" height="6" rx="3" fill="#2A1F4D" opacity="0.08" />
          <rect x="86" y="23" width="28" height="19" rx="8" fill="#7B6CF6" />
          <rect x="90" y="27" width="10" height="3.5" rx="1.75" fill="#FFFFFF" opacity="0.5" />
        </g>

        {/* Face */}
        <g className={styles.look}>
          <g className={styles.eyes}>
            <ellipse cx="78" cy="128" rx="12" ry="14" fill="var(--babi-eye)" />
            <ellipse cx="122" cy="128" rx="12" ry="14" fill="var(--babi-eye)" />
            <circle cx="82.5" cy="122.5" r="4.4" fill="#FFFFFF" />
            <circle cx="126.5" cy="122.5" r="4.4" fill="#FFFFFF" />
            <circle cx="74.5" cy="133.5" r="2" fill="#FFFFFF" opacity="0.85" />
            <circle cx="118.5" cy="133.5" r="2" fill="#FFFFFF" opacity="0.85" />
          </g>
        </g>
        <g className={styles.lids}>
          {/* Eye-shaped upper halves, so half-closed eyes stay round */}
          <path d="M65 129A13 15 0 0 1 91 129Z" fill="var(--babi-body)" />
          <path d="M109 129A13 15 0 0 1 135 129Z" fill="var(--babi-body)" />
          <path d="M66 129h24M110 129h24" stroke="var(--babi-eye)" strokeWidth="3" strokeLinecap="round" />
        </g>
        <g className={styles.eyesHappy} fill="none" stroke="var(--babi-eye)" strokeWidth="5" strokeLinecap="round">
          <path d="M68 131Q78 117 88 131" />
          <path d="M112 131Q122 117 132 131" />
        </g>

        <ellipse className={styles.cheek} cx="58" cy="150" rx="11" ry="6.5" fill="var(--babi-cheek)" />
        <ellipse className={styles.cheek} cx="142" cy="150" rx="11" ry="6.5" fill="var(--babi-cheek)" />

        <path className={clsx(styles.mouth, styles.mouthSmile)} d="M90 152Q100 161 110 152" fill="none" stroke="var(--babi-eye)" strokeWidth="3.5" strokeLinecap="round" />
        <g className={clsx(styles.mouth, styles.mouthOpen)}>
          <path d="M88 150Q100 167 112 150Z" fill="var(--babi-eye)" stroke="var(--babi-eye)" strokeWidth="2" strokeLinejoin="round" />
          <ellipse cx="100" cy="158.5" rx="5.5" ry="2.6" fill="var(--babi-cheek)" />
        </g>
        <ellipse className={clsx(styles.mouth, styles.mouthO)} cx="100" cy="155" rx="4.5" ry="5" fill="var(--babi-eye)" />
        <path className={clsx(styles.mouth, styles.mouthSleepy)} d="M95 155Q100 158 105 155" fill="none" stroke="var(--babi-eye)" strokeWidth="3" strokeLinecap="round" />
        <path className={clsx(styles.mouth, styles.mouthSorry)} d="M91 158Q100 151 109 158" fill="none" stroke="var(--babi-eye)" strokeWidth="3.5" strokeLinecap="round" />
      </g>

      {/* Mood extras */}
      <g className={clsx(styles.extra, styles.dots)}>
        <rect x="140" y="30" width="44" height="24" rx="12" fill="var(--surface)" stroke="var(--border-strong)" strokeWidth="1.5" />
        <circle className={styles.dot} cx="152" cy="42" r="3" fill="var(--fg-2)" />
        <circle className={styles.dot} cx="162" cy="42" r="3" fill="var(--fg-2)" />
        <circle className={styles.dot} cx="172" cy="42" r="3" fill="var(--fg-2)" />
      </g>
      <g className={clsx(styles.extra, styles.zzz)} fill="var(--fg-3)" fontFamily="var(--font-display)" fontWeight="900">
        <text className={styles.z1} x="146" y="58" fontSize="18">z</text>
        <text className={styles.z2} x="160" y="40" fontSize="14">z</text>
      </g>
      <text className={clsx(styles.extra, styles.question)} x="150" y="66" fontSize="30" fontFamily="var(--font-display)" fontWeight="900" fill="#7B6CF6">
        ?
      </text>
      <path className={clsx(styles.extra, styles.sweat)} d="M154 92c4 6 6 9 6 12a6 6 0 0 1-12 0c0-3 2-6 6-12Z" fill="#7B6CF6" opacity="0.55" />
      <g>
        <path className={styles.sparkle} d="M34 70l3 8 8 3-8 3-3 8-3-8-8-3 8-3Z" fill="#FFC24B" />
        <path className={styles.sparkle} d="M170 76l2.5 6.5 6.5 2.5-6.5 2.5-2.5 6.5-2.5-6.5-6.5-2.5 6.5-2.5Z" fill="#FF6B4A" />
        <path className={styles.sparkle} d="M22 136l2 5 5 2-5 2-2 5-2-5-5-2 5-2Z" fill="#7B6CF6" />
        <path className={styles.sparkle} d="M180 140l2.5 6 6 2.5-6 2.5-2.5 6-2.5-6-6-2.5 6-2.5Z" fill="#FFC24B" />
      </g>
    </svg>
  );
}
