import type { DirectoryListingCard } from "#/integrations/tanstack-query/api-directory-listings.functions";

import * as stylex from "@stylexjs/stylex";
import { createFileRoute, createLink } from "@tanstack/react-router";
import { SiteFooter } from "#/components/SiteFooter";
import { SiteHeader } from "#/components/SiteHeader";
import { Flex } from "#/design-system/flex";
import { HeaderLayout } from "#/design-system/header-layout";
import { Link } from "#/design-system/link";
import { Text } from "#/design-system/typography/text.tsx";
import { directoryListingApi } from "#/integrations/tanstack-query/api-directory-listings.functions";
import { buildRouteOgMeta } from "#/lib/og-meta";
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
import { Trans, useTranslation } from "react-i18next";

import { Page } from "../design-system/page";
import { uiColor } from "../design-system/theme/color.stylex";
import { blue, blueA } from "../design-system/theme/colors/blue.stylex";
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
import { i18next } from "../i18n";

const LinkLink = createLink(Link);

const BLUESKY_ECOSYSTEM_CATEGORY_ID = "apps/bluesky";

export const Route = createFileRoute("/$locale/about")({
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
  head: ({ loaderData, params }) => {
    // `head` runs outside React (no `useTranslation` available). The eager
    // `initI18n()` call in `__root.tsx` guarantees i18next is initialized by
    // the time this fires, so `getFixedT(lng, ns)` is safe and locale-aware.
    const t = i18next.getFixedT(params.locale, "about");
    return {
      ...buildRouteOgMeta({
        title: t("ogTitle"),
        description: t("ogDescription"),
      }),
      links: (loaderData?.preloadHeroImages ?? []).map((href) => ({
        rel: "preload",
        as: "image",
        href,
      })),
    };
  },
  component: AboutPage,
});

const INTRO_FEATURES = [
  { id: "openNetwork", icon: Globe },
  { id: "sharedFoundation", icon: Layers3 },
  { id: "oneAccount", icon: UserRound },
  { id: "alwaysYours", icon: ShieldCheck },
] as const;

const HOW_ATSTORE_WORKS = [
  { id: "listings", icon: Database },
  { id: "claiming", icon: UserCheck },
  { id: "reviews", icon: TrendingUp },
  { id: "categories", icon: Tags },
] as const;

