import type { LinkComponentProps } from "@tanstack/react-router";
import type { ReactNode } from "react";

import * as stylex from "@stylexjs/stylex";
import { Link as RouterLink } from "@tanstack/react-router";
import { ArrowRight, ArrowUpRight, ChevronRight } from "lucide-react";

import { animationDuration } from "../../../design-system/theme/animations.stylex";
import { uiColor } from "../../../design-system/theme/color.stylex";
import { breakpoints } from "../../../design-system/theme/media-queries.stylex";
import {
  fontFamily,
  fontWeight,
} from "../../../design-system/theme/typography.stylex";

const styles = stylex.create({
  crumbs: {
    margin: 0,
    padding: 0,
    listStyle: "none",
    alignItems: "center",
    color: uiColor.text1,
    columnGap: 6,
    display: "flex",
    flexWrap: "wrap",
    fontSize: 14,
    rowGap: 4,
    minWidth: 0,
  },
  crumb: {
    alignItems: "center",
    columnGap: 6,
    display: "inline-flex",
    minWidth: 0,
  },
  crumbLink: {
    borderRadius: 4,
    textDecoration: "none",
    color: {
      default: uiColor.text1,
      ":hover": uiColor.text2,
    },
    outlineColor: uiColor.text2,
    outlineOffset: 2,
    outlineStyle: { default: "none", ":focus-visible": "solid" },
    outlineWidth: 2,
    transitionDuration: animationDuration.default,
    transitionProperty: "color",
  },
  crumbCurrent: {
    overflow: "hidden",
    color: uiColor.text2,
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    maxWidth: "24ch",
  },
  heading: {
    margin: 0,
    color: uiColor.text2,
    fontFamily: fontFamily.title,
    fontSize: { default: 23, [breakpoints.md]: 26 },
    fontWeight: fontWeight.bold,
    letterSpacing: "-0.035em",
    lineHeight: 1.15,
  },
  headingCount: {
    color: uiColor.text1,
    fontFamily: fontFamily.sans,
    fontSize: 15,
    fontVariantNumeric: "tabular-nums",
    fontWeight: fontWeight.medium,
    letterSpacing: 0,
    marginLeft: 8,
  },
  headingRow: {
    alignItems: "baseline",
    columnGap: 16,
    display: "flex",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: 8,
    marginBottom: 18,
  },
  dl: {
    margin: 0,
  },
  row: {
    paddingBlock: 12,
    alignItems: "baseline",
    columnGap: 12,
    display: "grid",
    fontSize: 14,
    gridTemplateColumns: "96px minmax(0, 1fr)",
    rowGap: 12,
    borderTopColor: {
      default: uiColor.border1,
      ":first-child": uiColor.text2,
    },
    borderTopStyle: "solid",
    borderTopWidth: 1,
  },
  dt: {
    color: uiColor.text1,
  },
  dd: {
    margin: 0,
    alignItems: "center",
    color: uiColor.text2,
    columnGap: 6,
    display: "flex",
    flexWrap: "wrap",
    rowGap: 6,
    wordBreak: "break-word",
    minWidth: 0,
  },
  ddStack: {
    alignItems: "flex-start",
    flexDirection: "column",
    rowGap: 2,
  },
  link: {
    borderRadius: 2,
    color: uiColor.text2,
    outlineColor: uiColor.text2,
    outlineOffset: 2,
    outlineStyle: { default: "none", ":focus-visible": "solid" },
    outlineWidth: 2,
    textDecorationColor: {
      default: uiColor.border2,
      ":hover": uiColor.text2,
    },
    textDecorationLine: "underline",
    textUnderlineOffset: 3,
    transitionDuration: animationDuration.default,
    transitionProperty: "text-decoration-color",
  },
  mono: {
    fontFamily: fontFamily.mono,
    fontSize: 13,
  },
  pill: {
    borderColor: {
      default: uiColor.border1,
      ":hover": uiColor.border2,
    },
    borderRadius: 999,
    borderStyle: "solid",
    borderWidth: 1,
    paddingInline: 10,
    textDecoration: "none",
    alignItems: "center",
    backgroundColor: uiColor.bg,
    color: {
      default: uiColor.text1,
      ":hover": uiColor.text2,
    },
    display: "inline-flex",
    fontSize: 13,
    outlineColor: uiColor.text2,
    outlineOffset: 2,
    outlineStyle: { default: "none", ":focus-visible": "solid" },
    outlineWidth: 2,
    transitionDuration: animationDuration.default,
    transitionProperty: "border-color, color",
    whiteSpace: "nowrap",
    height: 26,
  },
  moreLink: {
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
    transitionDuration: animationDuration.default,
    transitionProperty: "color",
    whiteSpace: "nowrap",
  },
  smallLink: {
    textDecoration: "none",
    alignItems: "center",
    color: {
      default: uiColor.text1,
      ":hover": uiColor.text2,
    },
    columnGap: 4,
    display: "inline-flex",
    fontSize: 13,
    transitionDuration: animationDuration.default,
    transitionProperty: "color",
    marginTop: 4,
  },
});

