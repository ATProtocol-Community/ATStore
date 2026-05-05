import * as stylex from "@stylexjs/stylex";
import { useSuspenseQuery } from "@tanstack/react-query";
import {
  Link as RouterLink,
  createFileRoute,
  createLink,
} from "@tanstack/react-router";
import { ChevronLeft, ChevronRight, ExternalLink } from "lucide-react";
import { useMemo } from "react";

import type { DirectoryOAuthLexiconClusterSummary } from "../integrations/tanstack-query/api-directory-listings.functions";

import { AppTagHero } from "../components/AppTagHero";
import { Card } from "../design-system/card";
import {
  Disclosure,
  DisclosurePanel,
  DisclosureTitle,
} from "../design-system/disclosure";
import { Flex } from "../design-system/flex";
import { Grid } from "../design-system/grid";
import { Link } from "../design-system/link";
import { Page } from "../design-system/page";
import { breakpoints } from "../design-system/theme/media-queries.stylex";
import {
  gap,
  verticalSpace,
} from "../design-system/theme/semantic-spacing.stylex";
import { Body, SmallBody } from "../design-system/typography";
import { Text } from "../design-system/typography/text";
import { directoryListingApi } from "../integrations/tanstack-query/api-directory-listings.functions";
import { getLexiconProducerSiteFromRepoNsid } from "../lib/lexicon-producer-site";
import {
  compareOAuthLexiconKeysForDisplayOrder,
  formatOAuthLexiconKeyHeadline,
  parseOAuthLexiconKey,
  stringifyLexiconClusterSearchParam,
} from "../lib/oauth-scope-lexicon-keys";
import { buildRouteOgMeta } from "../lib/og-meta";

const OTHER_GROUP_KEY = "zz-other";

const LinkLink = createLink(Link);

const styles = stylex.create({
  grow: {
    flexGrow: 1,
  },
  page: {
    paddingBottom: verticalSpace["10xl"],
    paddingTop: verticalSpace["6xl"],
  },
  navLinks: {
    flexWrap: "wrap",
  },
  grid: {
    gap: gap["2xl"],
    display: "grid",
    gridTemplateColumns: {
      default: "repeat(1, minmax(0, 1fr))",
      [breakpoints.sm]: "repeat(2, minmax(0, 1fr))",
      [breakpoints.lg]: "repeat(3, minmax(0, 1fr))",
    },
  },
  cardLink: {
    textDecoration: "none",
    color: "inherit",
    display: "block",
    height: "100%",
  },
  card: {
    height: "100%",
  },
  cardInner: {
    gap: gap["2xl"],
    height: "100%",
    paddingBottom: verticalSpace["2xl"],
    paddingLeft: verticalSpace["3xl"],
    paddingRight: verticalSpace["3xl"],
    paddingTop: verticalSpace["2xl"],
  },
  emptyState: {
    gap: gap["lg"],
    maxWidth: "40rem",
  },
  cardTitleText: {
    wordBreak: "break-word",
  },
  keyDescription: {
    // oxlint-disable-next-line @stylexjs/valid-styles
    lineClamp: 3,
    overflow: "hidden",
    WebkitBoxOrient: "vertical",
    WebkitLineClamp: 3,
    display: "-webkit-box",
  },
  siteSection: {
    width: "100%",
  },
  disclosureTitleInner: {
    gap: gap.md,
    alignItems: "center",
    display: "flex",
    flexBasis: "0%",
    flexGrow: 1,
    flexShrink: 1,
    textAlign: "start",
    minWidth: 0,
  },
  siteExternalLink: {
    display: "inline-flex",
    flexShrink: 0,
  },
  siteHeadingLink: {
    gap: gap.sm,
    textDecoration: "none",
    alignItems: "center",
    color: "inherit",
    display: "inline-flex",
  },
});

export const Route = createFileRoute("/_header-layout/apps/lexicons")({
  loader: ({ context }) =>
    context.queryClient.ensureQueryData(
      directoryListingApi.getAppsOAuthLexiconSummariesQueryOptions,
    ),
  head: () =>
    buildRouteOgMeta({
      title: "OAuth lexicon collections | at-store",
      description:
        "Browse verified apps that share repo record collection lexicons from OAuth scopes.",
    }),
  component: AppsLexiconsHubPage,
});

function formatLexiconCount(n: number) {
  return `${String(n)} app${n === 1 ? "" : "s"}`;
}

function clusterProducerSection(cluster: DirectoryOAuthLexiconClusterSummary): {
  groupKey: string;
  siteLabel: string;
  siteOrigin: string;
} {
  const sites = cluster.keys
    .map((k) => {
      const p = parseOAuthLexiconKey(k);
      if (!p || p.kind !== "repo") {
        return null;
      }
      return getLexiconProducerSiteFromRepoNsid(p.nsid);
    })
    .filter((x): x is NonNullable<typeof x> => x != null);
  if (sites.length === 0) {
    return { groupKey: OTHER_GROUP_KEY, siteLabel: "Other", siteOrigin: "" };
  }
  return sites.toSorted((a, b) => a.groupKey.localeCompare(b.groupKey))[0];
}