const styles = stylex.create({
  grow: {
    flexBasis: 0,
    flexGrow: 1,
    flexShrink: 0,
    minWidth: 0,
  },
  fit: {
    minWidth: "fit-content",
  },
  shell: {
    fontFamily: fontFamily.sans,
  },
  hero: {
    gap: gap["4xl"],
    alignItems: "center",
    display: "flex",
    flexDirection: "column",
    textAlign: "center",
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
  },
  eyebrow: {
    borderColor: blue.border1,
    borderRadius: radius.full,
    borderStyle: "solid",
    borderWidth: 1,
    gap: gap.sm,
    alignItems: "center",
    backgroundColor: blue.bgSubtle,
    color: blue.text1,
    display: "flex",
    fontFamily: fontFamily.sans,
    fontSize: fontSize.xl,
    fontWeight: fontWeight.medium,
    paddingBottom: verticalSpace["2xl"],
    paddingLeft: horizontalSpace["4xl"],
    paddingRight: horizontalSpace["4xl"],
    paddingTop: verticalSpace["2xl"],
  },
  h1: {
    margin: 0,
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
  },
  heroBody: {
    margin: 0,
    color: uiColor.text1,
    fontFamily: fontFamily.sans,
    fontSize: fontSize["2xl"],
    lineHeight: lineHeight.base,
  },
  sectionGray: {
    borderRadius: radius.lg,
    backgroundColor: uiColor.bgSubtle,
    marginBottom: verticalSpace["6xl"],
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
    paddingTop: {
      default: verticalSpace["2xl"],
      [breakpoints.md]: verticalSpace["11xl"],
    },
  },
  sectionWhite: {
    backgroundColor: uiColor.bg,
    marginBottom: verticalSpace["6xl"],
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
    paddingTop: {
      default: verticalSpace["8xl"],
      [breakpoints.md]: verticalSpace["11xl"],
    },
  },
  sectionEyebrow: {
    color: blue.text1,
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold,
    letterSpacing: tracking.widest,
    textTransform: "uppercase",
    marginBottom: verticalSpace.lg,
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
    marginBottom: 0,
    marginLeft: 0,
    marginRight: 0,
    marginTop: 0,
  },
  sectionBody: {
    margin: 0,
    color: uiColor.text1,
    fontFamily: fontFamily.sans,
    fontSize: {
      default: fontSize.lg,
      [breakpoints.md]: fontSize.xl,
    },
    lineHeight: lineHeight.base,
  },
  proseLink: {
    textDecoration: "underline",
    color: blue.text1,
    fontWeight: fontWeight.medium,
    textUnderlineOffset: 3,
  },
  twoCol: {
    marginLeft: "auto",
    marginRight: "auto",
    maxWidth: "var(--page-content-max-width)",
  },
  cardGrid2: {
    gap: gap.lg,
    display: "grid",
    gridTemplateColumns: {
      default: "1fr",
      [breakpoints.md]: "1fr 1fr",
    },
    minWidth: "min(80vw, 500px)",
  },
  featureCard: {
    borderColor: uiColor.border1,
    borderRadius: radius.md,
    borderStyle: "solid",
    borderWidth: 1,
    gap: {
      default: gap["4xl"],
      [breakpoints.md]: gap["2xl"],
    },
    alignItems: {
      default: "center",
      [breakpoints.md]: "flex-start",
    },
    backgroundColor: uiColor.bg,
    boxShadow: shadow.lg,
    boxSizing: "border-box",
    display: "flex",
    flexBasis: 0,
    flexDirection: {
      default: "row",
      [breakpoints.md]: "column",
    },
    flexGrow: 1,
    flexShrink: 0,
    minHeight: verticalSpace["12xl"],
    minWidth: 280,
    paddingBottom: verticalSpace["4xl"],
    paddingLeft: horizontalSpace["4xl"],
    paddingRight: horizontalSpace["4xl"],
    paddingTop: verticalSpace["4xl"],
  },
  featureTitle: {
    margin: 0,
    color: uiColor.text2,
    fontFamily: fontFamily.title,
    fontSize: fontSize.xl,
    fontWeight: fontWeight.semibold,
    lineHeight: lineHeight.sm,
  },
  featureTitleRow: {
    gap: gap.md,
    alignItems: "center",
    display: "flex",
  },
  featureIcon: {
    borderColor: uiColor.border1,
    borderRadius: radius.sm,
    borderStyle: "solid",
    borderWidth: 1,
    alignItems: "center",
    backgroundColor: uiColor.bgSubtle,
    color: blue.text1,
    display: "inline-flex",
    flexShrink: 0,
    justifyContent: "center",
    height: size["4xl"],
    width: size["4xl"],
  },
  featureBody: {
    color: uiColor.text1,
    fontFamily: fontFamily.sans,
    fontSize: fontSize.base,
    lineHeight: lineHeight.base,
    marginBottom: 0,
    marginLeft: 0,
    marginRight: 0,
    marginTop: 0,
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
    borderColor: blue.border1,
    borderRadius: radius.full,
    borderStyle: "solid",
    borderWidth: 1,
    backgroundColor: blueA.component1,
    color: blue.text2,
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold,
    letterSpacing: tracking.widest,
    textTransform: "uppercase",
    marginBottom: verticalSpace.lg,
    marginLeft: "auto",
    marginRight: "auto",
    paddingBottom: verticalSpace.sm,
    paddingLeft: horizontalSpace.xl,
    paddingRight: horizontalSpace.xl,
    paddingTop: verticalSpace.sm,
    width: "fit-content",
  },
  appBrowserDescription: {
    margin: 0,
    color: uiColor.text1,
    fontFamily: fontFamily.sans,
    fontSize: fontSize.lg,
    lineHeight: lineHeight.base,
    marginLeft: "auto",
    marginRight: "auto",
    maxWidth: "56ch",
  },
  callout: {
    borderRadius: radius.lg,
    gap: gap["6xl"],
    backgroundColor: uiColor.bgSubtle,
    display: "flex",
    flexDirection: "column",
    marginBottom: verticalSpace["6xl"],
    marginLeft: "auto",
    marginRight: "auto",
    maxWidth: "var(--page-content-max-width)",
    paddingBottom: verticalSpace["3xl"],
    paddingLeft: horizontalSpace["3xl"],
    paddingRight: horizontalSpace["3xl"],
    paddingTop: verticalSpace["3xl"],
    width: "100%",
  },
  calloutStack: {
    gap: verticalSpace["6xl"],
    display: "flex",
    flexDirection: "column",
  },
  calloutBody: {
    margin: 0,
    gap: gap["2xl"],
    color: uiColor.text1,
    display: "flex",
    flexDirection: "column",
    fontFamily: fontFamily.sans,
    fontSize: fontSize.base,
    justifyContent: "space-between",
    lineHeight: lineHeight.base,
  },
});

