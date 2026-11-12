import * as stylex from "@stylexjs/stylex";
import { useState } from "react";

import { uiColor } from "../../design-system/theme/color.stylex";
import {
  fontFamily,
  fontWeight,
} from "../../design-system/theme/typography.stylex";

const styles = stylex.create({
  root: {
    overflow: "hidden",
    placeItems: "center",
    backgroundColor: uiColor.bg,
    display: "inline-grid",
    flexShrink: 0,
    position: "relative",
    // A hairline ring drawn over the image so white-edged icons don't melt
    // into the paper background.
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
    borderRadius: `${Math.round(size / 4.2)}px`,
    fontSize: `${Math.round(size / 2.3)}px`,
    height: `${size}px`,
    width: `${size}px`,
  }),
});

/**
 * A listing's app icon at a fixed pixel size. Falls back to the name's first
 * letter when there is no icon or the image fails to load (about 8% of icon
 * URLs 404 on the Bluesky CDN).
 */
export function ListingIcon({
  name,
  src,
  size,
  style,
  transitionName,
}: {
  name: string;
  src: string | null | undefined;
  size: number;
  style?: stylex.StyleXStyles;
  /** Static view-transition-name, for the listing header this icon morphs into. */
  transitionName?: string;
}) {
  // Remember which URL failed, so a new `src` gets a fresh attempt.
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const showImage = Boolean(src) && failedSrc !== src;

  const sx = stylex.props(
    styles.root,
    styles.size(size),
    !showImage && styles.fallback,
    style,
  );

  return (
    <span
      aria-hidden
      {...sx}
      style={
        transitionName
          ? { ...sx.style, viewTransitionName: transitionName }
          : sx.style
      }
    >
      {showImage ? (
        <img
          alt=""
          src={src ?? undefined}
          width={size}
          height={size}
          loading="lazy"
          decoding="async"
          onError={() => setFailedSrc(src ?? null)}
          {...stylex.props(styles.image)}
        />
      ) : (
        name.trim().slice(0, 1).toUpperCase()
      )}
    </span>
  );
}
