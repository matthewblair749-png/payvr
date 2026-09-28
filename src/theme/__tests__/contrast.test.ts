/// <reference types="node" />
// WCAG contrast for every foreground/background pairing the app uses, in both themes.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { AvatarTints } from '../avatar-tints.ts';
import { Colors, type Palette } from '../colors.ts';

function luminance(hex: string) {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrast(a: string, b: string) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

type Key = keyof Palette;
/** [foreground, background, minimum ratio, what it's used for] */
const PAIRS: [Key, Key, number, string][] = [
  ['text', 'background', 4.5, 'body text'],
  ['text', 'surface', 4.5, 'text on cards'],
  ['textSecondary', 'background', 4.5, 'secondary text'],
  ['textSecondary', 'surface', 4.5, 'secondary text on cards'],
  ['accent', 'background', 4.5, 'blue links / labels'],
  ['accent', 'surface', 4.5, 'blue labels on cards'],
  ['successText', 'background', 4.5, 'small green amounts'],
  ['successText', 'surface', 4.5, 'green amounts on cards'],
  ['success', 'background', 3, 'large green amounts + checkmark (large text / graphics)'],
  ['error', 'background', 4.5, 'error messages'],
  ['error', 'surface', 4.5, 'errors on cards'],
  ['onPrimary', 'primary', 4.5, 'white text on blue buttons'],
  ['primary', 'background', 3, 'blue button against the page (UI component)'],
];

for (const scheme of ['dark', 'light'] as const) {
  test(`${scheme} theme meets WCAG AA contrast`, () => {
    const p = Colors[scheme];
    const failures = PAIRS.filter(([fg, bg, min]) => contrast(p[fg], p[bg]) < min).map(
      ([fg, bg, min, use]) => `${fg} on ${bg} = ${contrast(p[fg], p[bg]).toFixed(2)} (< ${min}) — ${use}`,
    );
    assert.deepEqual(failures, []);
  });
}

test('avatar initials are readable on every tint, in both themes', () => {
  const bad = (['dark', 'light'] as const).flatMap((s) =>
    AvatarTints[s].filter((t) => contrast(t.fg, t.bg) < 4.5).map((t) => `${s} ${t.fg} on ${t.bg} = ${contrast(t.fg, t.bg).toFixed(2)}`),
  );
  assert.deepEqual(bad, []);
});

test('the spec’s #16A34A would fail as small text on white (why successText exists)', () => {
  assert.ok(contrast('#16A34A', '#FFFFFF') < 4.5);
  assert.ok(contrast(Colors.light.successText, '#FFFFFF') >= 4.5);
});
