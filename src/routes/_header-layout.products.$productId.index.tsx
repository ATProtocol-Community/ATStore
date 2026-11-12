import * as stylex from "@stylexjs/stylex";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createFileRoute,
  createLink,
  notFound,
  redirect,
  useRouter,
} from "@tanstack/react-router";
import { Pencil } from "lucide-react";

import type {
  DirectoryListingCard,
  DirectoryListingDetail,
  DirectoryListingProductUpdate,
} from "../integrations/tanstack-query/api-directory-listings.functions";
import type { DirectoryCategoryTreeNode } from "../lib/directory-categories";
import type { StoreListingPageSnapshotPayload } from "../lib/listing-page-snapshot.types";

import { BlueskyMentionCard } from "../components/BlueskyMentionCard";
import { EcosystemCategoryCard } from "../components/EcosystemCategoryCard";
import { GameDetailsPanel } from "../components/GameDetailsPanel";
import { HeroImage } from "../components/HeroImage";
import { RejectGameDialog } from "../components/RejectGameDialog";
import { ExpandableDescription } from "../components/shelf/listing/ExpandableDescription";
import { getEcosystemCategorySlug } from "../components/shelf/listing/listing-helpers";
import { ListingHeader } from "../components/shelf/listing/ListingHeader";
import {
  BlockHeading,
  Breadcrumbs,
  Crumb,
  CurrentCrumb,
  MoreExternalLink,
} from "../components/shelf/listing/ListingParts";
import { ListingReviewsBlock } from "../components/shelf/listing/ListingReviewsBlock";
import { ListingSidebar } from "../components/shelf/listing/ListingSidebar";
import { ScreenshotGallery } from "../components/shelf/listing/ScreenshotGallery";
import { ListingCard } from "../components/shelf/ListingCard";
import {
  MoreLink,
  SectionHeader,
  ShelfSection,
} from "../components/shelf/Section";
import { Button } from "../design-system/button";
import { animationDuration } from "../design-system/theme/animations.stylex";
import { uiColor } from "../design-system/theme/color.stylex";
import { breakpoints } from "../design-system/theme/media-queries.stylex";
import { shadow } from "../design-system/theme/shadow.stylex";
import { fontWeight } from "../design-system/theme/typography.stylex";
import { directoryListingApi } from "../integrations/tanstack-query/api-directory-listings.functions";
import { user } from "../integrations/tanstack-query/api-user.functions";
import {
  formatAppTagLabel,
  getAppTagLinkOptions,
} from "../lib/app-tag-metadata";
import {
  getAppSegmentFromEcosystemRootCategoryId,
  getDirectoryCategoryOption,
} from "../lib/directory-categories";
import { getLegacyDirectoryListingId } from "../lib/directory-listing-slugs";
import { ATMOSPHERE_GAMES_URL, isGameOnlyListing } from "../lib/game-listing";
import { getDirectoryListingHeroImageAlt } from "../lib/listing-copy";
import { buildRouteOgMeta } from "../lib/og-meta";
import { listingHeroTransitionName } from "../lib/view-transitions";

const PRODUCT_UPDATES_PREVIEW_COUNT = 3;
const MENTIONS_PREVIEW_COUNT = 3;
const RELATED_CARD_COUNT = 4;

const ButtonLink = createLink(Button);