function LexiconClusterHubCard({
  row,
  descriptionsByRepoNsid,
}: {
  row: DirectoryOAuthLexiconClusterSummary;
  descriptionsByRepoNsid: Record<string, string>;
}) {
  const c = stringifyLexiconClusterSearchParam(row.keys);

  return (
    <RouterLink
      to="/apps/lexicon-set"
      search={{ c, sort: "popular" }}
      {...stylex.props(styles.cardLink)}
    >
      <Card style={styles.card}>
        <Flex direction="column" style={styles.cardInner}>
          <Flex align="start" justify="between" style={styles.grow}>
            <Flex direction="column" gap="4xl">
              {row.keys.map((key) => {
                const parsed = parseOAuthLexiconKey(key);
                const nsid = parsed?.nsid;
                const desc =
                  nsid != null && nsid.length > 0
                    ? descriptionsByRepoNsid[nsid]
                    : undefined;
                return (
                  <Flex
                    key={key}
                    direction="column"
                    gap="3xl"
                    style={styles.grow}
                  >
                    <Text weight="semibold" style={styles.cardTitleText}>
                      {formatOAuthLexiconKeyHeadline(key)}
                    </Text>
                    {desc ? (
                      <Text
                        size="sm"
                        variant="secondary"
                        style={styles.keyDescription}
                        leading="sm"
                      >
                        {desc}
                      </Text>
                    ) : null}
                  </Flex>
                );
              })}
            </Flex>
            <ChevronRight size={20} aria-hidden style={{ flexShrink: 0 }} />
          </Flex>
          <SmallBody variant="secondary">
            {formatLexiconCount(row.appCount)}
          </SmallBody>
        </Flex>
      </Card>
    </RouterLink>
  );
}

type SiteSection = {
  groupKey: string;
  siteLabel: string;
  siteOrigin: string;
  clusters: Array<DirectoryOAuthLexiconClusterSummary>;
};

function AppsLexiconsHubPage() {
  const { data: hub } = useSuspenseQuery(
    directoryListingApi.getAppsOAuthLexiconSummariesQueryOptions,
  );

  const siteSections = useMemo((): Array<SiteSection> => {
    const bucket = new Map<
      string,
      {
        siteLabel: string;
        siteOrigin: string;
        clusters: SiteSection["clusters"];
      }
    >();
    for (const row of hub.clusters) {
      const meta = clusterProducerSection(row);
      let g = bucket.get(meta.groupKey);
      if (!g) {
        g = {
          siteLabel: meta.siteLabel,
          siteOrigin: meta.siteOrigin,
          clusters: [],
        };
        bucket.set(meta.groupKey, g);
      }
      g.clusters.push(row);
    }

    return [...bucket.entries()]
      .map(([groupKey, g]) => {
        g.clusters.sort((c1, c2) => {
          if (c2.appCount !== c1.appCount) return c2.appCount - c1.appCount;
          const ak = c1.keys[0] ?? "";
          const bk = c2.keys[0] ?? "";
          return compareOAuthLexiconKeysForDisplayOrder(ak, bk);
        });
        const uniqueAppCount = new Set(g.clusters.flatMap((c) => c.listingIds))
          .size;
        return { groupKey, g, uniqueAppCount };
      })
      .toSorted((a, b) => {
        if (b.uniqueAppCount !== a.uniqueAppCount) {
          return b.uniqueAppCount - a.uniqueAppCount;
        }
        return a.groupKey.localeCompare(b.groupKey);
      })
      .map(({ groupKey, g }) => ({
        groupKey,
        siteLabel: g.siteLabel,
        siteOrigin: g.siteOrigin,
        clusters: g.clusters,
      }));
  }, [hub.clusters]);

  return (
    <Page.Root variant="large" style={styles.page}>
      <Flex direction="column" gap="6xl">
        <Flex direction="column" gap="4xl">
          <Flex gap="xl" justify="between" style={styles.navLinks}>
            <LinkLink to="/apps/tags">
              <ChevronLeft />
              All tags
            </LinkLink>

            <LinkLink to="/apps/all" search={{ sort: "popular" }}>
              All apps
            </LinkLink>
          </Flex>

          <AppTagHero
            eyebrow="Shared data"
            title="Data types"
            description="Browse groups of apps that use the same data sources, so they can interoperate with each other."
          />
        </Flex>

        {hub.clusters.length > 0 ? (
          <Flex direction="column" gap="md">
            {siteSections.map((section) => (
              <Disclosure
                key={section.groupKey}
                defaultExpanded
                size="lg"
                style={styles.siteSection}
              >
                <DisclosureTitle
                  aria-label={`${section.siteLabel}, ${String(section.clusters.length)} collection group${section.clusters.length === 1 ? "" : "s"}`}
                >
                  <Flex style={styles.disclosureTitleInner}>
                    <Text weight="semibold" size="xl">
                      {section.siteLabel}
                    </Text>
                    {section.siteOrigin ? (
                      <a
                        href={section.siteOrigin}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`Open ${section.siteLabel} (opens in new tab)`}
                        onClick={(e) => {
                          e.stopPropagation();
                        }}
                        onPointerDown={(e) => {
                          e.stopPropagation();
                        }}
                        {...stylex.props(
                          styles.siteHeadingLink,
                          styles.siteExternalLink,
                        )}
                      >
                        <ExternalLink size={18} aria-hidden />
                      </a>
                    ) : null}
                  </Flex>
                </DisclosureTitle>
                <DisclosurePanel>
                  <Grid style={styles.grid}>
                    {section.clusters.map((row) => (
                      <LexiconClusterHubCard
                        key={row.keys.join("\u001F")}
                        row={row}
                        descriptionsByRepoNsid={hub.descriptionsByRepoNsid}
                      />
                    ))}
                  </Grid>
                </DisclosurePanel>
              </Disclosure>
            ))}
          </Flex>
        ) : (
          <Flex direction="column" style={styles.emptyState}>
            <Body variant="secondary">
              No shared repo record lexicon collections yet. Run storefront
              OAuth probes (`listing:oauth-probes-sync`) so we can index scope
              vocabulary—or every `repo:` key may appear on only one app (we
              require two or more listings). This page omits `include:` and
              `rpc:` keys. On product pages, compatible-app matching still omits
              `app.bsky.*` except for the Bluesky client listing.
            </Body>
          </Flex>
        )}
      </Flex>
    </Page.Root>
  );
}
