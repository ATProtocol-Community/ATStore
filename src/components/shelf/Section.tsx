import type { LinkComponentProps } from "@tanstack/react-router";
import type { ReactNode } from "react";

import * as stylex from "@stylexjs/stylex";
import { Link as RouterLink } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight } from "lucide-react";

import { animationDuration } from "../../design-system/theme/animations.stylex";
import { uiColor } from "../../design-system/theme/color.stylex";
import { breakpoints } from "../../design-system/theme/media-queries.stylex";
import {
  fontFamily,
  fontWeight,
} from "../../design-system/theme/typography.stylex";

const styles = stylex.create({
  section: {
    paddingBlock: { default: 44, [breakpoints.md]: 72 },
    borderTopColor: uiColor.border1,
    borderTopStyle: "solid",
    borderTopWidth: 1,
  },
  flush: {
    borderTopWidth: 0,
    paddingTop: 0,
  },
  header: {
    alignItems: "baseline",
    columnGap: 24,
    display: "flex",
    justifyContent: "space-between",
    rowGap: 24,
    marginBottom: { default: 18, [breakpoints.md]: 28 },
  },
  title: {
    margin: 0,
    color: uiColor.text2,
    fontFamily: fontFamily.title,
    fontSize: { default: 26, [breakpoints.md]: 34 },
    fontWeight: fontWeight.bold,
    letterSpacing: "-0.022em",
    lineHeight: 1.1,
  },
  description: {
    color: uiColor.text1,
    lineHeight: 1.5,
    marginBottom: 0,
    marginTop: 8,
    maxWidth: "38em",
  },
  link: {
    textDecoration: "none",
    alignItems: "center",
    color: {
      default: uiColor.text1,
      ":hover": uiColor.text2,
    },
    columnGap: 4,
    display: "inline-flex",
    flexShrink: 0,
    fontSize: 15,
    rowGap: 4,
    transitionDuration: animationDuration.default,
    transitionProperty: "color",
    whiteSpace: "nowrap",
  },
  arrow: {
    transform: {
      default: null,
      [stylex.when.ancestor(":hover")]: "translateX(2px)",
    },
    transitionDuration: animationDuration.default,
    transitionProperty: "transform",
  },
  arrowBack: {
    transform: {
      default: null,
      [stylex.when.ancestor(":hover")]: "translateX(-2px)",
    },
    transitionDuration: animationDuration.default,
    transitionProperty: "transform",
  },
  hero: {
    paddingBottom: { default: 24, [breakpoints.md]: 36 },
    paddingTop: { default: 28, [breakpoints.md]: 48 },
  },
  heroRow: {
    gap: { default: 20, [breakpoints.md]: 32 },
    alignItems: { default: "flex-start", [breakpoints.md]: "flex-end" },
    display: "flex",
    flexDirection: { default: "column", [breakpoints.md]: "row" },
    justifyContent: "space-between",
  },
  eyebrow: {
    color: uiColor.text1,
    fontSize: 12,
    fontWeight: fontWeight.semibold,
    letterSpacing: "0.12em",
    textTransform: "uppercase",
    marginBottom: 14,
  },
  heroTitle: {
    margin: 0,
    color: uiColor.text2,
    fontFamily: fontFamily.title,
    fontSize: { default: 38, [breakpoints.md]: 56 },
    fontWeight: fontWeight.bold,
    letterSpacing: "-0.028em",
    lineHeight: 1,
    textWrap: "balance",
  },
  heroDescription: {
    color: uiColor.text1,
    fontSize: { default: 16, [breakpoints.md]: 18 },
    lineHeight: 1.5,
    textWrap: "pretty",
    marginBottom: 0,
    marginTop: 16,
    maxWidth: "40em",
  },
  back: {
    marginBottom: 12,
  },
});

/** A page band with a hairline on top: the basic rhythm of every Shelf page. */
export function ShelfSection({
  children,
  flush = false,
  id,
  style,
}: {
  children: ReactNode;
  /** No top rule or top padding (first section under a hero). */
  flush?: boolean;
  id?: string;
  style?: stylex.StyleXStyles;
}) {
  return (
    <section
      id={id}
      {...stylex.props(styles.section, flush && styles.flush, style)}
    >
      {children}
    </section>
  );
}

export function SectionHeader({
  title,
  description,
  action,
  headingLevel = 2,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  headingLevel?: 2 | 3;
}) {
  const Heading = headingLevel === 2 ? "h2" : "h3";
  return (
    <div {...stylex.props(styles.header)}>
      <div>
        <Heading {...stylex.props(styles.title)}>{title}</Heading>
        {description ? (
          <p {...stylex.props(styles.description)}>{description}</p>
        ) : null}
      </div>
      {action}
    </div>
  );
}

/** Quiet "See all →" style link for section headers. */
export function MoreLink({
  children,
  ...props
}: LinkComponentProps & { children: ReactNode }) {
  return (
    <RouterLink {...props} {...stylex.props(styles.link)}>
      {children}
      <ArrowRight size={15} aria-hidden {...stylex.props(styles.arrow)} />
    </RouterLink>
  );
}

export function BackLink({
  children,
  ...props
}: LinkComponentProps & { children: ReactNode }) {
  return (
    <RouterLink {...props} {...stylex.props(styles.link, styles.back)}>
      <ArrowLeft size={15} aria-hidden {...stylex.props(styles.arrowBack)} />
      {children}
    </RouterLink>
  );
}

/** Page heading block: optional back link and eyebrow, big title, lede, and a side slot. */
export function PageHero({
  eyebrow,
  title,
  description,
  aside,
  back,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  aside?: ReactNode;
  back?: ReactNode;
}) {
  return (
    <div {...stylex.props(styles.hero)}>
      {back}
      <div {...stylex.props(styles.heroRow)}>
        <div>
          {eyebrow ? (
            <div {...stylex.props(styles.eyebrow)}>{eyebrow}</div>
          ) : null}
          <h1 {...stylex.props(styles.heroTitle)}>{title}</h1>
          {description ? (
            <p {...stylex.props(styles.heroDescription)}>{description}</p>
          ) : null}
        </div>
        {aside}
      </div>
    </div>
  );
}