export const Route = createFileRoute("/_header-layout/products/$productId/")({
  loader: async ({ context, params }) => {
    const legacyListingId = getLegacyDirectoryListingId(params.productId);
    const result = await context.queryClient.ensureQueryData(
      legacyListingId
        ? directoryListingApi.getProductPageByIdQueryOptions(params.productId)
        : directoryListingApi.getProductPageBySlugQueryOptions(
            params.productId,
          ),
    );

    if (!result) {
      throw notFound();
    }

    const { listing, page, productId, productSlug, ecosystemRootId } = result;

    if (params.productId !== productSlug) {
      throw redirect({
        to: "/products/$productId",
        params: { productId: productSlug },
        replace: true,
      });
    }

    // Prefetch viewer-specific queries so SSR does not suspend the layout <Suspense> boundary.
    await Promise.all([
      context.queryClient.ensureQueryData(
        directoryListingApi.getDirectoryListingFavoriteStatusQueryOptions(
          productId,
        ),
      ),
      context.queryClient.ensureQueryData(
        directoryListingApi.getProductListingEditAccessQueryOptions(productId),
      ),
    ]);

    const primaryTag = listing.appTags[0]
      ? formatAppTagLabel(listing.appTags[0])
      : null;
    const ogDescription = primaryTag
      ? `${listing.tagline} Tag: ${primaryTag}.`
      : listing.tagline;
    const preloadHeroImages = listing.heroImageUrl
      ? [listing.heroImageUrl]
      : [];

    const ogTitle =
      listing.rating == null
        ? `${listing.name} | at-store`
        : `${listing.name} · ${listing.rating.toFixed(1)} ★ | at-store`;

    return {
      productId,
      productSlug,
      ecosystemRootId,
      listing,
      page,
      ogTitle,
      ogDescription,
      ogImage: listing.heroImageUrl || null,
      preloadHeroImages,
    };
  },
  head: ({ loaderData }) => ({
    ...buildRouteOgMeta({
      title: loaderData?.ogTitle ?? "Product | at-store",
      description:
        loaderData?.ogDescription ||
        "Discover product details, links, and reviews on at-store.",
      image: loaderData?.ogImage,
    }),
    links: (loaderData?.preloadHeroImages ?? []).map((href) => ({
      rel: "preload",
      as: "image",
      href,
    })),
  }),
  component: ProductPage,
});

const styles = stylex.create({
  page: {
    paddingBottom: { default: 56, [breakpoints.md]: 88 },
  },
  topRow: {
    alignItems: "center",
    columnGap: 16,
    display: "flex",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: 12,
    paddingTop: { default: 20, [breakpoints.md]: 28 },
  },
  editActions: {
    alignItems: "center",
    columnGap: 10,
    display: "flex",
    flexWrap: "wrap",
    rowGap: 8,
  },
  editNote: {
    color: uiColor.text1,
    fontSize: 13,
  },
  inlineLink: {
    color: uiColor.text2,
    textDecorationColor: uiColor.border3,
    textDecorationLine: "underline",
    textUnderlineOffset: 3,
  },
  grid: {
    alignItems: "start",
    columnGap: { default: 48, [breakpoints.lg]: 72 },
    display: "grid",
    gridTemplateColumns: {
      default: "minmax(0, 1fr)",
      [breakpoints.md]: "minmax(0, 1fr) 280px",
      [breakpoints.lg]: "minmax(0, 1fr) 320px",
    },
    rowGap: 44,
    paddingBottom: 24,
    paddingTop: { default: 36, [breakpoints.md]: 56 },
  },
  main: {
    minWidth: 0,
  },
  block: {
    marginTop: { default: 44, [breakpoints.md]: 56 },
  },
  blockLede: {
    color: uiColor.text1,
    fontSize: 15,
    lineHeight: 1.5,
    marginBottom: 18,
    marginTop: -8,
  },
  twoUp: {
    columnGap: 12,
    display: "grid",
    gridTemplateColumns: {
      default: "minmax(0, 1fr)",
      [breakpoints.sm]: "repeat(2, minmax(0, 1fr))",
    },
    rowGap: 12,
  },
  updateCard: {
    borderColor: {
      default: uiColor.border1,
      ":hover": uiColor.border2,
    },
    borderRadius: 18,
    borderStyle: "solid",
    borderWidth: 1,
    overflow: "hidden",
    textDecoration: "none",
    backgroundColor: uiColor.bg,
    boxShadow: { default: shadow.none, ":hover": shadow.md },
    color: "inherit",
    display: "flex",
    flexDirection: "column",
    outlineColor: uiColor.text2,
    outlineOffset: 2,
    outlineStyle: { default: "none", ":focus-visible": "solid" },
    outlineWidth: 2,
    transform: { default: null, ":hover": "translateY(-2px)" },
    transitionDuration: animationDuration.slow,
    transitionProperty: "border-color, box-shadow, transform",
    minWidth: 0,
  },
  updateCover: {
    aspectRatio: "1.91 / 1",
    backgroundColor: uiColor.component1,
    display: "block",
    objectFit: "cover",
    width: "100%",
  },
  updateBody: {
    padding: 16,
    display: "flex",
    flexDirection: "column",
    flexGrow: 1,
    rowGap: 6,
  },
  updateTitle: {
    color: uiColor.text2,
    fontSize: 15,
    fontWeight: fontWeight.semibold,
    letterSpacing: "-0.006em",
  },
  updateDescription: {
    overflow: "hidden",
    WebkitBoxOrient: "vertical",
    WebkitLineClamp: 2,
    color: uiColor.text1,
    display: "-webkit-box",
    fontSize: 14,
    lineHeight: 1.45,
  },
  updateDate: {
    color: uiColor.text1,
    fontSize: 13,
    marginTop: "auto",
    paddingTop: 6,
  },
  cards: {
    gap: { default: 12, [breakpoints.md]: 16 },
    display: "grid",
    gridTemplateColumns: {
      default: "repeat(2, minmax(0, 1fr))",
      [breakpoints.lg]: "repeat(4, minmax(0, 1fr))",
    },
  },
  related: {
    marginTop: { default: 24, [breakpoints.md]: 40 },
  },
});

