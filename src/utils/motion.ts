import { FadeInDown, LinearTransition } from 'react-native-reanimated';

/**
 * Shared list motion. Items rise in with a short stagger (capped, so long lists don't wait),
 * and neighbors glide aside when an item is added or removed. Reanimated skips both when the
 * phone's Reduce Motion setting is on.
 */
export const listEnter = (index = 0) => FadeInDown.delay(Math.min(index, 8) * 40).duration(320);
export const listLayout = LinearTransition.springify().damping(20).stiffness(220);
