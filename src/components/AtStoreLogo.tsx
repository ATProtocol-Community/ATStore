/**
 * AT Store wordmark. © Atproto Community Collective — see README (design vs
 * Apache-licensed source code).
 */
import * as stylex from "@stylexjs/stylex";

import { blue } from "../design-system/theme/colors/blue.stylex";
import {
  fontFamily,
  fontSize,
  fontWeight,
} from "../design-system/theme/typography.stylex";

const styles = stylex.create({
  root: {
    alignItems: "center",
    columnGap: "0.1em",
    display: "inline-flex",
  },
  atNavbar: {
    color: blue.solid1,
    fontWeight: "bold",
  },
  atHero: {
    color: blue.solid1,
  },
  hero: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize["6xl"],
    fontWeight: fontWeight.black,
    flexDirection: "column",
  },
  mark: {
    blockSize: "1.5em",
    flexShrink: 0,
    inlineSize: "1.5em",
  },
});

type AtStoreLogoProps = {
  variant?: "navbar" | "hero";
};

export function AtStoreLogo({ variant = "navbar" }: AtStoreLogoProps) {
  if (variant === "hero") {
    return (
      <span {...stylex.props(styles.root, styles.hero)}>
        <img src="/logo.svg" alt="" {...stylex.props(styles.mark)} />
        <span>
          <span {...stylex.props(styles.atHero)}>AT</span>
          Store
        </span>
      </span>
    );
  }

  return (
    <span {...stylex.props(styles.root)}>
      <img src="/logo.svg" alt="" {...stylex.props(styles.mark)} />
      <span>
        <span {...stylex.props(styles.atNavbar)}>AT</span>
        Store
      </span>
    </span>
  );
}
