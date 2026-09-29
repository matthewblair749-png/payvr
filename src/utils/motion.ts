import { Easing, FadeInDown, LinearTransition } from 'react-native-reanimated';

/**
 * One motion feel for the whole app: fast at first, then a long gentle glide to rest.
 * No springs, no overshoot, no bounce.
 */
export const EASE = Easing.bezier(0.22, 1, 0.36, 1);
export const smooth = (duration = 260) => ({ duration, easing: EASE });

/**
 * Shared list motion. Items rise in with a short stagger (capped, so long lists don't wait),
 * and neighbors glide aside when an item is added or removed. Reanimated skips both when the
 * phone's Reduce Motion setting is on.
 */
export const listEnter = (index = 0) => FadeInDown.delay(Math.min(index, 8) * 40).duration(340).easing(EASE);
export const listLayout = LinearTransition.duration(280).easing(EASE);