function AboutPage() {
  const { t } = useTranslation("about");
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
            <h1 {...stylex.props(styles.h1)}>{t("heroTitle")}</h1>
            <p {...stylex.props(styles.heroBody)}>{t("heroBody")}</p>
          </div>
        </Flex>
      </Page.Hero>

      <Page.Hero style={styles.sectionGray}>
        <Flex direction="column" gap="2xl" style={styles.twoCol}>
          <Flex direction="column" gap="2xl">
            <Flex direction="column" gap="md">
              <div {...stylex.props(styles.sectionEyebrow)}>
                {t("atmosphereSection.eyebrow")}
              </div>
              <h2 {...stylex.props(styles.sectionHeading)}>
                {t("atmosphereSection.title")}
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
                {t("atmosphereSection.para1")}
              </p>
              <p {...stylex.props(styles.sectionBody)}>
                {t("atmosphereSection.para2")}
              </p>
            </Flex>
            <div {...stylex.props(styles.grow, styles.fit)}>
              <div {...stylex.props(styles.cardGrid2, styles.grow)}>
                {INTRO_FEATURES.map((item) => (
                  <article key={item.id} {...stylex.props(styles.featureCard)}>
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
                          {t(`introFeatures.${item.id}.title`)}
                        </Text>
                      </div>
                      <Text size="base" style={styles.featureBody}>
                        {t(`introFeatures.${item.id}.subtitle`)}
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
              {t("howSection.eyebrow")}
            </div>
            <h2 {...stylex.props(styles.sectionHeading)}>
              {t("howSection.title")}
            </h2>
            <p {...stylex.props(styles.appBrowserDescription)}>
              {t("howSection.description")}
            </p>
          </Flex>
          <Flex gap="lg" wrap>
            {HOW_ATSTORE_WORKS.map((item) => (
              <article key={item.id} {...stylex.props(styles.featureCard)}>
                <span {...stylex.props(styles.featureIcon)}>
                  <item.icon size={20} />
                </span>
                <Flex direction="column" gap="md">
                  <div {...stylex.props(styles.featureTitleRow)}>
                    <h3 {...stylex.props(styles.featureTitle)}>
                      {t(`howSection.items.${item.id}.title`)}
                    </h3>
                  </div>
                  <p {...stylex.props(styles.featureBody)}>
                    {t(`howSection.items.${item.id}.body`)}
                  </p>
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
              <div {...stylex.props(styles.sectionEyebrow)}>
                {t("peopleSection.eyebrow")}
              </div>
              <h2 {...stylex.props(styles.sectionHeading)}>
                {t("peopleSection.title")}
              </h2>
            </Flex>
            <p {...stylex.props(styles.sectionBody)}>
              <Trans
                ns="about"
                i18nKey="peopleSection.builtBy"
                components={{
                  builderLink: (
                    <Link
                      href="https://github.com/hipstersmoothie"
                      target="_blank"
                      rel="noreferrer"
                      style={styles.proseLink}
                    >
                      {""}
                    </Link>
                  ),
                }}
              />
            </p>
            <p {...stylex.props(styles.sectionBody)}>
              <Trans
                ns="about"
                i18nKey="peopleSection.maintained"
                components={{
                  communityLink: (
                    <Link
                      href="https://discourse.atprotocol.community"
                      target="_blank"
                      rel="noreferrer"
                      style={styles.proseLink}
                    >
                      {""}
                    </Link>
                  ),
                }}
              />
            </p>
          </Flex>

          <div {...stylex.props(styles.callout)}>
            <Text size="3xl" weight="bold">
              {t("getInTouch.heading")}
            </Text>
            <div {...stylex.props(styles.calloutStack)}>
              <p {...stylex.props(styles.calloutBody)}>
                <Text weight="bold">{t("getInTouch.manage.label")}</Text>
                <Text size="base">
                  <Trans
                    ns="about"
                    i18nKey="getInTouch.manage.body"
                    components={{
                      manageLink: (
                        <LinkLink
                          to="/products/manage"
                          style={styles.proseLink}
                        >
                          {""}
                        </LinkLink>
                      ),
                    }}
                  />
                </Text>
              </p>
              <p {...stylex.props(styles.calloutBody)}>
                <Text weight="bold">{t("getInTouch.bluesky.label")}</Text>
                <Text size="base">
                  <Trans
                    ns="about"
                    i18nKey="getInTouch.bluesky.body"
                    components={{
                      blueskyLink: (
                        <Link
                          href="https://bsky.app/profile/atstore.fyi"
                          target="_blank"
                          rel="noreferrer"
                          style={styles.proseLink}
                        >
                          {""}
                        </Link>
                      ),
                    }}
                  />
                </Text>
              </p>
              <p {...stylex.props(styles.calloutBody)}>
                <Text weight="bold">{t("getInTouch.openSource.label")}</Text>
                <Text size="base">
                  <Trans
                    ns="about"
                    i18nKey="getInTouch.openSource.body"
                    components={{
                      githubLink: (
                        <Link
                          href="https://github.com/ATProtocol-Community/ATStore"
                          target="_blank"
                          rel="noreferrer"
                          style={styles.proseLink}
                        >
                          {""}
                        </Link>
                      ),
                    }}
                  />
                </Text>
              </p>
              <p {...stylex.props(styles.calloutBody)}>
                <Text weight="bold">{t("getInTouch.community.label")}</Text>
                <Text size="base">
                  <Trans
                    ns="about"
                    i18nKey="getInTouch.community.body"
                    components={{
                      communityLink: (
                        <Link
                          href="https://discourse.atprotocol.community"
                          target="_blank"
                          rel="noreferrer"
                          style={styles.proseLink}
                        >
                          {""}
                        </Link>
                      ),
                    }}
                  />
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

function getGroupHeroPreloadImagesFromEcosystem(
  apps: Array<DirectoryListingCard>,
) {
  const heroUrls = new Set<string>();

  for (const app of apps.slice(0, 12)) {
    if (app.heroImageUrl) {
      heroUrls.add(app.heroImageUrl);
    }
  }

  return [...heroUrls];
}
