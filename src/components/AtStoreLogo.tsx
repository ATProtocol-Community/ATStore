/**
 * at-store wordmark (Shelf): "at·store" in the heavy display face with an
 * accent-blue interpunct. © Atproto Community Collective — see README
 * (design vs Apache-licensed source code).
 */
import * as stylex from "@stylexjs/stylex";

import { uiColor } from "../design-system/theme/color.stylex";
import { breakpoints } from "../design-system/theme/media-queries.stylex";
import {
  fontFamily,
  fontWeight,
} from "../design-system/theme/typography.stylex";

const styles = stylex.create({
  root: {
    alignItems: "center",
    color: uiColor.text2,
    display: "inline-flex",
    fontFamily: fontFamily.title,
    fontWeight: fontWeight.extrabold,
    letterSpacing: "-0.025em",
    lineHeight: 1,
    whiteSpace: "nowrap",
  },
  navbar: {
    fontSize: { default: 20, [breakpoints.md]: 21 },
  },
  footer: {
    fontSize: 19,
  },
  hero: {
    fontSize: 28,
  },
  dot: {
    marginInline: 1,
    color: "light-dark(#1c4ef5, #7b97ff)",
  },
});

type AtStoreLogoProps = {
  variant?: "navbar" | "footer" | "hero";
};

export function AtStoreLogo({ variant = "navbar" }: AtStoreLogoProps) {
  return (
    <span {...stylex.props(styles.root, styles[variant])}>
      at<span {...stylex.props(styles.dot)}>·</span>store
    </span>
  );
}
