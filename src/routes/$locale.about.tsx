import type { DirectoryListingCard } from "#/integrations/tanstack-query/api-directory-listings.functions";
import type { ReactNode } from "react";

import * as stylex from "@stylexjs/stylex";
import { Link as RouterLink, createFileRoute } from "@tanstack/react-router";
import { SiteFooter } from "#/components/SiteFooter";
import { SiteHeader } from "#/components/SiteHeader";
import { HeaderLayout } from "#/design-system/header-layout";
import { directoryListingApi } from "#/integrations/tanstack-query/api-directory-listings.functions";
import { buildRouteOgMeta } from "#/lib/og-meta";
import { Trans, useTranslation } from "react-i18next";

import { Eyebrow } from "../components/shelf/info/InfoBlocks";
import { SectionHeader, ShelfSection } from "../components/shelf/Section";
import { animationDuration } from "../design-system/theme/animations.stylex";
import { uiColor } from "../design-system/theme/color.stylex";
import { breakpoints } from "../design-system/theme/media-queries.stylex";
import {
  fontFamily,
  fontWeight,
} from "../design-system/theme/typography.stylex";
import { i18next } from "../i18n";

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
  "openNetwork",
  "sharedFoundation",
  "oneAccount",
  "alwaysYours",
] as const;

const HOW_ATSTORE_WORKS = [
  "listings",
  "claiming",
  "reviews",
  "categories",
] as const;

const COMMUNITY_URL = "https://discourse.atprotocol.community";

