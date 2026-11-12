import * as stylex from "@stylexjs/stylex";

/**
 * Warm neutral scale for the Shelf look: paper-coloured page, near-white
 * surfaces, hairline rules and near-black ink. Same step names as the Radix
 * scales so it can back `uiColor` directly.
 *
 * Note the direction: `bg` is the raised surface (cards, header) and
 * `bgSubtle` is the page itself, matching how the layout already uses them.
 */
export const paper = stylex.defineVars({
  bg: "light-dark(#fffdf9, #1b1a17)",
  bgSubtle: "light-dark(#f6f4ef, #12110f)",
  component1: "light-dark(#f0ede6, #211f1c)",
  component2: "light-dark(#e9e5dc, #282623)",
  component3: "light-dark(#e1dcd1, #312e2a)",
  border1: "light-dark(#e7e2d8, #2a2825)",
  border2: "light-dark(#d6cfc1, #3a3732)",
  border3: "light-dark(#bdb5a5, #504b44)",
  solid1: "light-dark(#8d877b, #6f6b62)",
  solid2: "light-dark(#7f7a6f, #827d73)",
  text1: "light-dark(#6c675d, #9b968b)",
  text2: "light-dark(#191816, #f2efe8)",
});

/**
 * "Ink" accent: solid near-black (near-white in dark mode) used for primary
 * buttons, selected states, stars and links. Backs `primaryColor` at the root.
 */
export const ink = stylex.defineVars({
  bg: "light-dark(#fffdf9, #1b1a17)",
  bgSubtle: "light-dark(#f6f4ef, #12110f)",
  component1: "light-dark(#efece5, #23211e)",
  component2: "light-dark(#e6e2d8, #2c2a26)",
  component3: "light-dark(#dcd6ca, #36332e)",
  border1: "light-dark(#d6cfc1, #3a3732)",
  border2: "light-dark(#bdb5a5, #504b44)",
  border3: "light-dark(#191816, #f2efe8)",
  solid1: "light-dark(#191816, #f2efe8)",
  solid2: "light-dark(#33312d, #d9d5cc)",
  text1: "light-dark(#46433d, #c8c3b8)",
  text2: "light-dark(#191816, #f2efe8)",
  textContrast: "light-dark(#fffdf9, #12110f)",
});
