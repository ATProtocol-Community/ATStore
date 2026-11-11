import * as stylex from "@stylexjs/stylex";

import { green } from "./colors/green.stylex";
import { mauveInverted } from "./colors/mauve.stylex";
import { paper } from "./colors/paper.stylex";
import { pink } from "./colors/pink.stylex";
import { red } from "./colors/red.stylex";
import { yellow } from "./colors/yellow.stylex";

export const uiColor = stylex.defineVars({
  overlayBackdrop: "light-dark(rgba(25, 24, 22, 0.42), rgba(0, 0, 0, 0.7))",
  bg: paper.bg,
  bgSubtle: paper.bgSubtle,
  component1: paper.component1,
  component2: paper.component2,
  component3: paper.component3,
  border1: paper.border1,
  border2: paper.border2,
  border3: paper.border3,
  solid1: paper.solid1,
  solid2: paper.solid2,
  text1: paper.text1,
  text2: paper.text2,
  textContrast: "white",
});

export const uiInverted = stylex.defineVars({
  bg: mauveInverted.bg,
  bgSubtle: mauveInverted.bgSubtle,
  component1: mauveInverted.component1,
  component2: mauveInverted.component2,
  component3: mauveInverted.component3,
  border1: mauveInverted.border1,
  border2: mauveInverted.border2,
  border3: mauveInverted.border3,
  solid1: mauveInverted.solid1,
  solid2: mauveInverted.solid2,
  text1: mauveInverted.text1,
  text2: mauveInverted.text2,
  textContrast: "white",
});

export const primaryColor = stylex.defineVars({
  bg: pink.bg,
  bgSubtle: pink.bgSubtle,
  component1: pink.component1,
  component2: pink.component2,
  component3: pink.component3,
  border1: pink.border1,
  border2: pink.border2,
  border3: pink.border3,
  solid1: pink.solid1,
  solid2: pink.solid2,
  text1: pink.text1,
  text2: pink.text2,
  textContrast: "white",
});

export const criticalColor = stylex.defineVars({
  bg: red.bg,
  bgSubtle: red.bgSubtle,
  component1: red.component1,
  component2: red.component2,
  component3: red.component3,
  border1: red.border1,
  border2: red.border2,
  border3: red.border3,
  solid1: red.solid1,
  solid2: red.solid2,
  text1: red.text1,
  text2: red.text2,
  textContrast: "white",
});

export const warningColor = stylex.defineVars({
  bg: yellow.bg,
  bgSubtle: yellow.bgSubtle,
  component1: yellow.component1,
  component2: yellow.component2,
  component3: yellow.component3,
  border1: yellow.border1,
  border2: yellow.border2,
  border3: yellow.border3,
  solid1: yellow.solid1,
  solid2: yellow.solid2,
  text1: yellow.text1,
  text2: yellow.text2,
  textContrast: "black",
});

export const successColor = stylex.defineVars({
  bg: green.bg,
  bgSubtle: green.bgSubtle,
  component1: green.component1,
  component2: green.component2,
  component3: green.component3,
  border1: green.border1,
  border2: green.border2,
  border3: green.border3,
  solid1: green.solid1,
  solid2: green.solid2,
  text1: green.text1,
  text2: green.text2,
  textContrast: "white",
});
