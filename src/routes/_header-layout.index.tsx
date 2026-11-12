import * as stylex from "@stylexjs/stylex";
import { useSuspenseQuery } from "@tanstack/react-query";
import {
  Link as RouterLink,
  createFileRoute,
  createLink,
  useNavigate,
} from "@tanstack/react-router";
import { ArrowRight, ArrowUpRight } from "lucide-react";

import type {
  DirectoryHomeDataProducer,
  DirectoryHomeEcosystemBranch,
  DirectoryHomePageData,
} from "../integrations/tanstack-query/api-directory-listings.functions";

import { formatTimeAgo } from "../components/shelf/format";
import { GameCoverCard } from "../components/shelf/GameCoverCard";
import { IconStack } from "../components/shelf/IconStack";
import { ListingCard } from "../components/shelf/ListingCard";
import { ListingIcon } from "../components/shelf/ListingIcon";
import { ListingRating } from "../components/shelf/ListingRating";
import { ListingRow } from "../components/shelf/ListingRow";
import {
  MoreLink,
  SectionHeader,
  ShelfSection,
} from "../components/shelf/Section";
import { Alert } from "../design-system/alert";
import { Button } from "../design-system/button";
import { animationDuration } from "../design-system/theme/animations.stylex";
import { uiColor } from "../design-system/theme/color.stylex";
import { breakpoints } from "../design-system/theme/media-queries.stylex";
import { shadow } from "../design-system/theme/shadow.stylex";
import {
  fontFamily,
  fontWeight,
} from "../design-system/theme/typography.stylex";
import { directoryListingApi } from "../integrations/tanstack-query/api-directory-listings.functions";
import { formatAppTagLabel, getAppTagSlug } from "../lib/app-tag-metadata";
import { getDirectoryListingSlug } from "../lib/directory-listing-slugs";
import { buildRouteOgMeta } from "../lib/og-meta";

export const Route = createFileRoute("/_header-layout/")({
  loader: async ({ context }) => {
    await Promise.all([
      context.queryClient.ensureQueryData(
        directoryListingApi.getHomePageQueryOptions,
      ),
      context.queryClient.ensureQueryData(
        directoryListingApi.getProductClaimEligibilityQueryOptions(),
      ),
    ]);
  },
  head: () =>
    buildRouteOgMeta({
      title: "at-store | Apps on the Atmosphere",
      description:
        "Discover apps and tools across the Atmosphere. Find your next favorite app today!",
    }),
  component: HomePage,
});

const ButtonLink = createLink(Button);

const ACCENT = "light-dark(#1c4ef5, #7b97ff)";

