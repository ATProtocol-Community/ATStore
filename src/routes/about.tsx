import * as stylex from "@stylexjs/stylex";
import { createFileRoute, createLink } from "@tanstack/react-router";

import { Page } from "../design-system/page";
import { blue, blueA } from "../design-system/theme/colors/blue.stylex";
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
  Database,
  Globe,
  Layers3,
  ShieldCheck,
  Sparkles,
  Tags,
  TrendingUp,
  UserCheck,
  UserRound,
} from "lucide-react";
import { HeaderLayout } from "#/design-system/header-layout";
import { SiteFooter } from "#/components/SiteFooter";
import { SiteHeader } from "#/components/SiteHeader";
import { Flex } from "#/design-system/flex";
import { Link } from "#/design-system/link";
import {
  directoryListingApi,
  type DirectoryListingCard,
} from "#/integrations/tanstack-query/api-directory-listings.functions";
import { buildRouteOgMeta } from "#/lib/og-meta";
import { Text } from "#/design-system/typography/text.tsx";

const LinkLink = createLink(Link);

const BLUESKY_ECOSYSTEM_CATEGORY_ID = "apps/bluesky";

export const Route = createFileRoute("/about")({
  loader: async ({ context }) => {
    const ecosystemData = await context.queryClient.ensureQueryData(
      directoryListingApi.getDirectoryCategoryPageQueryOptions({
        categoryId: BLUESKY_ECOSYSTEM_CATEGORY_ID,
        sort: "popular",
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
      title: "About | ATStore",
      description:
        "The open social web (the Atmosphere) and ATStore: an open directory of apps and tools on the AT Protocol, how it works, and how to get involved.",
    }),
    links: (loaderData?.preloadHeroImages ?? []).map((href) => ({
      rel: "preload",
      as: "image",
      href,
    })),
  }),
  component: AboutPage,
});

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

const HOW_ATSTORE_WORKS = [
  {
    title: "Listings as records",
    body: "Every product is a fyi.atstore.listing.detail record on someone's PDS. ATStore ingests these records via a tap-sync consumer, so the directory stays in sync with whoever owns the listing.",
    icon: Database,
  },
  {
    title: "Claiming your listing",
    body: "Anyone with an ATProto account can claim and manage the listing for a product they represent. Once claimed, the listing's record lives on the owner's PDS — not ours — so it's portable and revocable.",
    icon: UserCheck,
  },
  {
    title: "Reviews & trending",
    body: "Reviews are public records too. A separate consumer watches Bluesky for posts that mention listings to surface what the community is actually using and talking about right now.",
    icon: TrendingUp,
  },
  {
    title: "Categories & tags",
    body: "Listings are organized by the app they build on (e.g. Bluesky) and by cross-cutting workflow tags like analytics, moderation, or automation. Browse by whatever lens fits the question you're asking.",
    icon: Tags,
  },
] as const;

