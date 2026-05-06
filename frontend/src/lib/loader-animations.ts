/** Public `/assets/*.webm` clips (paths URL-encoded for spaces). */
export const LOADER_SRC_MEDITATING_BRAIN = "/assets/Meditating%20Brain.webm" as const;
export const LOADER_SRC_MEDITATING_MONK = "/assets/Meditating%20Monk.webm" as const;

export const LOADER_ANIMATION_URLS = [
  "/assets/Relaxing.webm",
  LOADER_SRC_MEDITATING_BRAIN,
  LOADER_SRC_MEDITATING_MONK,
  "/assets/Yoga%20Se%20Hi%20hoga.webm",
  "/assets/Yoga%20Relax.webm",
  "/assets/Meditation.webm",
] as const;

export function pickRandomLoaderSrc(): string {
  const list = LOADER_ANIMATION_URLS;
  return list[Math.floor(Math.random() * list.length)]!;
}
