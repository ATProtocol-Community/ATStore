import * as stylex from "@stylexjs/stylex";
import { useState } from "react";

import { Lightbox } from "../../../design-system/lightbox";
import { animationDuration } from "../../../design-system/theme/animations.stylex";
import { uiColor } from "../../../design-system/theme/color.stylex";
import { breakpoints } from "../../../design-system/theme/media-queries.stylex";
import { shadow } from "../../../design-system/theme/shadow.stylex";

const styles = stylex.create({
  grid: {
    alignItems: "start",
    columnGap: { default: 8, [breakpoints.md]: 12 },
    display: "grid",
    gridTemplateColumns: {
      default: "repeat(2, minmax(0, 1fr))",
      [breakpoints.md]: "repeat(auto-fill, minmax(180px, 1fr))",
    },
    rowGap: { default: 8, [breakpoints.md]: 12 },
  },
  single: {
    gridTemplateColumns: "minmax(0, 520px)",
  },
  tile: {
    margin: 0,
    padding: 0,
    borderRadius: 14,
    borderWidth: 0,
    overflow: "hidden",
    backgroundColor: uiColor.bg,
    boxShadow: { default: shadow.none, ":hover": shadow.md },
    cursor: "zoom-in",
    display: "block",
    outlineColor: uiColor.text2,
    outlineOffset: 3,
    outlineStyle: { default: "none", ":focus-visible": "solid" },
    outlineWidth: 2,
    position: "relative",
    transform: { default: null, ":hover": "translateY(-2px)" },
    transitionDuration: animationDuration.slow,
    transitionProperty: "box-shadow, transform",
    width: "100%",
    // Hairline drawn over the image so light screenshots keep an edge.
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
    objectFit: "contain",
    height: "auto",
    maxHeight: 420,
    width: "100%",
  },
});

/**
 * Screenshots as a grid: each shot whole at its own aspect ratio, opening the
 * full-size lightbox on click.
 */
export function ScreenshotGallery({
  screenshots,
  name,
}: {
  screenshots: Array<string>;
  name: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [index, setIndex] = useState(0);
  // Bumped on every open so the lightbox remounts on the clicked shot.
  const [openCount, setOpenCount] = useState(0);

  return (
    <>
      <div
        {...stylex.props(
          styles.grid,
          screenshots.length === 1 && styles.single,
        )}
      >
        {screenshots.map((screenshot, i) => (
          <button
            key={`${screenshot}-${String(i)}`}
            type="button"
            aria-label={`Open screenshot ${String(i + 1)} of ${String(screenshots.length)}`}
            onClick={() => {
              setIndex(i);
              setOpenCount((count) => count + 1);
              setIsOpen(true);
            }}
            {...stylex.props(styles.tile)}
          >
            <img
              src={screenshot}
              alt={`${name} screenshot ${String(i + 1)}`}
              loading="lazy"
              decoding="async"
              {...stylex.props(styles.image)}
            />
          </button>
        ))}
      </div>
      <Lightbox
        key={openCount}
        isOpen={isOpen}
        onOpenChange={setIsOpen}
        images={screenshots}
        initialIndex={index}
        alt={`${name} screenshot`}
      />
    </>
  );
}