const styles = stylex.create({
  grow: {
    flexGrow: 1,
    flexShrink: 0,
    flexBasis: 0,
    minWidth: 0,
  },
  fit: {
    minWidth: "fit-content",
  },
  shell: {
    fontFamily: fontFamily.sans,
  },
  hero: {
    alignItems: "center",
    display: "flex",
    flexDirection: "column",
    gap: gap["4xl"],
    marginBottom: {
      default: verticalSpace["2xl"],
      [breakpoints.md]: verticalSpace["4xl"],
    },
    marginTop: {
      default: verticalSpace["8xl"],
      [breakpoints.md]: verticalSpace["11xl"],
    },
    paddingLeft: horizontalSpace["2xl"],
    paddingRight: horizontalSpace["2xl"],
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
    fontSize: fontSize.xl,
    fontWeight: fontWeight.medium,
    fontFamily: fontFamily.sans,
    paddingTop: verticalSpace["2xl"],
    paddingBottom: verticalSpace["2xl"],
    paddingLeft: horizontalSpace["4xl"],
    paddingRight: horizontalSpace["4xl"],
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
  cardDescription: {
    fontSize: fontSize.base,
    lineHeight: lineHeight.base,
    margin: 0,
    color: uiColor.text1,
  },
  atstoreBridge: {
    color: uiColor.text1,
    fontFamily: fontFamily.sans,
    fontSize: fontSize.lg,
    lineHeight: lineHeight.base,
    margin: 0,
    marginTop: verticalSpace["2xl"],
    maxWidth: "min(90vw, 42rem)",
  },
  atstoreBridgeLink: {
    color: blue.text1,
    fontWeight: fontWeight.semibold,
    textDecoration: "underline",
    textUnderlineOffset: 4,
  },
  accountCard: {
    backgroundImage: `linear-gradient(-45deg, ${uiColor.bgSubtle} 0%, ${uiColor.component2} 100%)`,
    borderColor: uiColor.border1,
    borderStyle: "solid",
    borderWidth: 1,
    borderRadius: radius.xl,
    boxShadow: shadow.xl,
    maxWidth: "90vw",
    boxSizing: "border-box",
    paddingTop: {
      default: verticalSpace["5xl"],
      [breakpoints.md]: verticalSpace["10xl"],
    },
    paddingBottom: {
      default: verticalSpace["5xl"],
      [breakpoints.md]: verticalSpace["10xl"],
    },
    paddingLeft: {
      default: horizontalSpace["5xl"],
      [breakpoints.md]: horizontalSpace["7xl"],
    },
    paddingRight: {
      default: horizontalSpace["5xl"],
      [breakpoints.md]: horizontalSpace["7xl"],
    },
    textAlign: "center",
    marginLeft: {
      default: horizontalSpace["5xl"],
      [breakpoints.md]: horizontalSpace["8xl"],
    },
    marginRight: {
      default: horizontalSpace["5xl"],
      [breakpoints.md]: horizontalSpace["8xl"],
    },
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
    fontSize: {
      default: fontSize["3xl"],
      [breakpoints.md]: fontSize["5xl"],
    },
    fontWeight: fontWeight.bold,
    lineHeight: lineHeight.sm,
    margin: 0,
  },
  accountTags: {
    display: "flex",
    flexWrap: "wrap",
    gap: {
      default: gap.sm,
      [breakpoints.md]: gap.md,
    },
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
    fontSize: {
      default: fontSize.xs,
      [breakpoints.md]: fontSize.sm,
    },
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
    paddingTop: {
      default: verticalSpace["2xl"],
      [breakpoints.md]: verticalSpace["11xl"],
    },
    paddingBottom: {
      default: verticalSpace["2xl"],
      [breakpoints.md]: verticalSpace["11xl"],
    },
    paddingLeft: {
      default: horizontalSpace["6xl"],
      [breakpoints.md]: horizontalSpace["10xl"],
    },
    paddingRight: {
      default: horizontalSpace["6xl"],
      [breakpoints.md]: horizontalSpace["10xl"],
    },
  },
  sectionWhite: {
    backgroundColor: uiColor.bg,
    marginBottom: verticalSpace["6xl"],
    paddingTop: {
      default: verticalSpace["8xl"],
      [breakpoints.md]: verticalSpace["11xl"],
    },
    paddingBottom: {
      default: verticalSpace["8xl"],
      [breakpoints.md]: verticalSpace["11xl"],
    },
    paddingLeft: {
      default: horizontalSpace["6xl"],
      [breakpoints.md]: horizontalSpace["10xl"],
    },
    paddingRight: {
      default: horizontalSpace["6xl"],
      [breakpoints.md]: horizontalSpace["10xl"],
    },
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
    fontSize: {
      default: fontSize.lg,
      [breakpoints.md]: fontSize.xl,
    },
    lineHeight: lineHeight.base,
    margin: 0,
  },
  proseInline: {
    color: uiColor.text1,
    fontFamily: fontFamily.sans,
    fontSize: {
      default: fontSize.lg,
      [breakpoints.md]: fontSize.xl,
    },
    lineHeight: lineHeight.base,
    margin: 0,
  },
  proseLink: {
    color: blue.text1,
    fontWeight: fontWeight.medium,
    textDecoration: "underline",
    textUnderlineOffset: 3,
  },
  inlineCode: {
    fontFamily: fontFamily.mono,
    fontSize: "0.95em",
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
  featureCard: {
    boxShadow: shadow.lg,
    backgroundColor: uiColor.bg,
    borderColor: uiColor.border1,
    borderStyle: "solid",
    borderWidth: 1,
    boxSizing: "border-box",
    borderRadius: radius.md,
    minHeight: verticalSpace["12xl"],
    paddingTop: verticalSpace["4xl"],
    paddingBottom: verticalSpace["4xl"],
    paddingLeft: horizontalSpace["4xl"],
    paddingRight: horizontalSpace["4xl"],
    display: "flex",
    alignItems: {
      default: "center",
      [breakpoints.md]: "flex-start",
    },
    flexDirection: {
      default: "row",
      [breakpoints.md]: "column",
    },
    gap: {
      default: gap["4xl"],
      [breakpoints.md]: gap["2xl"],
    },
    flexGrow: 1,
    flexShrink: 0,
    flexBasis: 0,
    minWidth: 280,
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
  atstoreProseStack: {
    display: "flex",
    flexDirection: "column",
    gap: verticalSpace["3xl"],
    maxWidth: "var(--page-content-max-width)",
  },
  ctaSection: {
    alignItems: "center",
    display: "flex",
    flexDirection: "column",
    gap: gap["2xl"],
    paddingBottom: {
      default: verticalSpace["8xl"],
      [breakpoints.md]: verticalSpace["11xl"],
    },
    paddingTop: {
      default: verticalSpace["8xl"],
      [breakpoints.md]: verticalSpace["11xl"],
    },
    paddingLeft: {
      default: horizontalSpace["6xl"],
      [breakpoints.md]: horizontalSpace["10xl"],
    },
    paddingRight: {
      default: horizontalSpace["6xl"],
      [breakpoints.md]: horizontalSpace["10xl"],
    },
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
  accountCardHero: {
    backgroundColor: uiColor.bg,
    paddingBottom: verticalSpace["11xl"],
  },
  sectionBodyGrid: {
    gap: {
      default: verticalSpace["6xl"],
      [breakpoints.md]: verticalSpace["8xl"],
    },
  },
  sectionBodyContainer: {
    minWidth: 320,
  },
  appBrowserHeader: {
    textAlign: "center",
  },
  appBrowserEyebrow: {
    color: blue.text2,
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold,
    letterSpacing: tracking.widest,
    marginBottom: verticalSpace.lg,
    textTransform: "uppercase",
    backgroundColor: blueA.component1,
    borderRadius: radius.full,
    paddingTop: verticalSpace.sm,
    paddingBottom: verticalSpace.sm,
    paddingLeft: horizontalSpace.xl,
    paddingRight: horizontalSpace.xl,
    borderColor: blue.border1,
    borderStyle: "solid",
    borderWidth: 1,
    width: "fit-content",
    marginLeft: "auto",
    marginRight: "auto",
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
    position: "relative",
    zIndex: 1,
  },
  appCardLinkFeatured: {
    zIndex: 0,
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
  appBrowserGrid: {
    ":is(*) > :nth-child(4) ~ *": {
      display: {
        default: "none",
        [breakpoints.md]: "block",
      },
    },
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
  callout: {
    maxWidth: "var(--page-content-max-width)",
    marginLeft: "auto",
    marginRight: "auto",
    width: "100%",
    backgroundColor: uiColor.bgSubtle,
    borderRadius: radius.lg,
    paddingTop: verticalSpace["3xl"],
    paddingBottom: verticalSpace["3xl"],
    paddingLeft: horizontalSpace["3xl"],
    paddingRight: horizontalSpace["3xl"],
    gap: gap["6xl"],
    display: "flex",
    flexDirection: "column",
    marginBottom: verticalSpace["6xl"],
  },
  calloutHeading: {
    color: uiColor.text2,
    fontFamily: fontFamily.title,
    fontSize: fontSize["3xl"],
    fontWeight: fontWeight.bold,
    margin: 0,
  },
  calloutStack: {
    display: "flex",
    flexDirection: "column",
    gap: verticalSpace["6xl"],
  },
  calloutBody: {
    color: uiColor.text1,
    fontFamily: fontFamily.sans,
    fontSize: fontSize.base,
    lineHeight: lineHeight.base,
    margin: 0,
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between",
    gap: gap["2xl"],
  },
});

function AboutPage() {
  return (
    <HeaderLayout.Root style={styles.shell}>
      <HeaderLayout.Header>
        <SiteHeader />
      </HeaderLayout.Header>

      <Page.Hero style={styles.accountCardHero}>
        <Flex direction="column" gap="6xl" align="center" justify="center">
          <div {...stylex.props(styles.hero)}>
            <span {...stylex.props(styles.eyebrow)}>
              <Sparkles size={20} />
              ATStore
            </span>
            <h1 {...stylex.props(styles.h1)}>
              An open directory of Atmosphere Apps
            </h1>
            <p {...stylex.props(styles.heroBody)}>
              Browse, discover, and explore the Atmosphere ecosystem.
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
          <Flex wrap style={styles.sectionBodyGrid}>
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
            <div {...stylex.props(styles.grow, styles.fit)}>
              <div {...stylex.props(styles.cardGrid2, styles.grow)}>
                {INTRO_FEATURES.map((item) => (
                  <article
                    key={item.title}
                    {...stylex.props(styles.featureCard)}
                  >
                    <span {...stylex.props(styles.featureIcon)}>
                      <item.icon size={20} />
                    </span>
                    <Flex direction="column" gap="2xl">
                      <div {...stylex.props(styles.featureTitleRow)}>
                        <Text
                          weight="semibold"
                          size="lg"
                          style={styles.featureTitle}
                        >
                          {item.title}
                        </Text>
                      </div>
                      <Text size="base" style={styles.featureBody}>
                        {item.subtitle}
                      </Text>
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
            <div {...stylex.props(styles.appBrowserEyebrow)}>
              Under the hood
            </div>
            <h2 {...stylex.props(styles.sectionHeading)}>How ATStore works</h2>
            <p {...stylex.props(styles.appBrowserDescription)}>
              ATStore is built on the same primitives as the apps it lists.
            </p>
          </Flex>
          <Flex gap="lg" wrap>
            {HOW_ATSTORE_WORKS.map((item) => (
              <article key={item.title} {...stylex.props(styles.featureCard)}>
                <span {...stylex.props(styles.featureIcon)}>
                  <item.icon size={20} />
                </span>
                <Flex direction="column" gap="md">
                  <div {...stylex.props(styles.featureTitleRow)}>
                    <h3 {...stylex.props(styles.featureTitle)}>{item.title}</h3>
                  </div>
                  <p {...stylex.props(styles.featureBody)}>{item.body}</p>
                </Flex>
              </article>
            ))}
          </Flex>
        </Flex>
      </Page.Hero>

      <Page.Hero style={styles.sectionGray}>
        <Flex direction="column" gap="6xl">
          <Flex direction="column" gap="4xl" style={styles.twoCol}>
            <Flex direction="column" gap="md">
              <div {...stylex.props(styles.sectionEyebrow)}>People</div>
              <h2 {...stylex.props(styles.sectionHeading)}>
                Who built it &amp; who runs it
              </h2>
            </Flex>
            <p {...stylex.props(styles.sectionBody)}>
              ATStore was built by{" "}
              <Link
                href="https://github.com/hipstersmoothie"
                target="_blank"
                rel="noreferrer"
                style={styles.proseLink}
              >
                Andrew Lisowski
              </Link>
              , an independent developer working on tools for the open social
              web.
            </p>
            <p {...stylex.props(styles.sectionBody)}>
              It&apos;s maintained as a community project under the{" "}
              <Link
                href="https://discourse.atprotocol.community"
                target="_blank"
                rel="noreferrer"
                style={styles.proseLink}
              >
                AT Protocol Community
              </Link>{" "}
              — a community-hosted, community-moderated home for AT Protocol
              documentation, working groups, and shared infrastructure.
              Editorial decisions about categories, taxonomy, and curation
              happen in the open alongside the wider community.
            </p>
          </Flex>

          <div {...stylex.props(styles.callout)}>
            <Text size="3xl" weight="bold">
              Get in touch
            </Text>
            <div {...stylex.props(styles.calloutStack)}>
              <p {...stylex.props(styles.calloutBody)}>
                <Text weight="bold">Manage your listing.</Text>
                <Text size="base">
                  If you build on ATProto{" "}
                  <LinkLink to="/products/manage" style={styles.proseLink}>
                    Open manage listings
                  </LinkLink>{" "}
                  to submit, edit, or track review status—it only takes a
                  minute.
                </Text>
              </p>
              <p {...stylex.props(styles.calloutBody)}>
                <Text weight="bold">On Bluesky.</Text>
                <Text size="base">
                  Reach out to{" "}
                  <Link
                    href="https://bsky.app/profile/atstore.fyi"
                    target="_blank"
                    rel="noreferrer"
                    style={styles.proseLink}
                  >
                    @atstore.fyi
                  </Link>{" "}
                  with feedback, corrections, or suggestions.
                </Text>
              </p>
              <p {...stylex.props(styles.calloutBody)}>
                <Text weight="bold">Open source.</Text>
                <Text size="base">
                  File issues or open a PR on{" "}
                  <Link
                    href="https://github.com/ATProtocol-Community/ATStore"
                    target="_blank"
                    rel="noreferrer"
                    style={styles.proseLink}
                  >
                    GitHub
                  </Link>
                  .
                </Text>
              </p>
              <p {...stylex.props(styles.calloutBody)}>
                <Text weight="bold">Community.</Text>
                <Text size="base">
                  Join the conversation on the{" "}
                  <Link
                    href="https://discourse.atprotocol.community"
                    target="_blank"
                    rel="noreferrer"
                    style={styles.proseLink}
                  >
                    AT Protocol Community
                  </Link>
                  .
                </Text>
              </p>
            </div>
          </div>
        </Flex>
      </Page.Hero>

      <HeaderLayout.Footer>
        <SiteFooter />
      </HeaderLayout.Footer>
    </HeaderLayout.Root>
  );
}

function getGroupHeroPreloadImagesFromEcosystem(apps: DirectoryListingCard[]) {
  const heroUrls = new Set<string>();

  for (const app of apps.slice(0, 12)) {
    if (app.heroImageUrl) {
      heroUrls.add(app.heroImageUrl);
    }
  }

  return [...heroUrls];
}