function ProductPage() {
  const { productId, productSlug, ecosystemRootId, listing, page } =
    Route.useLoaderData();

  if (!listing) {
    throw notFound();
  }

  const [type, scope, domain] = listing.categoryPathLabel?.split(" / ") || [];
  const isRootApp = type === "Apps" && scope && !domain;
  const isGame = listing.listingType === "game";

  return (
    <div {...stylex.props(styles.page)}>
      <div {...stylex.props(styles.topRow)}>
        <ListingBreadcrumbs listing={listing} />
        <ProductPageEditActions listing={listing} productSlug={productSlug} />
      </div>

      <ListingHeader
        listing={listing}
        productId={productId}
        productSlug={productSlug}
      />

      {listing.heroImageUrl ? (
        <HeroImage
          alt={getDirectoryListingHeroImageAlt(listing)}
          src={listing.heroImageUrl}
          transitionName={listingHeroTransitionName(productSlug)}
        />
      ) : null}

      <div {...stylex.props(styles.grid)}>
        <div {...stylex.props(styles.main)}>
          {listing.description.trim() ? (
            <section aria-labelledby="listing-about-heading">
              <BlockHeading id="listing-about-heading">About</BlockHeading>
              <ExpandableDescription content={listing.description} />
            </section>
          ) : null}

          {listing.screenshots.length > 0 ? (
            <section
              aria-labelledby="listing-screenshots-heading"
              {...stylex.props(styles.block)}
            >
              <BlockHeading
                id="listing-screenshots-heading"
                count={listing.screenshots.length}
              >
                Screenshots
              </BlockHeading>
              <ScreenshotGallery
                screenshots={listing.screenshots}
                name={listing.name}
              />
            </section>
          ) : null}

          {isGame && listing.game ? (
            <GameDetailsPanel
              game={listing.game}
              gameName={listing.name}
              isGameOnly={isGameOnlyListing(listing)}
            />
          ) : null}

          {ecosystemRootId && isRootApp ? (
            <ProductEcosystemSection
              ecosystemRootId={ecosystemRootId}
              ecosystemChildren={page.ecosystemChildren}
            />
          ) : null}

          <div {...stylex.props(styles.block)}>
            <ListingReviewsBlock
              listing={listing}
              productId={productId}
              productSlug={productSlug}
              previewReviews={page.reviewPreview}
            />
          </div>

          {listing.productAccountDid ? (
            <ProductUpdatesSection
              updates={page.productUpdates}
              publicationUrl={page.productUpdatesPublicationUrl}
            />
          ) : null}

          <ProductMentionsSection
            mentions={page.mentions}
            mentionTotal={page.mentionTotal}
            productSlug={productSlug}
          />
        </div>

        <ListingSidebar
          listing={listing}
          productId={productId}
          productSlug={productSlug}
          hasCompatibleApps={page.relatedByLexicon.length > 0}
        />
      </div>

      <ProductRelatedSections
        listingName={listing.name}
        relatedByTag={page.relatedByTag}
        relatedInCategory={page.relatedInCategory}
        relatedByLexicon={page.relatedByLexicon}
        productSlug={productSlug}
      />
    </div>
  );
}

