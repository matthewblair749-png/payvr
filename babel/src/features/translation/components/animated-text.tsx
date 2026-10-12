/** Scripts written without spaces between words resolve per character. */
const NO_SPACES = new Set(["ja", "zh"]);

/**
 * The translation "resolving" in: each word rises into place on the shared
 * spring, staggered so the whole sentence lands in about 400ms however long
 * it is. Pure CSS (see .word-in in globals.css), so it costs no JavaScript
 * animation and turns into a plain fade under reduced motion.
 */
export function AnimatedText({ text, lang }: { text: string; lang: string }) {
  const tokens = NO_SPACES.has(lang) ? Array.from(text) : text.split(/(\s+)/);
  const words = tokens.filter((t) => !/^\s+$/.test(t)).length || 1;
  const stagger = `${Math.max(6, Math.min(22, Math.round(400 / words)))}ms`;

  let index = 0;
  return (
    <span style={{ ["--stagger" as string]: stagger }}>
      {tokens.map((token, i) =>
        /^\s+$/.test(token) ? (
          token
        ) : (
          <span key={i} className="word-in" style={{ ["--i" as string]: index++ }}>
            {token}
          </span>
        ),
      )}
    </span>
  );
}