const styles = stylex.create({
  root: {
    color: uiColor.text2,
    fontFamily: fontFamily.sans,
  },
  claimBanner: {
    paddingTop: { default: 20, [breakpoints.md]: 32 },
  },
  intro: {
    alignItems: "end",
    columnGap: 48,
    display: "grid",
    gridTemplateColumns: {
      default: "minmax(0, 1fr)",
      [breakpoints.lg]: "1.3fr 1fr",
    },
    rowGap: 16,
    paddingBottom: { default: 28, [breakpoints.md]: 56 },
    paddingTop: { default: 36, [breakpoints.md]: 80 },
  },
  introTitle: {
    margin: 0,
    color: uiColor.text2,
    fontFamily: fontFamily.title,
    fontSize: {
      default: 48,
      [breakpoints.md]: 68,
      [breakpoints.xl]: 84,
    },
    fontWeight: 750,
    letterSpacing: "-0.029em",
    lineHeight: 0.94,
    textWrap: "balance",
  },
  introAccent: {
    color: ACCENT,
  },
  introLede: {
    color: uiColor.text2,
    fontSize: { default: 17, [breakpoints.md]: 19 },
    lineHeight: 1.5,
    textWrap: "pretty",
    marginBottom: 6,
    marginTop: 0,
    maxWidth: "28em",
  },
  feature: {
    alignItems: "center",
    columnGap: 48,
    display: "grid",
    gridTemplateColumns: {
      default: "minmax(0, 1fr)",
      [breakpoints.lg]: "1.45fr 1fr",
    },
    rowGap: 20,
    paddingBottom: { default: 48, [breakpoints.md]: 80 },
  },
  featureFrame: {
    borderRadius: { default: 16, [breakpoints.md]: 22 },
    overflow: "hidden",
    aspectRatio: "16 / 9",
    backgroundColor: uiColor.component1,
    boxShadow: shadow.md,
    display: "block",
    outlineColor: uiColor.text2,
    outlineOffset: 3,
    outlineStyle: { default: "none", ":focus-visible": "solid" },
    outlineWidth: 2,
    position: "relative",
    "::after": {
      inset: 0,
      borderRadius: "inherit",
      boxShadow: `inset 0 0 0 1px ${uiColor.border1}`,
      content: "''",
      pointerEvents: "none",
      position: "absolute",
    },
  },
  featureImage: {
    display: "block",
    objectFit: "cover",
    transform: {
      default: null,
      [stylex.when.ancestor(":hover")]: "scale(1.015)",
    },
    transitionDuration: "0.5s",
    transitionProperty: "transform",
    transitionTimingFunction: "cubic-bezier(.2, .7, .2, 1)",
    height: "100%",
    width: "100%",
  },
  eyebrow: {
    color: uiColor.text1,
    fontSize: 12,
    fontWeight: fontWeight.semibold,
    letterSpacing: "0.12em",
    textTransform: "uppercase",
  },
  featureIdentity: {
    alignItems: "center",
    columnGap: 14,
    display: "flex",
    rowGap: 14,
    marginTop: { default: 16, [breakpoints.md]: 22 },
  },
  meta: {
    alignItems: "center",
    color: uiColor.text1,
    columnGap: 10,
    display: "flex",
    flexWrap: "wrap",
    fontSize: 14,
    rowGap: 6,
    minWidth: 0,
  },
  metaDot: {
    borderRadius: "50%",
    backgroundColor: "currentColor",
    opacity: 0.5,
    height: 3,
    width: 3,
  },
  featureName: {
    color: uiColor.text2,
    fontFamily: fontFamily.title,
    fontSize: { default: 38, [breakpoints.md]: 54 },
    fontWeight: 750,
    letterSpacing: "-0.026em",
    lineHeight: 1,
    textWrap: "balance",
    marginBottom: 10,
    marginTop: { default: 14, [breakpoints.md]: 20 },
  },
  featureTagline: {
    color: uiColor.text2,
    fontSize: { default: 18, [breakpoints.md]: 21 },
    letterSpacing: "-0.006em",
    lineHeight: 1.35,
    marginBottom: 14,
    marginTop: 0,
  },
  featureDescription: {
    overflow: "hidden",
    WebkitBoxOrient: "vertical",
    WebkitLineClamp: 3,
    color: uiColor.text1,
    display: "-webkit-box",
    fontSize: 15,
    lineHeight: 1.55,
    marginBottom: 28,
    marginTop: 0,
  },
  featureActions: {
    alignItems: "center",
    columnGap: 10,
    display: "flex",
    flexWrap: "wrap",
    rowGap: 10,
  },
  featureAction: {
    flexBasis: { default: 0, [breakpoints.sm]: "auto" },
    flexGrow: { default: 1, [breakpoints.sm]: 0 },
  },
  plainList: {
    margin: 0,
    padding: 0,
    listStyle: "none",
  },
  twoColumns: {
    columnGap: 48,
    display: "grid",
    gridTemplateColumns: {
      default: "minmax(0, 1fr)",
      [breakpoints.md]: "repeat(2, minmax(0, 1fr))",
    },
  },
  tags: {
    alignItems: "baseline",
    columnGap: { default: 16, [breakpoints.md]: 26 },
    display: "flex",
    flexWrap: "wrap",
    fontFamily: fontFamily.title,
    fontSize: { default: 28, [breakpoints.md]: 42 },
    fontWeight: 650,
    letterSpacing: "-0.023em",
    lineHeight: 1.2,
    rowGap: 2,
  },
  tagLink: {
    textDecoration: "none",
    color: {
      default: uiColor.text2,
      ":hover": ACCENT,
    },
    transitionDuration: animationDuration.default,
    transitionProperty: "color",
  },
  tagCount: {
    color: uiColor.text1,
    fontFamily: fontFamily.sans,
    fontSize: 13,
    fontVariantNumeric: "tabular-nums",
    fontWeight: fontWeight.medium,
    letterSpacing: 0,
    verticalAlign: "super",
    marginLeft: 4,
  },
  tagMore: {
    textDecoration: "none",
    alignItems: "center",
    color: {
      default: uiColor.text1,
      ":hover": uiColor.text2,
    },
    columnGap: 4,
    display: "inline-flex",
    fontFamily: fontFamily.sans,
    fontSize: 17,
    fontWeight: fontWeight.medium,
    letterSpacing: "-0.006em",
    whiteSpace: "nowrap",
  },
  // The strip clips its cells' leading and top borders so only the hairlines
  // *between* cells show, whatever the column count.
  ecoStrip: {
    overflow: "hidden",
    borderTopColor: uiColor.border2,
    borderTopStyle: "solid",
    borderTopWidth: 1,
  },
  ecoGrid: {
    display: "grid",
    gridTemplateColumns: {
      default: "repeat(2, minmax(0, 1fr))",
      [breakpoints.md]: "repeat(3, minmax(0, 1fr))",
      [breakpoints.lg]: "repeat(6, minmax(0, 1fr))",
    },
    marginLeft: -17,
    marginTop: -1,
  },
  ecoItem: {
    display: "flex",
    minWidth: 0,
  },
  ecoCell: {
    paddingBlock: 20,
    paddingInline: 16,
    textDecoration: "none",
    color: "inherit",
    columnGap: 12,
    display: "flex",
    flexDirection: "column",
    outlineColor: uiColor.text2,
    outlineOffset: -4,
    outlineStyle: { default: "none", ":focus-visible": "solid" },
    outlineWidth: 2,
    rowGap: 12,
    borderLeftColor: uiColor.border1,
    borderLeftStyle: "solid",
    borderLeftWidth: 1,
    borderTopColor: uiColor.border1,
    borderTopStyle: "solid",
    borderTopWidth: 1,
    minWidth: 0,
  },
  ecoName: {
    color: {
      default: uiColor.text2,
      [stylex.when.ancestor(":hover")]: ACCENT,
    },
    fontFamily: fontFamily.title,
    fontSize: 20,
    fontWeight: fontWeight.bold,
    letterSpacing: "-0.017em",
    transitionDuration: animationDuration.default,
    transitionProperty: "color",
  },
  ecoCount: {
    color: uiColor.text1,
    fontSize: 13,
    fontVariantNumeric: "tabular-nums",
    marginTop: -8,
  },
  cards: {
    marginInline: { default: -20, [breakpoints.md]: 0 },
    paddingInline: { default: 20, [breakpoints.md]: 0 },
    scrollPaddingInline: 20,
    scrollSnapType: { default: "x mandatory", [breakpoints.md]: "none" },
    columnGap: 16,
    display: { default: "flex", [breakpoints.md]: "grid" },
    gridTemplateColumns: {
      default: null,
      [breakpoints.md]: "repeat(2, minmax(0, 1fr))",
      [breakpoints.lg]: "repeat(4, minmax(0, 1fr))",
    },
    rowGap: 16,
    scrollbarWidth: "none",
    overflowX: { default: "auto", [breakpoints.md]: "visible" },
    paddingBottom: { default: 8, [breakpoints.md]: 0 },
    paddingTop: { default: 2, [breakpoints.md]: 0 },
  },
  cardItem: {
    display: "flex",
    flexBasis: { default: "72%", [breakpoints.md]: "auto" },
    flexShrink: 0,
    scrollSnapAlign: "start",
    minWidth: 0,
  },
  cardItemInner: {
    flexGrow: 1,
  },
  games: {
    columnGap: { default: 12, [breakpoints.md]: 16 },
    display: "grid",
    gridTemplateColumns: {
      default: "repeat(2, minmax(0, 1fr))",
      [breakpoints.lg]: "repeat(4, minmax(0, 1fr))",
    },
    rowGap: { default: 18, [breakpoints.md]: 24 },
  },
  dataRow: {
    borderRadius: 10,
    marginInline: -12,
    paddingBlock: 14,
    paddingInline: 12,
    textDecoration: "none",
    alignItems: "center",
    backgroundColor: {
      default: "transparent",
      ":hover": uiColor.component1,
    },
    color: "inherit",
    columnGap: 16,
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) auto auto",
    outlineColor: uiColor.text2,
    outlineOffset: 2,
    outlineStyle: { default: "none", ":focus-visible": "solid" },
    outlineWidth: 2,
    position: "relative",
    transitionDuration: animationDuration.default,
    transitionProperty: "background-color",
    "::before": {
      insetInline: 12,
      backgroundColor: uiColor.border1,
      content: "''",
      position: "absolute",
      height: 1,
      top: 0,
    },
  },
  dataKey: {
    overflow: "hidden",
    color: uiColor.text2,
    fontFamily: fontFamily.mono,
    fontSize: 14,
    fontWeight: fontWeight.medium,
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  dataCount: {
    color: uiColor.text1,
    fontSize: 14,
    fontVariantNumeric: "tabular-nums",
    textAlign: "right",
    minWidth: 64,
  },
});