/** Apps › ecosystem › category, Apps › first tag, or Games. */
function ListingBreadcrumbs({ listing }: { listing: DirectoryListingDetail }) {
  const ecosystemSlug = getEcosystemCategorySlug(listing.categorySlugs);
  const ecosystem = ecosystemSlug
    ? getDirectoryCategoryOption(ecosystemSlug)
    : null;
  const appSegment = ecosystem
    ? getAppSegmentFromEcosystemRootCategoryId(
        ecosystem.pathIds.slice(0, 2).join("/"),
      )
    : null;
  const firstTag = listing.appTags.find(
    (tag) => formatAppTagLabel(tag).toLowerCase() !== "games",
  );

  return (
    <Breadcrumbs>
      {listing.listingType === "game" ? (
        <Crumb to="/games">Games</Crumb>
      ) : (
        <>
          <Crumb to="/apps">Apps</Crumb>
          {ecosystem && ecosystemSlug ? (
            <>
              {appSegment ? (
                <Crumb to="/ecosystems/$app" params={{ app: appSegment }}>
                  {ecosystem.pathLabels[1]}
                </Crumb>
              ) : null}
              <Crumb to="/apps" search={{ in: ecosystemSlug }}>
                {ecosystem.pathLabels.slice(2).join(" › ")}
              </Crumb>
            </>
          ) : firstTag ? (
            <Crumb {...getAppTagLinkOptions(firstTag)}>
              {formatAppTagLabel(firstTag)}
            </Crumb>
          ) : null}
        </>
      )}
      <CurrentCrumb>{listing.name}</CurrentCrumb>
    </Breadcrumbs>
  );
}

function productUpdateExternalHref(update: DirectoryListingProductUpdate) {
  return (
    update.canonicalPostUrl ??
    `https://pdsls.dev/${encodeURIComponent(update.atUri)}`
  );
}

