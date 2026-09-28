/**
 * Lets the focused screen take over the raised Tap button in the tab bar. Home registers
 * a handler so Tap uses the amount already typed on its keypad; everywhere else Tap opens
 * the amount screen.
 */
type Handler = () => boolean;
let current: Handler | null = null;

export function setTapHandler(h: Handler | null) {
  current = h;
  return () => {
    if (current === h) current = null;
  };
}

/** True when the focused screen handled the press. */
export function runTapHandler() {
  return current ? current() : false;
}