function HomePage() {
  const navigate = useNavigate();
  const { data } = useSuspenseQuery(
    directoryListingApi.getHomePageQueryOptions,
  );
  const { data: claimEligibility } = useSuspenseQuery(
    directoryListingApi.getProductClaimEligibilityQueryOptions(),
  );

  const showClaimBanner =
    claimEligibility.eligible && claimEligibility.listings.length > 0;
  const claimCount = claimEligibility.listings.length;

  return (
    <div {...stylex.props(styles.root)}>
      {showClaimBanner ? (
        <div {...stylex.props(styles.claimBanner)}>
          <Alert
            variant="info"
            title={
              claimCount === 1 ? "Claim your listing" : "Claim your listings"
            }
            action={
              <Button
                variant="primary"
                size="sm"
                onPress={() => void navigate({ to: "/product/claim" })}
              >
                Continue
              </Button>
            }
          >
            {claimCount === 1
              ? `“${(claimEligibility.listings[0]?.name ?? "").trim() || "Listing"}” is still on the store repo. Claim it to manage updates from your PDS.`
              : `You have ${String(claimCount)} listings on the store repo. Claim them to manage updates from your PDS.`}
          </Alert>
        </div>
      ) : null}

      <header {...stylex.props(styles.intro)}>
        <h1 {...stylex.props(styles.introTitle)}>
          Apps on the{" "}
          <span {...stylex.props(styles.introAccent)}>Atmosphere</span>
        </h1>
        <p {...stylex.props(styles.introLede)}>
          {`${formatCount(data.stats.apps)} apps and ${formatCount(data.stats.games)} games`}{" "}
          that share one identity and let you take your data with you.
        </p>
      </header>

      <FeaturedListing listing={data.featured} />

      <ShelfSection>
        <SectionHeader
          title="Popular right now"
          action={<MoreLink to="/apps">All apps</MoreLink>}
        />
        <ol role="list" {...stylex.props(styles.plainList, styles.twoColumns)}>
          {data.popular.map((listing, index) => (
            <li key={listing.id}>
              <ListingRow
                listing={listing}
                rank={index + 1}
                variant="compact"
              />
            </li>
          ))}
        </ol>
      </ShelfSection>

      <ShelfSection>
        <SectionHeader
          title="Browse by interest"
          action={<MoreLink to="/apps/tags">All tags</MoreLink>}
        />
        <TagCloud tags={data.tags} total={data.tagCount} />
      </ShelfSection>

      {data.blueskyEcosystem.branches.length > 0 ? (
        <ShelfSection>
          <SectionHeader
            title="The Bluesky ecosystem"
            description="Clients, analytics, schedulers and feeds built on top of Bluesky."
            action={
              <MoreLink to="/ecosystems/$app" params={{ app: "bluesky" }}>
                {`All ${formatCount(data.blueskyEcosystem.total)} tools`}
              </MoreLink>
            }
          />
          <EcosystemStrip branches={data.blueskyEcosystem.branches} />
        </ShelfSection>
      ) : null}

      <ShelfSection>
        <SectionHeader
          title="Just added"
          action={
            <MoreLink to="/apps" search={{ sort: "newest" }}>
              Newest
            </MoreLink>
          }
        />
        <ul role="list" {...stylex.props(styles.plainList, styles.cards)}>
          {data.fresh.map((listing) => (
            <li key={listing.id} {...stylex.props(styles.cardItem)}>
              <div {...stylex.props(styles.cardItemInner)}>
                <ListingCard
                  listing={listing}
                  meta={`Added ${formatTimeAgo(listing.createdAt)}`}
                />
              </div>
            </li>
          ))}
        </ul>
      </ShelfSection>

      {data.games.length > 0 ? (
        <ShelfSection>
          <SectionHeader
            title="Games"
            action={
              <MoreLink to="/games">
                {`All ${formatCount(data.stats.games)} games`}
              </MoreLink>
            }
          />
          <ul role="list" {...stylex.props(styles.plainList, styles.games)}>
            {data.games.map((listing) => (
              <li key={listing.id}>
                <GameCoverCard listing={listing} />
              </li>
            ))}
          </ul>
        </ShelfSection>
      ) : null}

      {data.dataProducers.length > 0 ? (
        <ShelfSection>
          <SectionHeader
            title="Works with your data"
            description="Apps on the AT Protocol read and write the same records. Find apps that work with the data you already have."
            action={<MoreLink to="/apps/lexicons">Shared data</MoreLink>}
          />
          <ul
            role="list"
            {...stylex.props(styles.plainList, styles.twoColumns)}
          >
            {data.dataProducers.map((producer) => (
              <li key={producer.groupKey}>
                <DataProducerRow producer={producer} />
              </li>
            ))}
          </ul>
        </ShelfSection>
      ) : null}
    </div>
  );
}