function ProductPageEditActions({
  listing,
  productSlug,
}: {
  listing: DirectoryListingDetail;
  productSlug: string;
}) {
  const { data: session } = useQuery(user.getSessionQueryOptions);
  const { data: editAccess } = useQuery(
    directoryListingApi.getProductListingEditAccessQueryOptions(listing.id),
  );
  const router = useRouter();
  const queryClient = useQueryClient();
  const isAdmin = Boolean(session?.user?.isAdmin);
  const canRemoveHero =
    isAdmin &&
    Boolean(editAccess?.isStoreManaged) &&
    Boolean(listing.heroImageUrl);
  const removeHeroMutation = useMutation({
    mutationFn: async () =>
      directoryListingApi.removeStoreManagedListingHero({
        data: { id: listing.id },
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["storeListings"] });
      await router.invalidate();
    },
  });

  function handleRemoveHero() {
    if (!canRemoveHero || removeHeroMutation.isPending) return;
    if (
      globalThis.window !== undefined &&
      !globalThis.window.confirm(
        `Remove the hero image from "${listing.name}"?`,
      )
    ) {
      return;
    }
    removeHeroMutation.mutate();
  }

  /** Game-only listings mirror the developer's atmosphere.games record; edits happen there. */
  const isGameOnly = isGameOnlyListing(listing);
  const canEditHere = Boolean(editAccess?.canEdit) && !isGameOnly;
  /** No edit page for game-only listings, so admins moderate them from here. */
  const canRejectGame = isAdmin && isGameOnly;

  if (!canRemoveHero && !editAccess?.canEdit && !canRejectGame) {
    return null;
  }

  return (
    <div {...stylex.props(styles.editActions)}>
      {canRemoveHero ? (
        <Button
          variant="critical-outline"
          size="sm"
          isPending={removeHeroMutation.isPending}
          isDisabled={removeHeroMutation.isPending}
          onPress={handleRemoveHero}
        >
          Remove hero
        </Button>
      ) : null}
      {canEditHere ? (
        <ButtonLink
          to="/products/$productId/edit"
          params={{ productId: productSlug }}
          variant="secondary"
          size="sm"
        >
          <Pencil />
          Edit listing
        </ButtonLink>
      ) : null}
      {canRejectGame ? (
        <RejectGameDialog listingId={listing.id} listingName={listing.name} />
      ) : null}
      {editAccess?.canEdit && isGameOnly ? (
        <span {...stylex.props(styles.editNote)}>
          Edit this game on{" "}
          <a
            href={ATMOSPHERE_GAMES_URL}
            target="_blank"
            rel="noopener noreferrer"
            {...stylex.props(styles.inlineLink)}
          >
            atmosphere.games
          </a>
        </span>
      ) : null}
    </div>
  );
}

const updateDate = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

