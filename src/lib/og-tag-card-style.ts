import type { AppTagAccent } from "./app-tag-visuals";

/**
 * Concrete light-theme hex pulled from the matching `radix.stylex.tsx` token files.
 * Satori can't evaluate the design system's `light-dark()` CSS function, so we mirror the
 * values used by `AppTagCard`'s `softXxxSurface` (`linear-gradient(135deg, border2 → solid1)`
 * with `border1` as the outline).
 *
 * Foreground (`text`) colors target a dark, accent-tinted text that stays readable on the
 * light/medium-saturated surface — they're sourced from each palette's `text2` light value.
 *
 * If a token is updated in the design system, mirror it here. We deliberately pin to the light
 * theme: OG images render once, are cached, and have no concept of user color preference.
 */
export type OgTagCardPalette = {
  /** Outer border / outline color for the card. */
  border: string;
  /** Lighter end of the gradient (matches `border2` in stylex). */
  gradientStart: string;
  /** Saturated end of the gradient (matches `solid1` in stylex). */
  gradientEnd: string;
  /** Strong accent-tinted text color used for the title (sourced from `text2`). */
  text: string;
};

const PALETTE: Record<AppTagAccent, OgTagCardPalette> = {
  amber: {
    border: "#f3d673",
    gradientStart: "#e9c162",
    gradientEnd: "#ffc53d",
    text: "#4f3422",
  },
  blue: {
    border: "#acd8fc",
    gradientStart: "#8ec8f6",
    gradientEnd: "#0090ff",
    text: "#113264",
  },
  bronze: {
    border: "#dfcdc5",
    gradientStart: "#d3bcb3",
    gradientEnd: "#a18072",
    text: "#43302b",
  },
  crimson: {
    border: "#f3bed1",
    gradientStart: "#eaacc3",
    gradientEnd: "#e93d82",
    text: "#621639",
  },
  cyan: {
    border: "#9ddde7",
    gradientStart: "#7dcedc",
    gradientEnd: "#00a2c7",
    text: "#0d3c48",
  },
  grass: {
    border: "#b2ddb5",
    gradientStart: "#94ce9a",
    gradientEnd: "#46a758",
    text: "#203c25",
  },
  indigo: {
    border: "#c1d0ff",
    gradientStart: "#abbdf9",
    gradientEnd: "#3e63dd",
    text: "#1f2d5c",
  },
  iris: {
    border: "#cbcdff",
    gradientStart: "#b8baf8",
    gradientEnd: "#5b5bd6",
    text: "#272962",
  },
  jade: {
    border: "#acdec8",
    gradientStart: "#8bceb6",
    gradientEnd: "#29a383",
    text: "#1d3b31",
  },
  orange: {
    border: "#ffc182",
    gradientStart: "#f5ae73",
    gradientEnd: "#f76b15",
    text: "#582d1d",
  },
  pink: {
    border: "#efbfdd",
    gradientStart: "#e7acd0",
    gradientEnd: "#d6409f",
    text: "#651249",
  },
  plum: {
    border: "#e9c2ec",
    gradientStart: "#deade3",
    gradientEnd: "#ab4aba",
    text: "#53195d",
  },
  purple: {
    border: "#e0c4f4",
    gradientStart: "#d1afec",
    gradientEnd: "#8e4ec6",
    text: "#402060",
  },
  ruby: {
    border: "#f8bfc8",
    gradientStart: "#efacb8",
    gradientEnd: "#e54666",
    text: "#64172b",
  },
  sky: {
    border: "#a9daed",
    gradientStart: "#8dcae3",
    gradientEnd: "#7ce2fe",
    text: "#1d3e56",
  },
  teal: {
    border: "#a1ded2",
    gradientStart: "#83cdc1",
    gradientEnd: "#12a594",
    text: "#0d3d38",
  },
  tomato: {
    border: "#fdbdaf",
    gradientStart: "#f5a898",
    gradientEnd: "#e54d2e",
    text: "#5c271f",
  },
  violet: {
    border: "#d4cafe",
    gradientStart: "#c2b5f5",
    gradientEnd: "#6e56cf",
    text: "#2f265f",
  },
};

export function getOgTagCardPalette(accent: AppTagAccent): OgTagCardPalette {
  return PALETTE[accent];
}
