import * as stylex from "@stylexjs/stylex";
import { useSuspenseQuery } from "@tanstack/react-query";
import {
  Link as RouterLink,
  createFileRoute,
  createLink,
} from "@tanstack/react-router";
import { useMemo, useState } from "react";

import { Page } from "../design-system/page";
import { blue } from "../design-system/theme/colors/blue.stylex";
import { uiColor } from "../design-system/theme/color.stylex";
import { breakpoints } from "../design-system/theme/media-queries.stylex";
import { radius } from "../design-system/theme/radius.stylex";
import {
  gap,
  horizontalSpace,
  size,
  verticalSpace,
} from "../design-system/theme/semantic-spacing.stylex";
import { shadow } from "../design-system/theme/shadow.stylex";
import {
  fontFamily,
  fontSize,
  fontWeight,
  lineHeight,
  tracking,
} from "../design-system/theme/typography.stylex";
import {
  Globe,
  Layers3,
  ShieldCheck,
  Sparkles,
  UserRound,
  Wrench,
} from "lucide-react";
import { HeaderLayout } from "#/design-system/header-layout";
import { SiteHeader } from "#/components/SiteHeader";
import { SiteFooter } from "#/components/SiteFooter";
import { FeaturedListingGrid } from "#/components/FeaturedListingGrid";
import { Flex } from "#/design-system/flex";
import { Avatar } from "#/design-system/avatar";
import { Card } from "#/design-system/card";
import {
  directoryListingApi,
  type DirectoryListingCard,
} from "#/integrations/tanstack-query/api-directory-listings.functions";
import { formatAppTagLabel } from "#/lib/app-tag-metadata";
import { getListingsForCategoryBranch } from "#/lib/ecosystem-listings";
import { getDirectoryListingSlug } from "#/lib/directory-listing-slugs";
import { getHomePageHeroArtSpec } from "#/lib/home-page-hero-art";
import { buildRouteOgMeta } from "#/lib/og-meta";
import { Body, SmallBody } from "#/design-system/typography";
import { useHover } from "react-aria";
import { StarRating } from "#/design-system/star-rating";
import { Button } from "#/design-system/button";

const ButtonLink = createLink(Button);

export const Route = createFileRoute("/")({
  loader: async ({ context }) => {
    const ecosystemData = await context.queryClient.ensureQueryData(
      directoryListingApi.getDirectoryCategoryPageQueryOptions({
        categoryId: BLUESKY_ECOSYSTEM_CATEGORY_ID,
      }),
    );

    return {
      preloadHeroImages: getGroupHeroPreloadImagesFromEcosystem(
        ecosystemData?.listings ?? [],
      ),
    };
  },
  head: ({ loaderData }) => ({
    ...buildRouteOgMeta({
      title: "at-store | The Atmosphere",
      description:
        "Discover apps and tools across the Atmosphere, with open identity and portable data.",
      image:
        getHomePageHeroArtSpec("home-og")?.assetPath ??
        loaderData?.preloadHeroImages?.[0] ??
        null,
    }),
    links: (loaderData?.preloadHeroImages ?? []).map((href) => ({
      rel: "preload",
      as: "image",
      href,
    })),
  }),
  component: RouteComponent,
});

const ACCOUNT_TAGS = [
  "Social",
  "Photos",
  "Blog",
  "Music",
  "Video",
  "Events",
  "+ more",
] as const;
const INTRO_FEATURES = [
  {
    title: "Open Network",
    subtitle: "Shared social graph and data.",
    icon: Globe,
  },
  {
    title: "Shared Foundation",
    subtitle: "Build once, usable everywhere.",
    icon: Layers3,
  },
  {
    title: "One Account",
    subtitle: "One identity across all apps.",
    icon: UserRound,
  },
  {
    title: "Always Yours",
    subtitle: "Portable and owned by you.",
    icon: ShieldCheck,
  },
] as const;

const DATA_CONTROL = [
  {
    title: "Portability",
    body: "Self host, use an app's PDS, or use a third-party provider. Wherever you choose to host your account, your identity and data are portable.",
    icon: ShieldCheck,
  },
  {
    title: "Interoperability",
    body: "Since all apps share a common foundation, they can easily share data — unlocking new possibilities that aren't easy with traditional app ecosystems.",
    icon: Layers3,
  },
  {
    title: "Anyone Can Build",
    body: "Developers can build new apps on the Atmosphere and tap into an existing network from day one. No chicken-and-egg problem.",
    icon: Wrench,
  },
] as const;
const MAX_BROWSER_TAGS = 8;
const MAX_BROWSER_APPS = 12;
const BLUESKY_ECOSYSTEM_CATEGORY_ID = "apps/bluesky";