const styles = stylex.create({
  page: {
    fontFamily: fontFamily.sans,
  },
  hero: {
    paddingBottom: { default: 40, [breakpoints.md]: 72 },
    paddingTop: { default: 48, [breakpoints.md]: 96 },
  },
  heroTitle: {
    color: uiColor.text2,
    fontFamily: fontFamily.title,
    fontSize: { default: 48, [breakpoints.md]: 72, [breakpoints.lg]: 88 },
    fontWeight: 750,
    letterSpacing: "-0.055em",
    lineHeight: 0.95,
    textWrap: "balance",
    marginBottom: 20,
    marginTop: 16,
    maxWidth: "11em",
  },
  heroBody: {
    margin: 0,
    color: uiColor.text1,
    fontSize: { default: 18, [breakpoints.md]: 21 },
    lineHeight: 1.45,
  },
  twoCol: {
    gap: { default: 16, [breakpoints.md]: 64 },
    display: "grid",
    gridTemplateColumns: {
      default: "minmax(0, 1fr)",
      [breakpoints.md]: "minmax(0, 1fr) minmax(0, 1.4fr)",
    },
  },
  h2: {
    color: uiColor.text2,
    fontFamily: fontFamily.title,
    fontSize: { default: 30, [breakpoints.md]: 40 },
    fontWeight: fontWeight.bold,
    letterSpacing: "-0.045em",
    lineHeight: 1.05,
    textWrap: "balance",
    marginBottom: 12,
    marginTop: 12,
  },
  sideNote: {
    margin: 0,
    color: uiColor.text1,
    lineHeight: 1.5,
  },
  prose: {
    color: uiColor.text1,
    fontSize: { default: 16, [breakpoints.md]: 18 },
    lineHeight: 1.65,
  },
  proseP: {
    textWrap: "pretty",
    marginBottom: 14,
    marginTop: 0,
  },
  atmosphereSection: {
    paddingBottom: { default: 0, [breakpoints.md]: 0 },
  },
  feat4: {
    padding: 0,
    listStyle: "none",
    display: "grid",
    gridTemplateColumns: {
      default: "repeat(2, minmax(0, 1fr))",
      [breakpoints.lg]: "repeat(4, minmax(0, 1fr))",
    },
    borderTopColor: uiColor.text2,
    borderTopStyle: "solid",
    borderTopWidth: 1,
    marginBottom: 0,
    marginTop: { default: 40, [breakpoints.md]: 72 },
  },
  feat: {
    borderLeftColor: uiColor.border1,
    borderLeftStyle: {
      default: "solid",
      ":nth-child(odd)": "none",
      [breakpoints.lg]: {
        default: "solid",
        ":first-child": "none",
      },
    },
    borderLeftWidth: 1,
    borderTopColor: uiColor.border1,
    borderTopStyle: {
      default: "none",
      ":nth-child(n+3)": "solid",
      [breakpoints.lg]: "none",
    },
    borderTopWidth: 1,
    paddingBottom: 28,
    paddingLeft: {
      default: 20,
      ":nth-child(odd)": 0,
      [breakpoints.lg]: {
        default: 24,
        ":first-child": 0,
      },
    },
    paddingRight: 20,
    paddingTop: 24,
  },
  featNum: {
    color: uiColor.text1,
    fontSize: 13,
    fontVariantNumeric: "tabular-nums",
  },
  featTitle: {
    color: uiColor.text2,
    fontFamily: fontFamily.title,
    fontSize: { default: 19, [breakpoints.md]: 22 },
    fontWeight: fontWeight.bold,
    letterSpacing: "-0.03em",
    marginBottom: 6,
    marginTop: 10,
  },
  featBody: {
    margin: 0,
    color: uiColor.text1,
    lineHeight: 1.5,
  },
  howGrid: {
    columnGap: 40,
    display: "grid",
    gridTemplateColumns: {
      default: "minmax(0, 1fr)",
      [breakpoints.sm]: "repeat(2, minmax(0, 1fr))",
    },
    rowGap: 32,
  },
  howTitle: {
    margin: 0,
    color: uiColor.text2,
    fontSize: 17,
    fontWeight: fontWeight.semibold,
  },
  howBody: {
    color: uiColor.text1,
    lineHeight: 1.55,
    overflowWrap: "anywhere",
    marginBottom: 0,
    marginTop: 8,
  },
  link: {
    textDecoration: "underline",
    color: uiColor.text2,
    textDecorationColor: {
      default: uiColor.border2,
      ":hover": "currentColor",
    },
    textUnderlineOffset: 3,
    transitionDuration: animationDuration.default,
    transitionProperty: "text-decoration-color",
  },
  contactGrid: {
    columnGap: 16,
    display: "grid",
    gridTemplateColumns: {
      default: "minmax(0, 1fr)",
      [breakpoints.sm]: "repeat(2, minmax(0, 1fr))",
      [breakpoints.lg]: "repeat(4, minmax(0, 1fr))",
    },
    rowGap: 16,
  },
  contactCard: {
    padding: 22,
    borderColor: uiColor.border1,
    borderRadius: 18,
    borderStyle: "solid",
    borderWidth: 1,
    backgroundColor: uiColor.bg,
    display: "flex",
    flexDirection: "column",
    rowGap: 8,
  },
  contactTitle: {
    margin: 0,
    color: uiColor.text2,
    fontSize: 16,
    fontWeight: fontWeight.semibold,
  },
  contactBody: {
    margin: 0,
    color: uiColor.text1,
    fontSize: 14,
    lineHeight: 1.55,
  },
});

/** External link; Trans injects the translated text as children. */
function ExternalLink({
  href,
  children,
}: {
  href: string;
  children?: ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      {...stylex.props(styles.link)}
    >
      {children}
    </a>
  );
}

function ManageLink({ children }: { children?: ReactNode }) {
  return (
    <RouterLink to="/products/manage" {...stylex.props(styles.link)}>
      {children}
    </RouterLink>
  );
}

