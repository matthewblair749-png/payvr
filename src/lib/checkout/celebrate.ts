/**
 * Post-payment feedback: a short haptic tap and an optional two-note chime.
 * Both are opt-in per checkout (payment block settings), skipped when the
 * buyer prefers reduced motion, and fail silently where unsupported.
 */
type PaymentProps = { haptics: boolean; sound: boolean };

export function celebrate(props: PaymentProps | undefined) {
  if (!props || typeof window === "undefined") return;
  const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

  if (props.haptics && !reduced && "vibrate" in navigator) {
    try {
      navigator.vibrate([14, 60, 22]);
    } catch {
      /* unsupported */
    }
  }

  if (props.sound) {
    try {
      // The Pay click is a user gesture, so an AudioContext is allowed here.
      const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctx) return;
      const ctx = new Ctx();
      const now = ctx.currentTime;
      // Two soft sine notes (E5 → B5): bright, short, not startling.
      [659.25, 987.77].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.value = freq;
        const t = now + i * 0.11;
        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(0.12, t + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
        osc.connect(gain).connect(ctx.destination);
        osc.start(t);
        osc.stop(t + 0.4);
      });
      setTimeout(() => void ctx.close(), 800);
    } catch {
      /* audio unavailable */
    }
  }
}
