import * as stylex from "@stylexjs/stylex";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import {
  createFileRoute,
  createLink,
  notFound,
  useNavigate,
} from "@tanstack/react-router";
import { BlueskyIcon } from "#/components/bluesky-icon";
import { useButtonStyles } from "#/design-system/theme/useButtonStyles";
import { LayoutGrid } from "lucide-react";
import { useState } from "react";
import { Link as AriaLink } from "react-aria-components";

import { DirectoryListingReviewCard } from "../components/DirectoryListingReviewCard";
import { GermNetworkBadge } from "../components/GermNetworkBadge";
import { PersonAvatar } from "../components/shelf/account/PersonAvatar";
import { ListingCard } from "../components/shelf/ListingCard";
import { ListingRow } from "../components/shelf/ListingRow";
import { SectionHeader, ShelfSection } from "../components/shelf/Section";
import { Button } from "../design-system/button";
import { uiColor } from "../design-system/theme/color.stylex";
import { breakpoints } from "../design-system/theme/media-queries.stylex";
import {
  fontFamily,
  fontWeight,
} from "../design-system/theme/typography.stylex";
import { directoryListingApi } from "../integrations/tanstack-query/api-directory-listings.functions";
import { user } from "../integrations/tanstack-query/api-user.functions";
import { resolveProfilePathActorToDid } from "../lib/bluesky-public-profile";
import { getDirectoryListingSlug } from "../lib/directory-listing-slugs";
import { buildAppProfileOgImageUrl, buildRouteOgMeta } from "../lib/og-meta";

const RouterLink = createLink(AriaLink);
const FAVORITES_PREVIEW_LIMIT = 4;

const styles = stylex.create({
  page: {
    fontFamily: fontFamily.sans,
    paddingBottom: { default: 56, [breakpoints.md]: 88 },
  },
  banner: {
    borderRadius: { default: 18, [breakpoints.md]: 24 },
    overflow: "hidden",
    backgroundColor: uiColor.component1,
    backgroundImage: `linear-gradient(120deg, ${uiColor.border1}, ${uiColor.component1} 55%, ${uiColor.bg})`,
    height: { default: 140, [breakpoints.md]: 220 },
    marginTop: { default: 16, [breakpoints.md]: 24 },
  },
  bannerImage: {
    display: "block",
    objectFit: "cover",
    height: "100%",
    width: "100%",
  },
  head: {
    paddingInline: { default: 8, [breakpoints.md]: 24 },
    alignItems: "flex-end",
    columnGap: { default: 16, [breakpoints.md]: 24 },
    display: "flex",
    flexWrap: { default: "wrap", [breakpoints.md]: "nowrap" },
    rowGap: 12,
    marginTop: { default: -44, [breakpoints.md]: -56 },
  },
  avatar: {
    boxShadow: `0 0 0 5px ${uiColor.bgSubtle}`,
    height: { default: 88, [breakpoints.md]: 112 },
    width: { default: 88, [breakpoints.md]: 112 },
  },
  identity: {
    flexBasis: { default: "100%", [breakpoints.md]: "auto" },
    flexGrow: 1,
    minWidth: 0,
    paddingBottom: { default: 0, [breakpoints.md]: 6 },
    paddingTop: { default: 0, [breakpoints.md]: 68 },
  },
  nameRow: {
    alignItems: "center",
    columnGap: 12,
    display: "flex",
    flexWrap: "wrap",
    rowGap: 8,
  },
  name: {
    margin: 0,
    color: uiColor.text2,
    fontFamily: fontFamily.title,
    fontSize: { default: 30, [breakpoints.md]: 40 },
    fontWeight: fontWeight.bold,
    letterSpacing: "-0.045em",
    lineHeight: 1.05,
    overflowWrap: "anywhere",
  },
  handle: {
    color: uiColor.text1,
    overflowWrap: "anywhere",
    marginTop: 4,
  },
  actions: {
    columnGap: 8,
    display: "flex",
    flexShrink: 0,
    flexWrap: "wrap",
    rowGap: 8,
    paddingBottom: { default: 0, [breakpoints.md]: 8 },
  },
  body: {
    paddingInline: { default: 8, [breakpoints.md]: 24 },
  },
  bio: {
    color: uiColor.text2,
    lineHeight: 1.55,
    overflowWrap: "anywhere",
    whiteSpace: "pre-line",
    marginBottom: 0,
    marginTop: 20,
    maxWidth: "40em",
  },
  stats: {
    color: uiColor.text1,
    columnGap: 24,
    display: "flex",
    flexWrap: "wrap",
    fontSize: 15,
    rowGap: 8,
    marginBottom: { default: 32, [breakpoints.md]: 40 },
    marginTop: 16,
  },
  statValue: {
    color: uiColor.text2,
    fontVariantNumeric: "tabular-nums",
    fontWeight: fontWeight.semibold,
  },
  cards: {
    columnGap: 16,
    display: "grid",
    gridTemplateColumns: {
      default: "minmax(0, 1fr)",
      [breakpoints.sm]: "repeat(2, minmax(0, 1fr))",
      [breakpoints.lg]: "repeat(4, minmax(0, 1fr))",
    },
    rowGap: 16,
  },
  rows: {
    columnGap: 40,
    display: "grid",
    gridTemplateColumns: {
      default: "minmax(0, 1fr)",
      [breakpoints.lg]: "repeat(2, minmax(0, 1fr))",
    },
  },
  reviews: {
    alignItems: "start",
    columnGap: 16,
    display: "grid",
    gridTemplateColumns: {
      default: "minmax(0, 1fr)",
      [breakpoints.lg]: "repeat(2, minmax(0, 1fr))",
    },
    rowGap: 16,
  },
  reviewCard: {
    minWidth: 0,
  },
  empty: {
    borderColor: uiColor.border2,
    borderRadius: 20,
    borderStyle: "dashed",
    borderWidth: 1,
    paddingBlock: 48,
    paddingInline: 24,
    color: uiColor.text1,
    textAlign: "center",
  },
});