function AboutPage() {
  const { t } = useTranslation("about");

  const contacts = [
    {
      id: "manage",
      components: { manageLink: <ManageLink /> },
    },
    {
      id: "bluesky",
      components: {
        blueskyLink: (
          <ExternalLink href="https://bsky.app/profile/atstore.fyi" />
        ),
      },
    },
    {
      id: "openSource",
      components: {
        githubLink: (
          <ExternalLink href="https://github.com/ATProtocol-Community/ATStore" />
        ),
      },
    },
    {
      id: "community",
      components: { communityLink: <ExternalLink href={COMMUNITY_URL} /> },
    },
  ] as const;

  return (
    <HeaderLayout.Root style={styles.page}>
      <HeaderLayout.Header>
        <SiteHeader />
      </HeaderLayout.Header>

      <HeaderLayout.Page>
        <header {...stylex.props(styles.hero)}>
          <Eyebrow>at-store</Eyebrow>
          <h1 {...stylex.props(styles.heroTitle)}>{t("heroTitle")}</h1>
          <p {...stylex.props(styles.heroBody)}>{t("heroBody")}</p>
        </header>

        <ShelfSection style={styles.atmosphereSection}>
          <div {...stylex.props(styles.twoCol)}>
            <div>
              <Eyebrow>{t("atmosphereSection.eyebrow")}</Eyebrow>
              <h2 {...stylex.props(styles.h2)}>
                {t("atmosphereSection.title")}
              </h2>
            </div>
            <div {...stylex.props(styles.prose)}>
              <p {...stylex.props(styles.proseP)}>
                {t("atmosphereSection.para1")}
              </p>
              <p {...stylex.props(styles.proseP)}>
                {t("atmosphereSection.para2")}
              </p>
            </div>
          </div>
          <ul {...stylex.props(styles.feat4)}>
            {INTRO_FEATURES.map((id, index) => (
              <li key={id} {...stylex.props(styles.feat)}>
                <span {...stylex.props(styles.featNum)}>0{index + 1}</span>
                <h3 {...stylex.props(styles.featTitle)}>
                  {t(`introFeatures.${id}.title`)}
                </h3>
                <p {...stylex.props(styles.featBody)}>
                  {t(`introFeatures.${id}.subtitle`)}
                </p>
              </li>
            ))}
          </ul>
        </ShelfSection>

        <ShelfSection>
          <div {...stylex.props(styles.twoCol)}>
            <div>
              <Eyebrow>{t("howSection.eyebrow")}</Eyebrow>
              <h2 {...stylex.props(styles.h2)}>{t("howSection.title")}</h2>
              <p {...stylex.props(styles.sideNote)}>
                {t("howSection.description")}
              </p>
            </div>
            <div {...stylex.props(styles.howGrid)}>
              {HOW_ATSTORE_WORKS.map((id) => (
                <article key={id}>
                  <h3 {...stylex.props(styles.howTitle)}>
                    {t(`howSection.items.${id}.title`)}
                  </h3>
                  <p {...stylex.props(styles.howBody)}>
                    {t(`howSection.items.${id}.body`)}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </ShelfSection>

        <ShelfSection>
          <div {...stylex.props(styles.twoCol)}>
            <div>
              <Eyebrow>{t("peopleSection.eyebrow")}</Eyebrow>
              <h2 {...stylex.props(styles.h2)}>{t("peopleSection.title")}</h2>
            </div>
            <div {...stylex.props(styles.prose)}>
              <p {...stylex.props(styles.proseP)}>
                <Trans
                  ns="about"
                  i18nKey="peopleSection.builtBy"
                  components={{
                    builderLink: (
                      <ExternalLink href="https://github.com/hipstersmoothie" />
                    ),
                  }}
                />
              </p>
              <p {...stylex.props(styles.proseP)}>
                <Trans
                  ns="about"
                  i18nKey="peopleSection.maintained"
                  components={{
                    communityLink: <ExternalLink href={COMMUNITY_URL} />,
                  }}
                />
              </p>
            </div>
          </div>
        </ShelfSection>

        <ShelfSection>
          <SectionHeader title={t("getInTouch.heading")} />
          <div {...stylex.props(styles.contactGrid)}>
            {contacts.map((contact) => (
              <article key={contact.id} {...stylex.props(styles.contactCard)}>
                <h3 {...stylex.props(styles.contactTitle)}>
                  {t(`getInTouch.${contact.id}.label`)}
                </h3>
                <p {...stylex.props(styles.contactBody)}>
                  <Trans
                    ns="about"
                    i18nKey={`getInTouch.${contact.id}.body`}
                    components={contact.components}
                  />
                </p>
              </article>
            ))}
          </div>
        </ShelfSection>
      </HeaderLayout.Page>

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
