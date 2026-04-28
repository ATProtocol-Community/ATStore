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
  atNavbar: {
    color: blue.solid1,
    fontWeight: "bold",
  },
  atHero: {
    color: blue.solid1,
  },
  hero: {
    fontSize: fontSize["6xl"],
    fontWeight: fontWeight.black,
    fontFamily: fontFamily.sans,
  },
});

type AtStoreLogoProps = {
  variant?: "navbar" | "hero";
};

export function AtStoreLogo({ variant = "navbar" }: AtStoreLogoProps) {
  if (variant === "hero") {
    return (
      <span {...stylex.props(styles.hero)}>
        <span {...stylex.props(styles.atHero)}>AT</span>
        Store
      </span>
    );
  }

  return (
    <>
      <span {...stylex.props(styles.atNavbar)}>AT</span>
      Store
    </>
  );
}
