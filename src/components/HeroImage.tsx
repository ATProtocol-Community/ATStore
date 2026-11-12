import * as stylex from "@stylexjs/stylex";

import { uiColor } from "../design-system/theme/color.stylex";
import { breakpoints } from "../design-system/theme/media-queries.stylex";
import { shadow } from "../design-system/theme/shadow.stylex";

interface HeroImageProps {
  src: string;
  alt: string;
  /** `wide` is the 16:7 listing-page frame (16:9 on phones); `fill` covers its parent. */
  layout?: "wide" | "fill";
  style?: stylex.StyleXStyles;
}

const styles = stylex.create({
  frame: {
    borderRadius: { default: 16, [breakpoints.md]: 24 },
    overflow: "hidden",
    aspectRatio: { default: "16 / 9", [breakpoints.md]: "16 / 7" },
    backgroundColor: uiColor.component1,
    boxShadow: shadow.md,
    position: "relative",
    // Hairline over the image so light heroes keep an edge on paper.
    "::after": {
      inset: 0,
      borderRadius: "inherit",
      boxShadow: `inset 0 0 0 1px ${uiColor.border1}`,
      content: "''",
      pointerEvents: "none",
      position: "absolute",
    },
  },
  fill: {
    inset: 0,
    aspectRatio: "auto",
    position: "absolute",
  },
  image: {
    display: "block",
    objectFit: "cover",
    height: "100%",
    width: "100%",
  },
});

/** A listing's hero image in a single wide frame. */
export function HeroImage({
  src,
  alt,
  layout = "wide",
  style,
  transitionName,
}: HeroImageProps & { transitionName?: string }) {
  const sx = stylex.props(
    styles.frame,
    layout === "fill" && styles.fill,
    style,
  );
  return (
    <div
      {...sx}
      // Named only during a cover → hero morph (html[data-vt-hero], styles.css).
      data-hero-target={transitionName ? "" : undefined}
      style={
        transitionName
          ? ({
              ...sx.style,
              "--listing-hero-vt": transitionName,
            } as React.CSSProperties)
          : sx.style
      }
    >
      <img alt={alt} src={src} {...stylex.props(styles.image)} />
    </div>
  );
}
