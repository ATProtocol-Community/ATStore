import * as stylex from "@stylexjs/stylex";

import { animationDuration } from "../design-system/theme/animations.stylex";
import { uiColor } from "../design-system/theme/color.stylex";
import { radius } from "../design-system/theme/radius.stylex";

interface HeroImageProps {
  src: string;
  alt: string;
  glowIntensity?: number;
  layout?: "aspect16x9" | "fill";
  showOverlay?: boolean;
}

const DEFAULT_HERO_GLOW_INTENSITY = 1;

const styles = stylex.create({
  glowWrap: {
    position: "relative",
  },
  glowWrapFill: {
    inset: 0,
    position: "absolute",
    height: "100%",
    width: "100%",
  },
  glowImage: {
    inset: 0,
    borderRadius: radius["lg"],
    objectFit: "cover",
    pointerEvents: "none",
    position: "absolute",
    transformOrigin: "center",
    zIndex: 0,
    width: "100%",
  },
  frame: {
    borderRadius: radius["3xl"],
    cornerShape: "squircle",
    overflow: "hidden",
    position: "relative",
    zIndex: 1,
  },
  image: {
    aspectRatio: "16 / 9",
    display: "block",
    objectFit: "cover",
    transform: {
      default: "scale(1)",
      [stylex.when.ancestor(":hover")]: "scale(1.01)",
    },
    transitionDuration: animationDuration.slow,
    transitionProperty: "transform",
    transitionTimingFunction: "ease-in-out",
    width: "100%",
  },
  imageFill: {
    inset: 0,
    display: "block",
    objectFit: "cover",
    position: "absolute",
    transform: {
      default: "scale(1)",
      [stylex.when.ancestor(":hover")]: "scale(1.01)",
    },
    transitionDuration: animationDuration.slow,
    transitionProperty: "transform",
    transitionTimingFunction: "ease-in-out",
    height: "100%",
    width: "100%",
  },
  overlay: {
    background: `linear-gradient(180deg, color-mix(in srgb, ${uiColor.overlayBackdrop} 6%, transparent) 0%, color-mix(in srgb, ${uiColor.overlayBackdrop} 24%, transparent) 38%, color-mix(in srgb, ${uiColor.overlayBackdrop} 92%, transparent) 100%)`,
    inset: 0,
    position: "absolute",
  },
});

export function HeroImage({
  src,
  alt,
  glowIntensity = DEFAULT_HERO_GLOW_INTENSITY,
  layout = "aspect16x9",
  showOverlay = true,
}: HeroImageProps) {
  const normalizedGlowIntensity = Math.max(0, glowIntensity);
  const useFillLayout = layout === "fill";

  return (
    <div
      {...stylex.props(styles.glowWrap, useFillLayout && styles.glowWrapFill)}
    >
      {normalizedGlowIntensity > 0 ? (
        <img
          alt=""
          aria-hidden
          src={src}
          style={{
            willChange: "filter",
            filter: `blur(${36 * normalizedGlowIntensity}px) saturate(${1 + 0.25 * normalizedGlowIntensity})`,
            opacity: Math.min(0.9, 0.72 * normalizedGlowIntensity),
            transform: `scale(${1 + 0.05 * normalizedGlowIntensity})`,
          }}
          {...stylex.props(styles.glowImage)}
        />
      ) : null}
      <div {...stylex.props(styles.frame, useFillLayout && styles.glowWrap)}>
        <img
          alt={alt}
          src={src}
          {...stylex.props(useFillLayout ? styles.imageFill : styles.image)}
        />
        {showOverlay ? <div {...stylex.props(styles.overlay)} /> : null}
      </div>
    </div>
  );
}