/** Underlined inline link for definition-list values (in-app). */
export function DetailLink({
  children,
  mono = false,
  ...props
}: LinkComponentProps & { children: ReactNode; mono?: boolean }) {
  return (
    <RouterLink {...props} {...stylex.props(styles.link, mono && styles.mono)}>
      {children}
    </RouterLink>
  );
}

/** Underlined inline link to another site; opens in a new tab. */
export function DetailExternalLink({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      {...stylex.props(styles.link)}
    >
      {children}
    </a>
  );
}

/** Quiet "See all ↗" header link to another site. */
export function MoreExternalLink({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      {...stylex.props(styles.moreLink)}
    >
      {children}
      <ArrowUpRight size={15} aria-hidden />
    </a>
  );
}

/** Small hairline pill link (tags). */
export function PillLink({
  children,
  ...props
}: LinkComponentProps & { children: ReactNode }) {
  return (
    <RouterLink {...props} {...stylex.props(styles.pill)}>
      {children}
    </RouterLink>
  );
}

/** Quiet "Compatible apps →" follow-on link under a value. */
export function SmallArrowLink({
  children,
  ...props
}: LinkComponentProps & { children: ReactNode }) {
  return (
    <RouterLink {...props} {...stylex.props(styles.smallLink)}>
      {children}
      <ArrowRight size={13} aria-hidden />
    </RouterLink>
  );
}

/** Shelf breadcrumbs: quiet links separated by chevrons, current page in ink. */
export function Breadcrumbs({ children }: { children: ReactNode }) {
  return (
    <nav aria-label="Breadcrumb">
      <ol {...stylex.props(styles.crumbs)}>{children}</ol>
    </nav>
  );
}

export function Crumb({
  children,
  ...props
}: LinkComponentProps & { children: ReactNode }) {
  return (
    <li {...stylex.props(styles.crumb)}>
      <RouterLink {...props} {...stylex.props(styles.crumbLink)}>
        {children}
      </RouterLink>
      <ChevronRight size={14} aria-hidden />
    </li>
  );
}

export function CurrentCrumb({ children }: { children: ReactNode }) {
  return (
    <li {...stylex.props(styles.crumb)}>
      <span aria-current="page" {...stylex.props(styles.crumbCurrent)}>
        {children}
      </span>
    </li>
  );
}

/** Mid-weight heading for blocks inside a page (About, Screenshots, Reviews). */
export function BlockHeading({
  children,
  count,
  action,
  id,
  style,
}: {
  children: ReactNode;
  count?: number;
  action?: ReactNode;
  id?: string;
  style?: stylex.StyleXStyles;
}) {
  return (
    <div {...stylex.props(styles.headingRow, style)}>
      <h2 id={id} {...stylex.props(styles.heading)}>
        {children}
        {count == null ? null : (
          <span {...stylex.props(styles.headingCount)}>{count}</span>
        )}
      </h2>
      {action}
    </div>
  );
}

export function DetailList({ children }: { children: ReactNode }) {
  return <dl {...stylex.props(styles.dl)}>{children}</dl>;
}

/** One term/value row of a sidebar definition list. */
export function DetailRow({
  term,
  children,
  stack = false,
}: {
  term: ReactNode;
  children: ReactNode;
  /** Put each value on its own line. */
  stack?: boolean;
}) {
  return (
    <div {...stylex.props(styles.row)}>
      <dt {...stylex.props(styles.dt)}>{term}</dt>
      <dd {...stylex.props(styles.dd, stack && styles.ddStack)}>{children}</dd>
    </div>
  );
}
