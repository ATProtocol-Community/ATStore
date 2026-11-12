import * as stylex from "@stylexjs/stylex";
import { Link as RouterLink } from "@tanstack/react-router";

import { animationDuration } from "../design-system/theme/animations.stylex";
import { uiColor } from "../design-system/theme/color.stylex";
import { breakpoints } from "../design-system/theme/media-queries.stylex";
import { fontWeight } from "../design-system/theme/typography.stylex";
import { AtStoreLogo } from "./AtStoreLogo";

const FOOTER_LINK_GROUPS = [
  {
    title: "Apps",
    links: [
      { href: "/apps", label: "Browse apps" },
      { href: "/apps/tags", label: "Tags" },
      { href: "/apps/lexicons", label: "Shared data" },
      { href: "/games", label: "Games" },
    ],
  },
  {
    title: "Makers",
    links: [
      { href: "/products/create", label: "Submit an app" },
      { href: "/product/claim", label: "Claim a listing" },
      { href: "/products/manage", label: "Manage listings" },
      { href: "/developers/atproto", label: "Developer API" },
    ],
  },
  {
    title: "at-store",
    links: [
      { href: "/about", label: "About" },
      { href: "/", label: "Home" },
    ],
  },
] as const;

const styles = stylex.create({
  footer: {
    color: uiColor.text1,
    fontSize: 14,
    borderTopColor: uiColor.border1,
    borderTopStyle: "solid",
    borderTopWidth: 1,
  },
  inner: {
    marginInline: "auto",
    paddingInline: { default: 20, [breakpoints.sm]: 40 },
    boxSizing: "border-box",
    maxWidth: "var(--page-content-max-width)",
    paddingBottom: 24,
    paddingTop: 56,
  },
  grid: {
    columnGap: 32,
    display: "grid",
    gridTemplateColumns: {
      default: "1fr 1fr",
      [breakpoints.md]: "1.6fr repeat(3, 1fr)",
    },
    rowGap: 32,
  },
  brand: {
    gridColumn: { default: "1 / -1", [breakpoints.md]: "auto" },
  },
  blurb: {
    lineHeight: 1.5,
    marginBottom: 0,
    marginTop: 12,
    maxWidth: "22em",
  },
  heading: {
    margin: 0,
    color: uiColor.text2,
    fontSize: 13,
    fontWeight: fontWeight.semibold,
    marginBottom: 12,
  },
  link: {
    paddingBlock: 4,
    textDecoration: "none",
    color: { default: uiColor.text1, ":hover": uiColor.text2 },
    display: "block",
    transitionDuration: animationDuration.default,
    transitionProperty: "color",
  },
  bottom: {
    display: "flex",
    fontSize: 13,
    justifyContent: "space-between",
    borderTopColor: uiColor.border1,
    borderTopStyle: "solid",
    borderTopWidth: 1,
    marginTop: 48,
    paddingTop: 20,
  },
});

export function SiteFooter() {
  return (
    <footer {...stylex.props(styles.footer)}>
      <div {...stylex.props(styles.inner)}>
        <div {...stylex.props(styles.grid)}>
          <div {...stylex.props(styles.brand)}>
            <AtStoreLogo variant="footer" />
            <p {...stylex.props(styles.blurb)}>
              An open directory of Atmosphere apps. Listings are records in
              their makers&apos; own repos.
            </p>
          </div>
          {FOOTER_LINK_GROUPS.map((group) => (
            <nav key={group.title} aria-label={group.title}>
              <h2 {...stylex.props(styles.heading)}>{group.title}</h2>
              {group.links.map((link) => (
                <RouterLink
                  key={link.href}
                  to={link.href as never}
                  {...stylex.props(styles.link)}
                >
                  {link.label}
                </RouterLink>
              ))}
            </nav>
          ))}
        </div>
        <div {...stylex.props(styles.bottom)}>
          <span>
            © {new Date().getFullYear()} at-store · Built on the AT Protocol
          </span>
        </div>
      </div>
    </footer>
  );
}
