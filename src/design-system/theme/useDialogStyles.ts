import * as stylex from "@stylexjs/stylex";
import { use } from "react";

import type { Size } from "../theme/types";

import { SizeContext } from "../context";
import {
  animationDuration,
  animationTimingFunction,
  animations,
} from "../theme/animations.stylex";
import { radius } from "../theme/radius.stylex";
import { shadow } from "../theme/shadow.stylex";
import { ui } from "./semantic-color.stylex";

const styles = stylex.create({
  overlay: {
    animationDuration: animationDuration.default,
    animationName: animations.fadeIn,
    animationTimingFunction: animationTimingFunction.easeIn,
    backdropFilter: "blur(2px)",
    backgroundColor: "light-dark(rgba(25, 24, 22, 0.4), rgba(0, 0, 0, 0.65))",
    opacity: {
      default: 1,
      ":is([data-exiting])": 0,
    },
    // Fixed to the viewport: backdropFilter makes this the containing block
    // for the fixed-position modal inside it, so a page-sized overlay would
    // center the modal on the top of the page, offscreen once scrolled.
    position: "fixed",
    transitionDuration: {
      ":is([data-exiting])": animationDuration.fast,
    },
    transitionProperty: "opacity",
    transitionTimingFunction: {
      default: animationTimingFunction.easeOut,
      ":is([data-exiting])": animationTimingFunction.easeIn,
    },
    zIndex: 100,
    height: "var(--visual-viewport-height)",
    left: 0,
    top: 0,
    width: "100vw",
  },
  modal: {
    borderRadius: radius["2xl"],
    outline: "none",
    overflow: "hidden",
    boxShadow: shadow["lg"],
    display: "flex",
    flexDirection: "column",
    position: "fixed",
    translate: "-50% -50%",
    left: "50%",
    maxHeight: "calc(var(--visual-viewport-height) * 0.8)",
    maxWidth: "90vw",
    top: "calc(var(--visual-viewport-height) / 2)",

    animationDuration: animationDuration.slow,
    animationName: {
      ":is([data-entering])": animations.zoomIn,
      ":is([data-exiting])": animations.zoomOut,
    },
    animationTimingFunction: animationTimingFunction.easeElasticInOut,
  },
  dialog: {
    outline: "none",
    flexGrow: 1,
    minHeight: 0,
  },
  size: (size: Size) => ({
    width: size === "sm" ? 400 : size === "md" ? 600 : 800,
  }),
});

export function useDialogStyles({ size: sizeProp }: { size?: Size }) {
  const size = sizeProp || use(SizeContext);

  return {
    overlay: styles.overlay,
    modal: [styles.modal, ui.bg, ui.text, ui.border, styles.size(size)],
    dialog: styles.dialog,
  };
}