const styles = stylex.create({
  grow: {
    flexGrow: 1,
    flexShrink: 0,
    flexBasis: 0,
  },
  page: {
    backgroundColor: uiColor.bg,
  },
  shell: {
    fontFamily: fontFamily.sans,
  },
  topNav: {
    alignItems: "center",
    display: "flex",
    justifyContent: "space-between",
    marginBottom: verticalSpace["8xl"],
  },
  logo: {
    alignItems: "center",
    color: uiColor.text2,
    display: "flex",
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    gap: gap.md,
  },
  logoDot: {
    backgroundColor: blue.solid1,
    borderRadius: radius.full,
    height: size.xs,
    width: size.xs,
  },
  navList: {
    display: "flex",
    gap: gap["4xl"],
  },
  navItem: {
    color: uiColor.text1,
    fontSize: fontSize.sm,
  },
  navCta: {
    color: blue.text1,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
  },
  hero: {
    alignItems: "center",
    display: "flex",
    flexDirection: "column",
    gap: gap["4xl"],
    marginBottom: verticalSpace["8xl"],
    marginTop: verticalSpace["11xl"],
    textAlign: "center",
  },
  eyebrow: {
    alignItems: "center",
    display: "flex",
    gap: gap.sm,
    backgroundColor: blue.bgSubtle,
    borderColor: blue.border1,
    borderStyle: "solid",
    borderWidth: 1,
    borderRadius: radius.full,
    color: blue.text1,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    fontFamily: fontFamily.sans,
    paddingTop: verticalSpace.md,
    paddingBottom: verticalSpace.md,
    paddingLeft: horizontalSpace.xl,
    paddingRight: horizontalSpace.xl,
  },
  h1: {
    color: uiColor.text2,
    fontFamily: fontFamily.title,
    fontSize: {
      default: fontSize["5xl"],
      [breakpoints.md]: fontSize["6xl"],
      [breakpoints.lg]: fontSize["7xl"],
    },
    fontWeight: fontWeight.bold,
    letterSpacing: tracking.tight,
    lineHeight: lineHeight.sm,
    margin: 0,
  },
  h1Accent: {
    color: blue.text1,
  },
  heroBody: {
    color: uiColor.text1,
    fontFamily: fontFamily.sans,
    fontSize: fontSize["2xl"],
    lineHeight: lineHeight.base,
    margin: 0,
  },
  heroButtons: {
    display: "flex",
    gap: gap.md,
    paddingTop: verticalSpace.xl,
  },
  buttonPrimary: {
    background: `linear-gradient(135deg, ${blue.solid1} 0%, ${blue.solid2} 100%)`,
    border: "none",
    borderRadius: radius.full,
    color: uiColor.textContrast,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    paddingTop: verticalSpace.md,
    paddingBottom: verticalSpace.md,
    paddingLeft: horizontalSpace["4xl"],
    paddingRight: horizontalSpace["4xl"],
  },
  buttonSecondary: {
    backgroundColor: uiColor.bgSubtle,
    borderColor: uiColor.border1,
    borderStyle: "solid",
    borderWidth: 1,
    borderRadius: radius.full,
    color: uiColor.text2,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    paddingTop: verticalSpace.md,
    paddingBottom: verticalSpace.md,
    paddingLeft: horizontalSpace["4xl"],
    paddingRight: horizontalSpace["4xl"],
  },
  accountCard: {
    backgroundImage: `linear-gradient(-45deg, ${uiColor.bgSubtle} 0%, ${uiColor.component2} 100%)`,
    borderColor: uiColor.border1,
    borderStyle: "solid",
    borderWidth: 1,
    borderRadius: radius.xl,
    boxShadow: shadow.xl,
    marginLeft: "auto",
    marginRight: "auto",
    maxWidth: "100%",
    paddingTop: verticalSpace["10xl"],
    paddingBottom: verticalSpace["10xl"],
    paddingLeft: horizontalSpace["7xl"],
    paddingRight: horizontalSpace["7xl"],
    textAlign: "center",
  },
  accountLogo: {
    alignItems: "center",
    backgroundImage: `linear-gradient(135deg, ${blue.border2} 0%, ${blue.solid2} 100%)`,
    borderRadius: radius.lg,
    color: "white",
    display: "inline-flex",
    fontSize: fontSize["2xl"],
    fontWeight: fontWeight.bold,
    height: size["6xl"],
    justifyContent: "center",
    marginBottom: verticalSpace["2xl"],
    width: size["6xl"],
  },
  accountLabel: {
    color: uiColor.text1,
    fontSize: fontSize.xs,
    fontWeight: fontWeight.light,
    letterSpacing: tracking.widest,
    marginBottom: verticalSpace.md,
    textTransform: "uppercase",
  },
  accountHandle: {
    color: uiColor.text2,
    fontFamily: fontFamily.title,
    fontSize: fontSize["5xl"],
    fontWeight: fontWeight.bold,
    lineHeight: lineHeight.sm,
    margin: 0,
  },
  accountTags: {
    display: "flex",
    flexWrap: "wrap",
    gap: gap.md,
    justifyContent: "center",
    marginBottom: verticalSpace["2xl"],
    marginTop: verticalSpace["2xl"],
  },
  accountTag: {
    backgroundColor: uiColor.bg,
    borderColor: uiColor.border2,
    boxShadow: shadow.sm,
    borderStyle: "solid",
    borderWidth: 1,
    borderRadius: radius.full,
    color: uiColor.text1,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    fontFamily: fontFamily.sans,
    paddingTop: verticalSpace.sm,
    paddingBottom: verticalSpace.sm,
    paddingLeft: horizontalSpace.xl,
    paddingRight: horizontalSpace.xl,
  },
  sectionGray: {
    backgroundColor: uiColor.bgSubtle,
    borderRadius: radius.lg,
    marginBottom: verticalSpace["6xl"],
    paddingTop: verticalSpace["11xl"],
    paddingBottom: verticalSpace["11xl"],
    paddingLeft: horizontalSpace["10xl"],
    paddingRight: horizontalSpace["10xl"],
  },
  sectionWhite: {
    backgroundColor: uiColor.bg,
    marginBottom: verticalSpace["6xl"],
    paddingTop: verticalSpace["11xl"],
    paddingBottom: verticalSpace["11xl"],
    paddingLeft: horizontalSpace["10xl"],
    paddingRight: horizontalSpace["10xl"],
  },
  sectionEyebrow: {
    color: blue.text1,
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold,
    letterSpacing: tracking.widest,
    marginBottom: verticalSpace.lg,
    textTransform: "uppercase",
  },
  sectionHeading: {
    color: uiColor.text2,
    fontFamily: fontFamily.title,
    fontSize: {
      default: fontSize["4xl"],
      [breakpoints.md]: fontSize["5xl"],
      [breakpoints.lg]: fontSize["6xl"],
    },
    fontWeight: fontWeight.bold,
    letterSpacing: tracking.tight,
    lineHeight: lineHeight.sm,
    marginTop: 0,
    marginBottom: 0,
    marginLeft: 0,
    marginRight: 0,
  },
  sectionBody: {
    color: uiColor.text1,
    fontFamily: fontFamily.sans,
    fontSize: fontSize.xl,
    lineHeight: lineHeight.base,
    margin: 0,
  },
  twoCol: {
    maxWidth: "var(--page-content-max-width)",
    marginLeft: "auto",
    marginRight: "auto",
  },
  cardGrid2: {
    minWidth: "min(80vw, 500px)",
    display: "grid",
    gap: gap.lg,
    gridTemplateColumns: {
      default: "1fr",
      [breakpoints.md]: "1fr 1fr",
    },
  },
  cardGrid3: {
    display: "grid",
    gap: gap.lg,
    gridTemplateColumns: {
      default: "1fr",
      [breakpoints.md]: "1fr 1fr 1fr",
    },
  },
  featureCard: {
    boxShadow: shadow.lg,
    backgroundColor: uiColor.bg,
    borderColor: uiColor.border1,
    borderStyle: "solid",
    borderWidth: 1,
    borderRadius: radius.md,
    minHeight: verticalSpace["12xl"],
    paddingTop: verticalSpace["4xl"],
    paddingBottom: verticalSpace["4xl"],
    paddingLeft: horizontalSpace["4xl"],
    paddingRight: horizontalSpace["4xl"],
    display: "flex",
    flexDirection: "column",
    gap: gap.xl,
    flexGrow: 1,
    flexShrink: 0,
    flexBasis: 0,
    minWidth: 320,
  },
  featureTitle: {
    color: uiColor.text2,
    fontFamily: fontFamily.title,
    fontSize: fontSize.xl,
    fontWeight: fontWeight.semibold,
    lineHeight: lineHeight.sm,
    margin: 0,
  },
  featureTitleRow: {
    alignItems: "center",
    display: "flex",
    gap: gap.md,
  },
  featureIcon: {
    alignItems: "center",
    backgroundColor: uiColor.bgSubtle,
    borderColor: uiColor.border1,
    borderStyle: "solid",
    borderWidth: 1,
    borderRadius: radius.sm,
    color: blue.text1,
    display: "inline-flex",
    flexShrink: 0,
    height: size["4xl"],
    justifyContent: "center",
    width: size["4xl"],
  },
  featureBody: {
    color: uiColor.text1,
    fontFamily: fontFamily.sans,
    fontSize: fontSize.base,
    lineHeight: lineHeight.base,
    marginTop: 0,
    marginBottom: 0,
    marginLeft: 0,
    marginRight: 0,
  },
  centerIntro: {
    marginBottom: verticalSpace["6xl"],
    textAlign: "center",
  },
  statBand: {
    backgroundImage: `linear-gradient(135deg, ${blue.solid1} 0%, ${blue.text1} 100%)`,
    borderRadius: radius.xl,
    cornerShape: "squircle",
    color: uiColor.textContrast,
    display: "grid",
    gap: gap["6xl"],
    gridTemplateColumns: {
      default: "1fr",
      [breakpoints.md]: "1fr 1fr 1fr",
    },
    marginTop: verticalSpace["5xl"],
    paddingTop: verticalSpace["8xl"],
    paddingBottom: verticalSpace["8xl"],
    paddingLeft: horizontalSpace["10xl"],
    paddingRight: horizontalSpace["10xl"],
    width: "fit-content",
    marginLeft: "auto",
    marginRight: "auto",
  },
  statItem: {
    textAlign: "center",
  },
  statValue: {
    fontSize: {
      default: fontSize["4xl"],
      [breakpoints.md]: fontSize["6xl"],
    },
    fontWeight: fontWeight.bold,
    letterSpacing: tracking.tight,
    lineHeight: lineHeight.none,
    margin: 0,
  },
  statLabel: {
    color: uiColor.textContrast,
    fontSize: fontSize.lg,
    fontWeight: fontWeight.light,
    marginTop: verticalSpace.md,
    marginBottom: 0,
    marginLeft: 0,
    marginRight: 0,
    opacity: 0.9,
  },
  audienceBox: {
    display: "grid",
    gap: gap.md,
  },
  checkRow: {
    backgroundColor: uiColor.bg,
    borderColor: uiColor.border1,
    borderStyle: "solid",
    borderWidth: 1,
    borderRadius: radius.sm,
    color: uiColor.text2,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    paddingTop: verticalSpace.md,
    paddingBottom: verticalSpace.md,
    paddingLeft: horizontalSpace.lg,
    paddingRight: horizontalSpace.lg,
  },
  ctaSection: {
    alignItems: "center",
    display: "flex",
    flexDirection: "column",
    gap: gap["2xl"],
    paddingBottom: verticalSpace["11xl"],
    paddingTop: verticalSpace["11xl"],
    textAlign: "center",
  },
  ctaTitle: {
    color: uiColor.text2,
    fontFamily: fontFamily.title,
    fontSize: {
      default: fontSize["4xl"],
      [breakpoints.md]: fontSize["6xl"],
    },
    fontWeight: fontWeight.bold,
    letterSpacing: tracking.tight,
    lineHeight: lineHeight.sm,
    margin: 0,
  },
  ctaAccent: {
    color: blue.text1,
  },
  ctaBody: {
    color: uiColor.text1,
    fontFamily: fontFamily.sans,
    fontSize: fontSize.lg,
    lineHeight: lineHeight.base,
    margin: 0,
    maxWidth: "54ch",
  },
  footerLine: {
    borderTopColor: uiColor.border1,
    borderTopStyle: "solid",
    borderTopWidth: 1,
    color: uiColor.text1,
    display: "flex",
    fontSize: fontSize.xs,
    justifyContent: "space-between",
    marginTop: verticalSpace.md,
    paddingTop: verticalSpace["2xl"],
    width: "100%",
  },
  accountCardHero: {
    backgroundColor: uiColor.bg,
    paddingBottom: verticalSpace["11xl"],
  },
  sectionBodyContainer: {
    minWidth: 320,
  },
  sectionBodyLarge: {
    maxWidth: "44ch",
    marginLeft: "auto",
    marginRight: "auto",
  },
  appBrowserSection: {
    backgroundColor: uiColor.bg,
    borderRadius: radius.lg,
    marginBottom: verticalSpace["6xl"],
    paddingTop: verticalSpace["11xl"],
    paddingBottom: verticalSpace["11xl"],
    paddingLeft: horizontalSpace["10xl"],
    paddingRight: horizontalSpace["10xl"],
  },
  appBrowserHeader: {
    textAlign: "center",
  },
  appBrowserEyebrow: {
    color: blue.text1,
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold,
    letterSpacing: tracking.widest,
    marginBottom: verticalSpace.lg,
    textTransform: "uppercase",
  },
  appBrowserDescription: {
    color: uiColor.text1,
    fontFamily: fontFamily.sans,
    fontSize: fontSize.lg,
    lineHeight: lineHeight.base,
    margin: 0,
    maxWidth: "56ch",
    marginLeft: "auto",
    marginRight: "auto",
  },
  chipRow: {
    alignItems: "center",
    display: "flex",
    flexWrap: "wrap",
    gap: gap.md,
    justifyContent: "center",
  },
  chip: {
    backgroundColor: uiColor.bgSubtle,
    borderColor: uiColor.border1,
    borderStyle: "solid",
    borderWidth: 1,
    borderRadius: radius.full,
    color: uiColor.text1,
    cursor: "pointer",
    fontFamily: fontFamily.sans,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    paddingTop: verticalSpace.sm,
    paddingBottom: verticalSpace.sm,
    paddingLeft: horizontalSpace.xl,
    paddingRight: horizontalSpace.xl,
  },
  chipActive: {
    backgroundColor: uiColor.text2,
    borderColor: uiColor.text2,
    color: uiColor.bg,
  },
  appCardLink: {
    display: "block",
    height: "100%",
    textDecoration: "none",
  },
  appCard: {
    backgroundColor: {
      default: uiColor.bg,
      ":is([data-hovered=true])": uiColor.bgSubtle,
    },
    borderColor: {
      default: uiColor.border1,
      ":is([data-hovered=true])": uiColor.border2,
    },
    borderStyle: "solid",
    borderWidth: 1,
    borderRadius: radius.md,
    height: "100%",
    overflow: "hidden",
  },
  appCardFeatured: {
    borderRadius: radius.xl,
    boxShadow: shadow.lg,
  },
  appCardBody: {
    height: "100%",
    display: "flex",
    flexDirection: "column",
    gap: gap["4xl"],
    minHeight: size["5xl"],
    paddingTop: verticalSpace["2xl"],
    paddingBottom: verticalSpace["2xl"],
    paddingLeft: horizontalSpace["2xl"],
    paddingRight: horizontalSpace["2xl"],
  },
  featuredImage: {
    display: "block",
    height: "100%",
    minHeight: "14rem",
    objectFit: "cover",
    width: "100%",
  },
  featuredFallback: {
    alignItems: "center",
    backgroundColor: uiColor.bgSubtle,
    color: uiColor.text1,
    display: "flex",
    fontFamily: fontFamily.title,
    fontSize: fontSize.xl,
    fontWeight: fontWeight.semibold,
    height: "100%",
    justifyContent: "center",
    minHeight: "14rem",
  },
  browserCardText: {
    minWidth: 0,
  },
  browserCardTitle: {
    color: uiColor.text2,
    fontFamily: fontFamily.title,
    fontSize: fontSize["2xl"],
    fontWeight: fontWeight.semibold,
    margin: 0,
  },
  browserCardSubtitle: {
    color: uiColor.text1,
    fontFamily: fontFamily.sans,
    fontSize: fontSize.base,
    margin: 0,
  },
  browserCardLink: {
    color: blue.text1,
    fontFamily: fontFamily.sans,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    marginTop: verticalSpace.xs,
  },
  bottomMetaContainer: {
    paddingTop: verticalSpace["6xl"],
  },
  bottomMeta: {
    color: uiColor.text1,
    fontFamily: fontFamily.sans,
    fontSize: fontSize.base,
    textAlign: "center",
  },
  appCardAvatar: {
    flexShrink: 0,
  },
});