function FeaturedListing({
  listing,
}: {
  listing: DirectoryHomePageData["featured"];
}) {
  const productId = getDirectoryListingSlug(listing);
  const tag = listing.appTags[0];
  const handle = listing.productAccountHandle?.replace(/^@/, "");
  const domain = getDomain(listing.externalUrl);
  const description = firstParagraph(listing.description);

  return (
    <section aria-label="Featured" {...stylex.props(styles.feature)}>
      {listing.heroImageUrl ? (
        <RouterLink
          to="/products/$productId"
          params={{ productId }}
          aria-label={listing.name}
          {...stylex.props(styles.featureFrame)}
        >
          <img
            src={listing.heroImageUrl}
            alt=""
            decoding="async"
            {...stylex.props(styles.featureImage)}
          />
        </RouterLink>
      ) : null}
      <div>
        <div {...stylex.props(styles.eyebrow)}>
          {tag ? `Featured · ${formatAppTagLabel(tag)}` : "Featured"}
        </div>
        <div {...stylex.props(styles.featureIdentity)}>
          <ListingIcon name={listing.name} src={listing.iconUrl} size={56} />
          <FeaturedMeta handle={handle} listing={listing} />
        </div>
        <h2 {...stylex.props(styles.featureName)}>{listing.name}</h2>
        <p {...stylex.props(styles.featureTagline)}>{listing.tagline}</p>
        {description && description !== listing.tagline ? (
          <p {...stylex.props(styles.featureDescription)}>{description}</p>
        ) : null}
        <div {...stylex.props(styles.featureActions)}>
          <ButtonLink
            to="/products/$productId"
            params={{ productId }}
            size="lg"
            style={styles.featureAction}
          >
            View app
          </ButtonLink>
          {listing.externalUrl && domain ? (
            <Button
              href={listing.externalUrl}
              target="_blank"
              rel="noopener noreferrer"
              variant="secondary"
              size="lg"
              style={styles.featureAction}
            >
              {`Open ${domain}`}
              <ArrowUpRight size={16} aria-hidden />
            </Button>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function FeaturedMeta({
  handle,
  listing,
}: {
  handle: string | undefined;
  listing: DirectoryHomePageData["featured"];
}) {
  const rating =
    listing.reviewCount > 0 ? (
      <ListingRating
        rating={listing.rating}
        reviewCount={listing.reviewCount}
        showCount
      />
    ) : null;
  if (!handle && !rating) return null;
  return (
    <div {...stylex.props(styles.meta)}>
      {handle ? <span>@{handle}</span> : null}
      {handle && rating ? (
        <span aria-hidden {...stylex.props(styles.metaDot)} />
      ) : null}
      {rating}
    </div>
  );
}

function TagCloud({
  tags,
  total,
}: {
  tags: DirectoryHomePageData["tags"];
  total: number;
}) {
  const remaining = total - tags.length;
  return (
    <div {...stylex.props(styles.tags)}>
      {tags.map(({ tag, count }) => (
        <RouterLink
          key={tag}
          to="/apps"
          search={{ tag: getAppTagSlug(tag) }}
          aria-label={`${formatAppTagLabel(tag)}, ${String(count)} apps`}
          {...stylex.props(styles.tagLink)}
        >
          {formatAppTagLabel(tag)}
          <span aria-hidden {...stylex.props(styles.tagCount)}>
            {count}
          </span>
        </RouterLink>
      ))}
      {remaining > 0 ? (
        <RouterLink to="/apps/tags" {...stylex.props(styles.tagMore)}>
          {`+${String(remaining)} more`}
          <ArrowRight size={15} aria-hidden />
        </RouterLink>
      ) : null}
    </div>
  );
}

function EcosystemStrip({
  branches,
}: {
  branches: Array<DirectoryHomeEcosystemBranch>;
}) {
  return (
    <div {...stylex.props(styles.ecoStrip)}>
      <ul role="list" {...stylex.props(styles.plainList, styles.ecoGrid)}>
        {branches.map((branch) => (
          <li key={branch.id} {...stylex.props(styles.ecoItem)}>
            <RouterLink
              to="/apps"
              search={{ in: branch.id }}
              {...stylex.props(styles.ecoCell, styles.cardItemInner)}
            >
              <IconStack listings={branch.icons} size={28} />
              <span {...stylex.props(styles.ecoName)}>{branch.label}</span>
              <span {...stylex.props(styles.ecoCount)}>
                {formatApps(branch.count)}
              </span>
            </RouterLink>
          </li>
        ))}
      </ul>
    </div>
  );
}

function DataProducerRow({
  producer,
}: {
  producer: DirectoryHomeDataProducer;
}) {
  return (
    <RouterLink
      to="/apps"
      search={{ data: producer.groupKey }}
      aria-label={`Apps that use ${producer.groupKey} data: ${formatApps(producer.count)}`}
      {...stylex.props(styles.dataRow)}
    >
      <span {...stylex.props(styles.dataKey)}>{producer.groupKey}</span>
      <IconStack listings={producer.icons} />
      <span {...stylex.props(styles.dataCount)}>
        {formatApps(producer.count)}
      </span>
    </RouterLink>
  );
}

function formatCount(value: number) {
  return value.toLocaleString("en-US");
}

function formatApps(value: number) {
  return `${formatCount(value)} ${value === 1 ? "app" : "apps"}`;
}

function getDomain(url: string | null) {
  if (!url) return null;
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

function firstParagraph(text: string) {
  return (
    text
      .split("\n")
      .map((line) => line.trim())
      .find(Boolean) ?? ""
  );
}