export const Route = createFileRoute("/_header-layout/profile/$actor")({
  loader: async ({ context, params }) => {
    const resolvedDid = await resolveProfilePathActorToDid(params.actor);
    if (resolvedDid == null) {
      throw notFound();
    }
    const [data, , ownedProducts] = await Promise.all([
      context.queryClient.ensureQueryData(
        directoryListingApi.getUserProfileReviewsPageDataQueryOptions(
          resolvedDid,
        ),
      ),
      context.queryClient.ensureQueryData(
        directoryListingApi.getProfileFavoriteListingsQueryOptions(resolvedDid),
      ),
      context.queryClient.ensureQueryData(
        directoryListingApi.getProfileOwnedProductListingsQueryOptions(
          resolvedDid,
        ),
      ),
    ]);
    if (data == null) {
      throw notFound();
    }
    const handleDisplay = data.handle?.trim()
      ? `@${data.handle.replace(/^@+/, "")}`
      : null;
    const mainTitle =
      data.displayName?.trim() ||
      handleDisplay ||
      (resolvedDid.length > 28 ? `${resolvedDid.slice(0, 18)}…` : resolvedDid);

    return {
      did: resolvedDid,
      ogTitle: `${mainTitle} profile | at-store`,
      ogDescription:
        handleDisplay == null
          ? "Read reviews and discover products published on at-store."
          : `Read reviews and discover products published by ${handleDisplay}.`,
      ogAvatar: data.avatarUrl ?? null,
      ogOwnedProducts: ownedProducts?.length ?? 0,
      ogReviews: data.reviews.length,
      ogImage: buildAppProfileOgImageUrl({ did: resolvedDid }),
    };
  },
  head: ({ loaderData }) =>
    buildRouteOgMeta({
      title: loaderData?.ogTitle ?? "Profile | at-store",
      description:
        loaderData?.ogDescription ||
        "Read reviews and discover products published on at-store.",
      image: loaderData?.ogImage,
      avatar: loaderData?.ogAvatar,
      ownedProducts: loaderData?.ogOwnedProducts,
      reviews: loaderData?.ogReviews,
    }),
  component: UserProfilePage,
});

