import * as stylex from "@stylexjs/stylex";
import { useState } from "react";

import { uiColor } from "../../../design-system/theme/color.stylex";
import {
  fontFamily,
  fontWeight,
} from "../../../design-system/theme/typography.stylex";

const styles = stylex.create({
  root: {
    borderRadius: "50%",
    overflow: "hidden",
    placeItems: "center",
    backgroundColor: uiColor.component2,
    display: "inline-grid",
    flexShrink: 0,
    position: "relative",
    "::after": {
      inset: 0,
      borderRadius: "inherit",
      boxShadow: `inset 0 0 0 1px ${uiColor.border1}`,
      content: "''",
      pointerEvents: "none",
      position: "absolute",
    },
  },
  image: {
    display: "block",
    objectFit: "cover",
    height: "100%",
    width: "100%",
  },
  fallback: {
    backgroundImage: "linear-gradient(160deg, #8b929c, #5d636c)",
    color: "white",
    fontFamily: fontFamily.title,
    fontWeight: fontWeight.bold,
    letterSpacing: "-0.011em",
  },
  size: (size: number) => ({
    fontSize: `${Math.round(size / 2.4)}px`,
    height: `${size}px`,
    width: `${size}px`,
  }),
});

/**
 * A person's round avatar at a fixed pixel size, with an initial fallback
 * when there is no image or it fails to load.
 */
export function PersonAvatar({
  name,
  src,
  size,
  style,
}: {
  name: string;
  src: string | null | undefined;
  size: number;
  style?: stylex.StyleXStyles;
}) {
  const [failed, setFailed] = useState(false);
  const showImage = Boolean(src) && !failed;

  return (
    <span
      aria-hidden
      {...stylex.props(
        styles.root,
        styles.size(size),
        !showImage && styles.fallback,
        style,
      )}
    >
      {showImage ? (
        <img
          alt=""
          src={src ?? undefined}
          width={size}
          height={size}
          loading="lazy"
          decoding="async"
          onError={() => setFailed(true)}
          {...stylex.props(styles.image)}
        />
      ) : (
        name.trim().replace(/^@/, "").slice(0, 1).toUpperCase() || "?"
      )}
    </span>
  );
}