function RouteComponent() {
  const { data: allApps } = useSuspenseQuery(
    directoryListingApi.getAllAppsQueryOptions({ sort: "popular" }),
  );
  const tagStats = useMemo(() => buildTagStats(allApps), [allApps]);
  const appBrowserTags = useMemo(
    () => tagStats.slice(0, MAX_BROWSER_TAGS),
    [tagStats],
  );
  const [activeAppTag, setActiveAppTag] = useState<string | null>(
    appBrowserTags[0]?.tag ?? null,
  );
  const activeAppTagValue = activeAppTag ?? appBrowserTags[0]?.tag ?? null;
  const appFeaturedApps = useMemo(() => {
    if (!activeAppTagValue) {
      return allApps;
    }

    return allApps.filter((app) => app.appTags.includes(activeAppTagValue));
  }, [activeAppTagValue, allApps]);
  const appBrowserApps = appFeaturedApps.length > 0 ? appFeaturedApps : allApps;

  const { data: blueskyEcosystemData } = useSuspenseQuery(
    directoryListingApi.getDirectoryCategoryPageQueryOptions({
      categoryId: BLUESKY_ECOSYSTEM_CATEGORY_ID,
    }),
  );
  const ecosystemApps = blueskyEcosystemData?.listings ?? allApps;
  const browserCategories = useMemo(
    () =>
      (blueskyEcosystemData?.category.children ?? [])
        .map((category) => ({
          id: category.id,
          label: category.label,
          listings: getListingsForCategoryBranch(category.id, ecosystemApps),
        }))
        .filter((category) => category.listings.length > 0)
        .sort((a) => (a.label === "Client" ? -1 : 1))
        .slice(0, MAX_BROWSER_TAGS),
    [blueskyEcosystemData?.category.children, ecosystemApps],
  );
  const ecosystemBrowserTags = useMemo(
    () =>
      browserCategories.map((category) => ({
        tag: category.id,
        label: category.label,
      })),
    [browserCategories],
  );
  const [activeEcosystemTag, setActiveEcosystemTag] = useState<string | null>(
    ecosystemBrowserTags[0]?.tag ?? null,
  );
  const activeEcosystemTagValue =
    activeEcosystemTag ?? ecosystemBrowserTags[0]?.tag ?? null;
  const ecosystemFeaturedApps = useMemo(() => {
    if (!activeEcosystemTagValue) {
      return ecosystemApps;
    }

    return (
      browserCategories.find(
        (category) => category.id === activeEcosystemTagValue,
      )?.listings ?? ecosystemApps
    );
  }, [activeEcosystemTagValue, browserCategories, ecosystemApps]);
  const ecosystemBrowserApps =
    ecosystemFeaturedApps.length > 0 ? ecosystemFeaturedApps : ecosystemApps;

  return (
    <HeaderLayout.Root style={styles.shell}>
      <HeaderLayout.Header>
        <SiteHeader />
      </HeaderLayout.Header>
      <Page.Hero style={styles.accountCardHero}>
        <Flex direction="column" gap="6xl" align="center" justify="center">
          <div {...stylex.props(styles.hero)}>
            <span {...stylex.props(styles.eyebrow)}>
              <Sparkles size={16} />
              The Atmosphere
            </span>
            <h1 {...stylex.props(styles.h1)}>
              The last social account
              <br />
              <span {...stylex.props(styles.h1Accent)}>
                you&apos;ll ever need.
              </span>
            </h1>
            <p {...stylex.props(styles.heroBody)}>
              One account for all your apps. Yours to keep, wherever you go.
            </p>
          </div>

          <div {...stylex.props(styles.accountCard)}>
            <div {...stylex.props(styles.accountLogo)}>
              <Sparkles size={24} />
            </div>
            <div {...stylex.props(styles.accountLabel)}>Atmosphere Account</div>
            <p {...stylex.props(styles.accountHandle)}>@yourname.com</p>
            <div {...stylex.props(styles.accountTags)}>
              {ACCOUNT_TAGS.map((tag) => (
                <span key={tag} {...stylex.props(styles.accountTag)}>
                  {tag}
                </span>
              ))}
            </div>
            <p {...stylex.props(styles.sectionBody)}>
              One account. Hundreds of apps. All your data, always yours.
            </p>
          </div>
        </Flex>
      </Page.Hero>
      <Page.Hero style={styles.sectionGray}>
        <Flex direction="column" gap="2xl" style={styles.twoCol}>
          <Flex direction="column" gap="2xl">
            <Flex direction="column" gap="md">
              <div {...stylex.props(styles.sectionEyebrow)}>The Big Idea</div>
              <h2 {...stylex.props(styles.sectionHeading)}>
                What is the Atmosphere?
              </h2>
            </Flex>
          </Flex>
          <Flex gap="8xl" wrap>
            <Flex
              direction="column"
              gap="2xl"
              style={[styles.grow, styles.sectionBodyContainer]}
            >
              <p {...stylex.props(styles.sectionBody)}>
                The Atmosphere is a new open network of apps and services that
                all work together. Think of it like truly owning your Google
                Account. Instead of every app being its own walled garden,
                Atmosphere apps share a common foundation — so you only need one
                account to use them all, and they can easily share data.
              </p>
              <p {...stylex.props(styles.sectionBody)}>
                Your Atmosphere Account is your passport to this entire
                ecosystem. One account unlocks every app — no more creating new
                logins, no more losing your stuff when you switch. Sign in once,
                and you're home everywhere.
              </p>
            </Flex>
            <div {...stylex.props(styles.grow)}>
              <div {...stylex.props(styles.cardGrid2, styles.grow)}>
                {INTRO_FEATURES.map((item) => (
                  <article
                    key={item.title}
                    {...stylex.props(styles.featureCard)}
                  >
                    <span {...stylex.props(styles.featureIcon)}>
                      <item.icon size={20} />
                    </span>
                    <Flex direction="column" gap="md">
                      <div {...stylex.props(styles.featureTitleRow)}>
                        <h3 {...stylex.props(styles.featureTitle)}>
                          {item.title}
                        </h3>
                      </div>
                      <p {...stylex.props(styles.featureBody)}>
                        {item.subtitle}
                      </p>
                    </Flex>
                  </article>
                ))}
              </div>
            </div>
          </Flex>
        </Flex>
      </Page.Hero>
      <Page.Hero style={styles.sectionWhite}>
        <Flex direction="column" gap="6xl" style={styles.twoCol}>
          <Flex direction="column" gap="4xl" style={styles.appBrowserHeader}>
            <div {...stylex.props(styles.appBrowserEyebrow)}>App Ecosystem</div>
            <h2 {...stylex.props(styles.sectionHeading)}>
              One account. Every app.
            </h2>
            <p {...stylex.props(styles.appBrowserDescription)}>
              Sign in once and you&apos;re ready to use every app on the
              Atmosphere with no new passwords and no starting over.
            </p>
          </Flex>

          {appBrowserTags.length > 0 ? (
            <div {...stylex.props(styles.chipRow)}>
              {appBrowserTags.map((tag) => (
                <button
                  key={tag.tag}
                  type="button"
                  onClick={() => setActiveAppTag(tag.tag)}
                  {...stylex.props(
                    styles.chip,
                    activeAppTagValue === tag.tag && styles.chipActive,
                  )}
                >
                  {formatAppTagLabel(tag.tag)}
                </button>
              ))}
            </div>
          ) : null}

          <FeaturedListingGrid
            items={appBrowserApps.slice(0, MAX_BROWSER_APPS)}
            getKey={(app) => app.id}
            isFeatured={(_, index) => index === 0}
            renderItem={(app, { featured }) => (
              <AppBrowserListingCard featured={featured} listing={app} />
            )}
          />

          <Flex
            justify="center"
            direction="column"
            align="center"
            gap="xl"
            style={styles.bottomMetaContainer}
          >
            <ButtonLink to="/apps/tags" type="button" size="xl">
              Browse all apps
            </ButtonLink>
            <p {...stylex.props(styles.bottomMeta)}>
              <strong>{allApps.length}+</strong> apps already on the Atmosphere.
            </p>
          </Flex>
        </Flex>
      </Page.Hero>
      <Page.Hero style={styles.sectionGray}>
        <div {...stylex.props(styles.twoCol)}>
          <Flex direction="column" gap="7xl">
            <Flex direction="column" gap="lg">
              <div {...stylex.props(styles.sectionEyebrow)}>Data ownership</div>
              <h2 {...stylex.props(styles.sectionHeading)}>
                Control your data.
              </h2>
              <p {...stylex.props(styles.sectionBody)}>
                Your Atmosphere account lives in a PDS — a service that stores
                your data and keeps it available across every app. You pick who
                hosts your account, and you can switch any time. No matter which
                provider you choose, your account works everywhere.
              </p>
            </Flex>
            <Flex gap="lg" wrap>
              {DATA_CONTROL.map((item) => (
                <article key={item.title} {...stylex.props(styles.featureCard)}>
                  <span {...stylex.props(styles.featureIcon)}>
                    <item.icon size={20} />
                  </span>
                  <Flex direction="column" gap="md">
                    <div {...stylex.props(styles.featureTitleRow)}>
                      <h3 {...stylex.props(styles.featureTitle)}>
                        {item.title}
                      </h3>
                    </div>
                    <p {...stylex.props(styles.featureBody)}>{item.body}</p>
                  </Flex>
                </article>
              ))}
            </Flex>
          </Flex>
        </div>
      </Page.Hero>
      <Page.Hero style={styles.sectionWhite}>
        <Flex direction="column" gap="6xl" style={styles.twoCol}>
          <Flex direction="column" gap="4xl" style={styles.appBrowserHeader}>
            <div {...stylex.props(styles.appBrowserEyebrow)}>
              Organic Ecosystem
            </div>
            <h2 {...stylex.props(styles.sectionHeading)}>Apps for your Apps</h2>
            <p {...stylex.props(styles.appBrowserDescription)}>
              Since you own your Atmosphere account, anyone can build new apps
              with you data. Ditch the walled gardens and build your own.
            </p>
            <p {...stylex.props(styles.appBrowserDescription)}>
              Below you can explore apps and tools that work with Bluesky.
            </p>
          </Flex>

          {ecosystemBrowserTags.length > 0 ? (
            <div {...stylex.props(styles.chipRow)}>
              {ecosystemBrowserTags.map((tag) => (
                <button
                  key={tag.tag}
                  type="button"
                  onClick={() => setActiveEcosystemTag(tag.tag)}
                  {...stylex.props(
                    styles.chip,
                    activeEcosystemTagValue === tag.tag && styles.chipActive,
                  )}
                >
                  {tag.label}
                </button>
              ))}
            </div>
          ) : null}

          <FeaturedListingGrid
            items={ecosystemBrowserApps.slice(0, MAX_BROWSER_APPS)}
            getKey={(app) => app.id}
            isFeatured={(_, index) => index === 0}
            renderItem={(app, { featured }) => (
              <AppBrowserListingCard featured={featured} listing={app} />
            )}
          />

          <Flex
            justify="center"
            direction="column"
            align="center"
            style={styles.bottomMetaContainer}
          >
            <ButtonLink
              to="/ecosystems/$app"
              params={{ app: "bluesky" }}
              type="button"
              size="xl"
            >
              Browse all
            </ButtonLink>
            <p {...stylex.props(styles.bottomMeta)}>
              <strong>{ecosystemApps.length}+</strong> Bluesky ecosystem apps in
              the directory.
            </p>
          </Flex>
        </Flex>
      </Page.Hero>
      <Page.Hero style={styles.ctaSection}>
        <div {...stylex.props(styles.accountLogo)}>
          <Sparkles size={24} />
        </div>
        <h2 {...stylex.props(styles.ctaTitle)}>
          One account.
          <br />
          <span {...stylex.props(styles.ctaAccent)}>
            Endless possibilities.
          </span>
        </h2>
        <p {...stylex.props(styles.ctaBody)}>
          Join the open social web. Create your Atmosphere account today and
          take your identity and your data with you everywhere.
        </p>
        <div {...stylex.props(styles.heroButtons)}>
          <ButtonLink to="/home" type="button" size="xl">
            Start exploring
          </ButtonLink>
        </div>
      </Page.Hero>
      <HeaderLayout.Footer>
        <SiteFooter />
      </HeaderLayout.Footer>
    </HeaderLayout.Root>
  );
}