function ProductUpdatesSection({
  updates,
  publicationUrl,
}: {
  updates: StoreListingPageSnapshotPayload["productUpdates"];
  publicationUrl: string | null;
}) {
  if (updates.length === 0) {
    return null;
  }

  const preview = updates.slice(0, PRODUCT_UPDATES_PREVIEW_COUNT);
  const showViewAll =
    updates.length > PRODUCT_UPDATES_PREVIEW_COUNT &&
    publicationUrl != null &&
    publicationUrl.length > 0;

  return (
    <section
      aria-labelledby="listing-updates-heading"
      {...stylex.props(styles.block)}
    >
      <BlockHeading
        id="listing-updates-heading"
        action={
          showViewAll ? (
            <MoreExternalLink href={publicationUrl}>
              All updates
            </MoreExternalLink>
          ) : null
        }
      >
        Updates
      </BlockHeading>
      <div {...stylex.props(styles.twoUp)}>
        {preview.map((update) => {
          const title = update.title?.trim() || update.path.replace(/^\//, "");
          return (
            <a
              key={update.id}
              href={productUpdateExternalHref(update)}
              target="_blank"
              rel="noopener noreferrer"
              {...stylex.props(styles.updateCard)}
            >
              {update.coverImageUrl ? (
                <img
                  src={update.coverImageUrl}
                  alt=""
                  loading="lazy"
                  {...stylex.props(styles.updateCover)}
                />
              ) : null}
              <span {...stylex.props(styles.updateBody)}>
                <span {...stylex.props(styles.updateTitle)}>{title}</span>
                {update.description?.trim() ? (
                  <span {...stylex.props(styles.updateDescription)}>
                    {update.description}
                  </span>
                ) : null}
                <span {...stylex.props(styles.updateDate)}>
                  {updateDate.format(new Date(update.publishedAt))}
                </span>
              </span>
            </a>
          );
        })}
      </div>
    </section>
  );
}

function ProductMentionsSection({
  mentions,
  mentionTotal,
  productSlug,
}: {
  mentions: StoreListingPageSnapshotPayload["mentions"];
  mentionTotal: number;
  productSlug: string;
}) {
  if (mentions.length === 0) {
    return null;
  }

  return (
    <section
      aria-labelledby="listing-mentions-heading"
      {...stylex.props(styles.block)}
    >
      <BlockHeading
        id="listing-mentions-heading"
        action={
          mentionTotal > MENTIONS_PREVIEW_COUNT ? (
            <MoreLink
              to="/products/$productId/mentions"
              params={{ productId: productSlug }}
            >
              All mentions
            </MoreLink>
          ) : null
        }
      >
        On Bluesky
      </BlockHeading>
      <div>
        {mentions.map((mention) => (
          <BlueskyMentionCard key={mention.id} mention={mention} />
        ))}
      </div>
    </section>
  );
}

function ProductEcosystemSection({
  ecosystemRootId,
  ecosystemChildren,
}: {
  ecosystemRootId: string;
  ecosystemChildren: Array<DirectoryCategoryTreeNode> | null;
}) {
  const appSegment = getAppSegmentFromEcosystemRootCategoryId(ecosystemRootId);

  if (!ecosystemChildren?.length || !appSegment) {
    return null;
  }

  return (
    <section
      aria-labelledby="listing-ecosystem-heading"
      {...stylex.props(styles.block)}
    >
      <BlockHeading
        id="listing-ecosystem-heading"
        action={
          <MoreLink to="/ecosystems/$app" params={{ app: appSegment }}>
            Explore
          </MoreLink>
        }
      >
        Ecosystem
      </BlockHeading>
      <p {...stylex.props(styles.blockLede)}>
        Discover tools and products built for this app.
      </p>
      <div {...stylex.props(styles.twoUp)}>
        {ecosystemChildren.map((child) => (
          <EcosystemCategoryCard key={child.id} category={child} />
        ))}
      </div>
    </section>
  );
}

/**
 * "More like X" (listings sharing a tag or category) and apps that work with
 * the same data. Each listing appears in at most one row.
 */
function ProductRelatedSections({
  listingName,
  relatedByTag,
  relatedInCategory,
  relatedByLexicon,
  productSlug,
}: {
  listingName: string;
  relatedByTag: Array<DirectoryListingCard>;
  relatedInCategory: Array<DirectoryListingCard>;
  relatedByLexicon: Array<DirectoryListingCard>;
  productSlug: string;
}) {
  const compatible = relatedByLexicon.slice(0, RELATED_CARD_COUNT);
  const compatibleIds = new Set(compatible.map((listing) => listing.id));
  const seen = new Set<string>();
  const similar = [...relatedInCategory, ...relatedByTag]
    .filter((listing) => {
      if (compatibleIds.has(listing.id) || seen.has(listing.id)) return false;
      seen.add(listing.id);
      return true;
    })
    .slice(0, RELATED_CARD_COUNT);

  if (similar.length === 0 && compatible.length === 0) {
    return null;
  }

  return (
    <div {...stylex.props(styles.related)}>
      {similar.length > 0 ? (
        <ShelfSection>
          <SectionHeader title={`More like ${listingName}`} />
          <div {...stylex.props(styles.cards)}>
            {similar.map((listing) => (
              <ListingCard key={listing.id} listing={listing} />
            ))}
          </div>
        </ShelfSection>
      ) : null}
      {compatible.length > 0 ? (
        <ShelfSection>
          <SectionHeader
            title="Works with the same data"
            description={`These apps read and write the same records as ${listingName}, so what you make in one shows up in the others.`}
            action={
              <MoreLink
                to="/products/$productId/lexicon-compatible"
                params={{ productId: productSlug }}
                search={{ sort: "popular" }}
              >
                All compatible apps
              </MoreLink>
            }
          />
          <div {...stylex.props(styles.cards)}>
            {compatible.map((listing) => (
              <ListingCard key={listing.id} listing={listing} />
            ))}
          </div>
        </ShelfSection>
      ) : null}
    </div>
  );
}