function UserProfilePage() {
  const navigate = useNavigate();
  const { did } = Route.useLoaderData();
  const { data: page } = useSuspenseQuery(
    directoryListingApi.getUserProfileReviewsPageDataQueryOptions(did),
  );
  const { data: ownedProducts } = useSuspenseQuery(
    directoryListingApi.getProfileOwnedProductListingsQueryOptions(did),
  );
  const { data: favoriteProducts } = useSuspenseQuery(
    directoryListingApi.getProfileFavoriteListingsQueryOptions(did),
  );
  const { data: session } = useQuery(user.getSessionQueryOptions);
  const buttonStyles = useButtonStyles({ variant: "secondary", size: "md" });
  const [showAllFavorites, setShowAllFavorites] = useState(false);

  if (page == null) {
    throw notFound();
  }

  const handleDisplay = page.handle?.trim()
    ? `@${page.handle.replace(/^@+/, "")}`
    : null;
  const mainTitle =
    page.displayName?.trim() ||
    handleDisplay ||
    (did.length > 28 ? `${did.slice(0, 18)}…` : did);
  const subtitle =
    page.displayName?.trim() && handleDisplay ? handleDisplay : null;
  const blueskyProfileId = page.handle?.trim()
    ? page.handle.replace(/^@+/, "")
    : did;
  const blueskyProfileUrl = `https://bsky.app/profile/${blueskyProfileId}`;
  const isViewer = session?.user?.did === did;
  const owned = ownedProducts ?? [];
  const hasMoreFavorites = favoriteProducts.length > FAVORITES_PREVIEW_LIMIT;
  const visibleFavoriteProducts =
    showAllFavorites || !hasMoreFavorites
      ? favoriteProducts
      : favoriteProducts.slice(0, FAVORITES_PREVIEW_LIMIT);
  const reviewCount = page.reviews.length;

  return (
    <div {...stylex.props(styles.page)}>
      <div {...stylex.props(styles.banner)}>
        {page.bannerUrl ? (
          <img
            src={page.bannerUrl}
            alt=""
            decoding="async"
            {...stylex.props(styles.bannerImage)}
          />
        ) : null}
      </div>

      <div {...stylex.props(styles.head)}>
        <PersonAvatar
          name={mainTitle}
          src={page.avatarUrl}
          size={112}
          style={styles.avatar}
        />
        <div {...stylex.props(styles.identity)}>
          <div {...stylex.props(styles.nameRow)}>
            <h1 {...stylex.props(styles.name)}>{mainTitle}</h1>
            {page.germDmHref ? (
              <GermNetworkBadge href={page.germDmHref} />
            ) : null}
          </div>
          {subtitle ? (
            <div {...stylex.props(styles.handle)}>{subtitle}</div>
          ) : null}
        </div>
        <div {...stylex.props(styles.actions)}>
          <AriaLink
            {...stylex.props(buttonStyles)}
            href={blueskyProfileUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            <BlueskyIcon size={15} />
            Bluesky
          </AriaLink>
          {isViewer ? (
            <RouterLink to="/products/manage" {...stylex.props(buttonStyles)}>
              <LayoutGrid size={15} aria-hidden />
              Manage listings
            </RouterLink>
          ) : null}
        </div>
      </div>

      <div {...stylex.props(styles.body)}>
        {page.description ? (
          <p {...stylex.props(styles.bio)}>{page.description}</p>
        ) : null}
        <div {...stylex.props(styles.stats)}>
          <span>
            <span {...stylex.props(styles.statValue)}>{reviewCount}</span>{" "}
            {reviewCount === 1 ? "review" : "reviews"}
          </span>
          {favoriteProducts.length > 0 ? (
            <span>
              <span {...stylex.props(styles.statValue)}>
                {favoriteProducts.length}
              </span>{" "}
              {favoriteProducts.length === 1 ? "favorite" : "favorites"}
            </span>
          ) : null}
          {owned.length > 0 ? (
            <span>
              <span {...stylex.props(styles.statValue)}>{owned.length}</span>{" "}
              {owned.length === 1 ? "product" : "products"}
            </span>
          ) : null}
        </div>
      </div>

      {favoriteProducts.length > 0 ? (
        <ShelfSection>
          <SectionHeader
            title="Favorites"
            action={
              hasMoreFavorites ? (
                <Button
                  variant="secondary"
                  size="md"
                  onPress={() => {
                    setShowAllFavorites((current) => !current);
                  }}
                >
                  {showAllFavorites ? "Show less" : "Show more"}
                </Button>
              ) : null
            }
          />
          <div {...stylex.props(styles.cards)}>
            {visibleFavoriteProducts.map((favorite) => (
              <ListingCard
                key={favorite.id}
                listing={{
                  name: favorite.name,
                  slug: favorite.slug,
                  iconUrl: favorite.iconUrl,
                  tagline: favorite.tagline ?? "",
                  rating: favorite.rating,
                  reviewCount: favorite.reviewCount,
                  appTags: favorite.appTags,
                }}
              />
            ))}
          </div>
        </ShelfSection>
      ) : null}

      {owned.length > 0 ? (
        <ShelfSection>
          <SectionHeader title="Products" />
          <div {...stylex.props(styles.rows)}>
            {owned.map((product) => (
              <ListingRow
                key={product.id}
                variant="compact"
                listing={{
                  name: product.name,
                  slug: product.slug,
                  iconUrl: product.iconUrl,
                  tagline: product.tagline ?? "",
                  rating: product.averageRating,
                  reviewCount: product.reviewCount,
                }}
              />
            ))}
          </div>
        </ShelfSection>
      ) : null}

      <ShelfSection>
        <SectionHeader title="Reviews" />
        {page.reviews.length > 0 ? (
          <div {...stylex.props(styles.reviews)}>
            {page.reviews.map((review) => (
              <DirectoryListingReviewCard
                key={review.id}
                listingId={review.listing.id}
                reviewedListing={review.listing}
                review={review}
                viewerDid={session?.user?.did ?? null}
                anchorId={`listing-review-${review.id}`}
                shareProductSlug={getDirectoryListingSlug(review.listing)}
                style={styles.reviewCard}
                onEditReview={() => {
                  void navigate({
                    to: "/products/$productId/reviews/$reviewId/edit",
                    params: {
                      productId: getDirectoryListingSlug(review.listing),
                      reviewId: review.id,
                    },
                  });
                }}
              />
            ))}
          </div>
        ) : (
          <div {...stylex.props(styles.empty)}>No reviews yet.</div>
        )}
      </ShelfSection>
    </div>
  );
}