function buildTagStats(apps: DirectoryListingCard[]) {
  const counts = new Map<string, number>();

  for (const app of apps) {
    for (const tag of app.appTags) {
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  }

  return [...counts.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count);
}

function getGroupHeroPreloadImagesFromEcosystem(apps: DirectoryListingCard[]) {
  const heroUrls = new Set<string>();

  for (const app of apps.slice(0, MAX_BROWSER_APPS)) {
    if (app.heroImageUrl) {
      heroUrls.add(app.heroImageUrl);
    }
  }

  return [...heroUrls];
}

function AppBrowserListingCard({
  listing,
  featured,
}: {
  listing: DirectoryListingCard;
  featured: boolean;
}) {
  const { isHovered, hoverProps } = useHover({});
  return (
    <RouterLink
      to="/products/$productId"
      params={{ productId: getDirectoryListingSlug(listing) }}
      {...stylex.props(styles.appCardLink)}
    >
      <Card
        data-hovered={isHovered}
        {...(hoverProps as Omit<typeof hoverProps, "style" | "className">)}
        style={
          featured ? [styles.appCard, styles.appCardFeatured] : styles.appCard
        }
      >
        {featured ? (
          listing.heroImageUrl ? (
            <img
              src={listing.heroImageUrl}
              alt={listing.name}
              {...stylex.props(styles.featuredImage)}
            />
          ) : (
            <div {...stylex.props(styles.featuredFallback)}>{listing.name}</div>
          )
        ) : (
          <div {...stylex.props(styles.appCardBody)}>
            <Flex gap="xl">
              <Avatar
                alt={listing.name}
                fallback={listing.name.slice(0, 2).toUpperCase()}
                src={listing.iconUrl || undefined}
                size="xl"
                style={styles.appCardAvatar}
              />
              <Flex direction="column" gap="xs" style={styles.browserCardText}>
                <p {...stylex.props(styles.browserCardTitle)}>{listing.name}</p>
                <p {...stylex.props(styles.browserCardSubtitle)}>
                  @
                  {listing.productAccountHandle?.replace(/^@/, "") || "unknown"}
                </p>
              </Flex>
            </Flex>
            <Body variant="secondary" style={styles.grow}>
              {listing.tagline}
            </Body>
            <Flex align="center" justify="end" gap="lg">
              <SmallBody variant="secondary">
                {listing.rating != null ? listing.rating.toFixed(1) : "—"}
              </SmallBody>
              <StarRating
                rating={listing.rating}
                reviewCount={listing.reviewCount}
                showReviewCount
              />
            </Flex>
          </div>
        )}
      </Card>
    </RouterLink>
  );
}
