import type { ListingLink } from "#/lib/atproto/listing-record";

import * as stylex from "@stylexjs/stylex";
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import {
  Link as RouterLink,
  createFileRoute,
  createLink,
  notFound,
  redirect,
  useCanGoBack,
  useNavigate,
  useRouter,
} from "@tanstack/react-router";
import { BlueskyIcon } from "#/components/bluesky-icon";
import { useButtonStyles } from "#/design-system/theme/useButtonStyles";
import { ToggleButton } from "#/design-system/toggle-button";
import {
  BadgeCheck,
  BookOpen,
  ChevronLeft,
  Code2,
  ExternalLink,
  FileText,
  Heart,
  LifeBuoy,
  Link as LinkIcon,
  Mail,
  Newspaper,
  ScrollText,
  Shield,
  Zap,
} from "lucide-react";
import { useState } from "react";
import { Link as AriaLink, Pressable } from "react-aria-components";

import type {
  DirectoryListingCard,
  DirectoryListingDetail,
} from "../integrations/tanstack-query/api-directory-listings.functions";
import type { DirectoryCategoryOption } from "../lib/directory-categories";

import { BlueskyMentionCard } from "../components/BlueskyMentionCard";
import { DirectoryListingReviewCard } from "../components/DirectoryListingReviewCard";
import { EcosystemCategoryCard } from "../components/EcosystemCategoryCard";
import { HeroImage } from "../components/HeroImage";
import { RestrictedMarkdownContent } from "../components/restricted-markdown-content";
import { Alert } from "../design-system/alert";
import { Avatar } from "../design-system/avatar";
import { Badge } from "../design-system/badge";
import { Button } from "../design-system/button";
import { Card } from "../design-system/card";
import { Flex } from "../design-system/flex";
import { Grid } from "../design-system/grid";
import { Lightbox } from "../design-system/lightbox";
import { Link } from "../design-system/link";
import { Page } from "../design-system/page";
import { StarRating } from "../design-system/star-rating";
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
import { fontFamily, fontSize } from "../design-system/theme/typography.stylex";
import { Tooltip } from "../design-system/tooltip";
import { Body, SmallBody } from "../design-system/typography";
import { Text } from "../design-system/typography/text";
import { directoryListingApi } from "../integrations/tanstack-query/api-directory-listings.functions";
import { user } from "../integrations/tanstack-query/api-user.functions";
import { formatAppTagLabel, getAppTagSlug } from "../lib/app-tag-metadata";
import {
  getAppEcosystemRootCategoryId,
  getAppSegmentFromEcosystemRootCategoryId,
  getDirectoryCategoryOption,
} from "../lib/directory-categories";
import {
  getDirectoryListingSlug,
  getLegacyDirectoryListingId,
} from "../lib/directory-listing-slugs";
import { getInitials } from "../lib/get-initials";
import { getDirectoryListingHeroImageAlt } from "../lib/listing-copy";
import { buildRouteOgMeta } from "../lib/og-meta";
import { PRODUCT_REVIEW_PREVIEW_COUNT } from "../lib/product-reviews";

const ButtonLink = createLink(Button);
const AppLink = createLink(Link);

export const Route = createFileRoute("/_header-layout/products/$productId/")({
  loader: async ({ context, params }) => {
    const legacyListingId = getLegacyDirectoryListingId(params.productId);
    const listing = await context.queryClient.ensureQueryData(
      legacyListingId
        ? directoryListingApi.getDirectoryListingDetailQueryOptions(
            legacyListingId,
          )
        : directoryListingApi.getDirectoryListingDetailBySlugQueryOptions(
            params.productId,
          ),
    );

    if (!listing) {
      throw notFound();
    }

    const productSlug = getDirectoryListingSlug(listing);

    const relatedProducts = await context.queryClient.ensureQueryData(
      directoryListingApi.getRelatedDirectoryListingsQueryOptions({
        id: listing.id,
        limit: 3,
      }),
    );
    const categoryGroup = listing.categorySlug
      ? await context.queryClient.ensureQueryData(
          directoryListingApi.getDirectoryCategoryPageQueryOptions({
            categoryId: listing.categorySlug,
            sort: "popular",
          }),
        )
      : null;
    const relatedCategoryListings =
      categoryGroup?.listings
        .filter((candidate) => candidate.id !== listing.id)
        .slice(0, 3) ?? [];

    const listingReviews = await context.queryClient.ensureQueryData(
      directoryListingApi.getDirectoryListingReviewsQueryOptions(listing.id),
    );
    const listingMentionsResult = await context.queryClient.ensureQueryData(
      directoryListingApi.getDirectoryListingMentionsQueryOptions(
        listing.id,
        3,
      ),
    );
    const session = await context.queryClient.ensureQueryData(
      user.getSessionQueryOptions,
    );
    const editAccess = session?.user?.did
      ? await context.queryClient.ensureQueryData(
          directoryListingApi.getProductListingEditAccessQueryOptions(
            listing.id,
          ),
        )
      : null;
    await context.queryClient.ensureQueryData(
      directoryListingApi.getDirectoryListingFavoriteStatusQueryOptions(
        listing.id,
      ),
    );

    const ecosystemRootId = getAppEcosystemRootCategoryId(listing.categorySlug);
    if (ecosystemRootId) {
      await context.queryClient.ensureQueryData(
        directoryListingApi.getDirectoryCategoryPageQueryOptions({
          categoryId: ecosystemRootId,
          sort: "popular",
        }),
      );
    }

    if (params.productId !== productSlug) {
      throw redirect({
        to: "/products/$productId",
        params: { productId: productSlug },
        replace: true,
      });
    }

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
      productId: listing.id,
      productSlug,
      ecosystemRootId,
      listing,
      relatedProducts,
      relatedCategoryListings,
      listingReviews,
      listingMentions: listingMentionsResult.mentions,
      listingMentionTotal: listingMentionsResult.total,
      session,
      editAccess,
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
  header: {
    alignItems: "center",
    display: "flex",
    height: size["3xl"],
  },
  iconButton: {
    height: size["4xl"],
    width: size["4xl"],
  },
  noReviews: {
    borderColor: uiColor.border2,
    borderRadius: radius["xl"],
    borderStyle: "dashed",
    borderWidth: 1,
    cornerShape: "squircle",
    paddingBottom: verticalSpace["8xl"],
    paddingTop: verticalSpace["8xl"],
  },
  ecosystemSection: {
    marginTop: {
      default: verticalSpace["lg"],
      [breakpoints.sm]: verticalSpace["5xl"],
    },
  },
  heroAvatar: {
    borderRadius: {
      default: radius["xl"],
      [breakpoints.sm]: radius["3xl"],
    },
    height: {
      default: size["5xl"],
      [breakpoints.sm]: size["7xl"],
    },
    width: {
      default: size["5xl"],
      [breakpoints.sm]: size["7xl"],
    },
  },
  page: {
    position: "relative",
    paddingBottom: verticalSpace["11xl"],
    paddingTop: verticalSpace["6xl"],
  },
  backLinkRow: {
    alignItems: "center",
    width: "100%",
  },
  heroHeader: {
    boxSizing: "border-box",
    color: uiColor.textContrast,
    paddingBottom: verticalSpace["2xl"],
  },
  heroHeaderText: {
    flexBasis: "0%",
    flexGrow: "1",
    flexShrink: "1",
    minWidth: 0,
  },
  heroTitle: {
    color: uiColor.text2,
    display: "block",
  },
  heroTagline: {
    color: uiColor.text1,
  },
  desktopOnly: {
    display: {
      default: "none",
      [breakpoints.sm]: "block",
    },
  },
  mobileOnly: {
    display: {
      default: "flex",
      [breakpoints.sm]: "none",
    },
  },
  tagRow: {
    flexWrap: "wrap",
  },
  tagLink: {
    textDecoration: "none",
  },
  heroContent: {
    position: "relative",
  },
  ratingRow: {
    alignItems: "center",
  },
  descriptionText: {
    fontSize: {
      default: fontSize["lg"],
      [breakpoints.sm]: fontSize["xl"],
    },
    whiteSpace: "pre-wrap",
  },
  reviewsHeader: {
    paddingTop: verticalSpace["5xl"],
  },
  reviewsHeaderTop: {
    width: "100%",
  },
  reviewsActions: {
    flexWrap: "wrap",
  },
  relatedSection: {
    paddingTop: verticalSpace["6xl"],
  },
  relatedGrid: {
    gap: gap["xl"],
    display: "grid",
    gridTemplateColumns: {
      default: "1fr",
      [breakpoints.lg]: "repeat(3, minmax(0, 1fr))",
    },
  },
  ecosystemGrid: {
    gap: gap["2xl"],
    display: "grid",
    gridTemplateColumns: {
      default: "1fr",
      [breakpoints.sm]: "repeat(2, minmax(0, 1fr))",
      [breakpoints.lg]: "repeat(3, minmax(0, 1fr))",
    },
  },
  ecosystemHeader: {
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  ecosystemLinks: {
    flexWrap: "wrap",
  },
  relatedLink: {
    textDecoration: "none",
    display: "block",
    height: "100%",
  },
  relatedCard: {
    boxShadow: shadow.sm,
    height: "100%",
  },
  relatedCardBody: {
    gap: gap["4xl"],
    height: "100%",
    paddingBottom: verticalSpace["4xl"],
    paddingLeft: horizontalSpace["4xl"],
    paddingRight: horizontalSpace["4xl"],
    paddingTop: verticalSpace["4xl"],
  },
  relatedHeader: {
    gap: gap["2xl"],
  },
  relatedInfo: {
    flexBasis: "0%",
    flexGrow: "1",
    flexShrink: "1",
    minWidth: 0,
  },
  relatedTagline: {
    flexGrow: 1,
  },
  relatedFooter: {
    alignItems: "center",
  },
  screenshotsSection: {
    paddingTop: verticalSpace["4xl"],
  },
  screenshotCarousel: {
    gap: gap["xl"],
    scrollSnapType: "x mandatory",
    display: "flex",
    flexDirection: "row",
    overflowX: "auto",
    overscrollBehaviorX: "contain",
    width: "100%",
  },
  screenshotSlide: {
    flexBasis: "auto",
    flexShrink: 0,
    scrollSnapAlign: "start",
  },
  screenshotButton: {
    margin: 0,
    padding: 0,
    borderColor: "transparent",
    borderStyle: "solid",
    borderWidth: 0,
    appearance: "none",
    backgroundColor: "transparent",
    cursor: "zoom-in",
    display: "block",
    width: "auto",
  },
  screenshotImage: {
    borderRadius: radius["md"],
    backgroundColor: `color-mix(in srgb, ${uiColor.overlayBackdrop} 8%, transparent)`,
    display: "block",
    objectFit: "contain",
    height: "auto",
    maxHeight: 180,
    width: "auto",
  },
  linksRow: {
    alignItems: "center",
    flexWrap: "wrap",
    rowGap: gap["md"],
  },
  linkChip: {
    borderColor: uiColor.border1,
    borderRadius: radius.full,
    borderStyle: "solid",
    borderWidth: 1,
    gap: gap.sm,
    textDecoration: "none",
    alignItems: "center",
    backgroundColor: {
      default: uiColor.component1,
      ":hover": uiColor.component2,
    },
    color: uiColor.text2,
    cursor: "pointer",
    display: "inline-flex",
    fontFamily: fontFamily.mono,
    fontSize: fontSize.sm,
    paddingBottom: verticalSpace.sm,
    paddingLeft: horizontalSpace.xl,
    paddingRight: horizontalSpace.xl,
    paddingTop: verticalSpace.sm,
  },
});

const LISTING_LINK_ICONS = {
  privacy: Shield,
  terms: ScrollText,
  support: LifeBuoy,
  contact: Mail,
  docs: BookOpen,
  blog: Newspaper,
  changelog: FileText,
  source: Code2,
  status: Zap,
  other: LinkIcon,
} as const satisfies Record<string, typeof LinkIcon>;

const LISTING_LINK_DEFAULT_LABELS = {
  privacy: "Privacy",
  terms: "Terms",
  support: "Support",
  contact: "Contact",
  docs: "Docs",
  blog: "Blog",
  changelog: "Changelog",
  source: "Source",
  status: "Status",
  other: "Link",
} as const satisfies Record<string, string>;

type KnownListingLinkType = keyof typeof LISTING_LINK_ICONS;

function isKnownListingLinkType(type: string): type is KnownListingLinkType {
  return type in LISTING_LINK_ICONS;
}

function getListingLinkLabel(link: ListingLink): string {
  const fallbackByType = isKnownListingLinkType(link.type)
    ? LISTING_LINK_DEFAULT_LABELS[link.type]
    : LISTING_LINK_DEFAULT_LABELS.other;

  const custom = link.label?.trim();
  if (custom) return custom;
  return fallbackByType;
}

function getListingLinkIcon(type: string) {
  return isKnownListingLinkType(type)
    ? LISTING_LINK_ICONS[type]
    : LISTING_LINK_ICONS.other;
}

function ListingLinksRow({ links }: { links: Array<ListingLink> }) {
  if (links.length === 0) return null;
  return (
    <Flex gap="md" style={styles.linksRow} aria-label="Project links">
      {links.map((link, index) => {
        const Icon = getListingLinkIcon(link.type);
        return (
          <AriaLink
            key={`${link.type}-${link.url}-${String(index)}`}
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            {...stylex.props(styles.linkChip)}
          >
            <Icon size={14} />
            <span>{getListingLinkLabel(link)}</span>
          </AriaLink>
        );
      })}
    </Flex>
  );
}

function collectSubproductCategories(
  categorySlugs: ReadonlyArray<string | null | undefined>,
): Array<DirectoryCategoryOption> {
  const seen = new Set<string>();
  const result: Array<DirectoryCategoryOption> = [];
  for (const slug of categorySlugs) {
    const option = getDirectoryCategoryOption(slug);
    if (!option) continue;
    if (option.pathIds[0] !== "apps" || option.pathIds.length < 3) continue;
    if (seen.has(option.id)) continue;
    seen.add(option.id);
    result.push(option);
  }
  return result;
}

function formatSubproductBadgeLabel(option: DirectoryCategoryOption): string {
  const appLabel = option.pathLabels[1];
  const subLabel = option.pathLabels[2];
  if (!appLabel || !subLabel) return option.label;
  return `${appLabel} ${subLabel.toLowerCase()}`;
}

function ProductPage() {
  const {
    productId,
    productSlug,
    ecosystemRootId,
    listing,
    relatedProducts,
    relatedCategoryListings,
    listingReviews,
    listingMentions,
    listingMentionTotal,
    session,
    editAccess,
  } = Route.useLoaderData();

  if (!listing) {
    throw notFound();
  }

  const previewReviews = listingReviews.slice(0, PRODUCT_REVIEW_PREVIEW_COUNT);
  const relatedSectionTitle =
    relatedCategoryListings.length > 0 ? "More in this category" : "More Apps";
  const relatedSectionListings =
    relatedCategoryListings.length > 0
      ? relatedCategoryListings
      : relatedProducts;

  const [type, scope, domain] = listing.categoryPathLabel?.split(" / ") || [];
  const isRootApp = type === "Apps" && scope && !domain;
  const canGoBack = useCanGoBack();
  const navigate = useNavigate();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [isScreenshotLightboxOpen, setIsScreenshotLightboxOpen] =
    useState(false);
  const [screenshotLightboxIndex, setScreenshotLightboxIndex] = useState(0);

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

  return (
    <Page.Root variant="small" style={styles.page}>
      <Flex direction="column" gap="6xl">
        {listing.isStoreManaged && !editAccess?.canEdit ? (
          <Alert
            variant="warning"
            title="Unverified listing"
            action={
              <ButtonLink
                to="/product/claim"
                search={{ listing: listing.id }}
                variant="secondary"
                size="sm"
              >
                Claim listing
              </ButtonLink>
            }
          >
            This listing is managed by the at-store team. Claim it to update
            details, links, and respond to reviews.
          </Alert>
        ) : null}
        <Flex
          align="center"
          justify="between"
          gap="xl"
          style={styles.backLinkRow}
        >
          <Flex align="center">
            {canGoBack ? (
              <Link onClick={() => router.history.back()}>
                <ChevronLeft />
                Back
              </Link>
            ) : (
              <AppLink to="/home">
                <ChevronLeft />
                Home
              </AppLink>
            )}
          </Flex>
          <Flex align="center" gap="lg">
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
            {editAccess?.canEdit ? (
              <AppLink
                to="/products/$productId/edit"
                params={{ productId: productSlug }}
              >
                Edit listing
              </AppLink>
            ) : null}
          </Flex>
        </Flex>
        <HeroSection listing={listing} productId={productId} />
        <RestrictedMarkdownContent
          content={listing.description}
          paragraphStyle={styles.descriptionText}
        />
        {listing.links.length > 0 ? (
          <ListingLinksRow links={listing.links} />
        ) : null}
        {/* screenshots */}
        {listing.screenshots.length > 0 ? (
          <Flex direction="column" gap="3xl" style={styles.screenshotsSection}>
            <Text size="2xl" weight="semibold" style={styles.header}>
              Screenshots
            </Text>
            <div {...stylex.props(styles.screenshotCarousel)}>
              {listing.screenshots.map((screenshot, index) => (
                <div
                  key={`${screenshot}-${String(index)}`}
                  {...stylex.props(styles.screenshotSlide)}
                >
                  <button
                    type="button"
                    onClick={() => {
                      setScreenshotLightboxIndex(index);
                      setIsScreenshotLightboxOpen(true);
                    }}
                    {...stylex.props(styles.screenshotButton)}
                  >
                    <img
                      src={screenshot}
                      alt={`${listing.name} screenshot ${String(index + 1)}`}
                      {...stylex.props(styles.screenshotImage)}
                    />
                  </button>
                </div>
              ))}
            </div>
            <Lightbox
              isOpen={isScreenshotLightboxOpen}
              onOpenChange={setIsScreenshotLightboxOpen}
              images={listing.screenshots}
              initialIndex={screenshotLightboxIndex}
              alt={`${listing.name} screenshot`}
            />
          </Flex>
        ) : null}

        {ecosystemRootId && isRootApp ? (
          <ProductEcosystemSection ecosystemRootId={ecosystemRootId} />
        ) : null}

        <Flex gap="4xl" direction="column">
          <Flex direction="column" gap="2xl" style={styles.reviewsHeader}>
            <Flex
              align="center"
              gap="2xl"
              justify="between"
              style={styles.reviewsHeaderTop}
            >
              <Flex gap="3xl" align="center">
                <Text size="2xl" weight="semibold" style={styles.header}>
                  Reviews
                </Text>
                <Flex gap="md" style={styles.ratingRow}>
                  <StarRating
                    rating={listing.rating}
                    reviewCount={listing.reviewCount}
                    showReviewCount
                  />
                  <Text weight="semibold">
                    {listing.rating == null ? "—" : listing.rating.toFixed(1)}
                  </Text>
                </Flex>
              </Flex>
              <Flex gap="xl" style={styles.reviewsActions}>
                <ButtonLink
                  to="/products/$productId/reviews/write"
                  params={{ productId: productSlug }}
                  variant="secondary"
                >
                  Create review
                </ButtonLink>
              </Flex>
            </Flex>
          </Flex>

          {previewReviews.length > 0 ? (
            <Flex direction="column" gap="2xl">
              {previewReviews.map((review) => (
                <DirectoryListingReviewCard
                  key={review.id}
                  listingId={productId}
                  review={review}
                  viewerDid={session?.user?.did ?? null}
                  anchorId={`listing-review-${review.id}`}
                  shareProductSlug={productSlug}
                  onEditReview={() => {
                    void navigate({
                      to: "/products/$productId/reviews/$reviewId/edit",
                      params: {
                        productId: productSlug,
                        reviewId: review.id,
                      },
                    });
                  }}
                />
              ))}
            </Flex>
          ) : (
            <Flex
              direction="column"
              justify="center"
              align="center"
              gap="2xl"
              style={styles.noReviews}
            >
              <Body variant="secondary">
                Be the first to review this product.
              </Body>
            </Flex>
          )}

          {previewReviews.length > 0 ? (
            <ButtonLink
              to="/products/$productId/reviews"
              params={{ productId: productSlug }}
              variant="secondary"
              size="lg"
            >
              View all
            </ButtonLink>
          ) : null}
        </Flex>

        {listingMentions.length > 0 ? (
          <Flex direction="column" gap="3xl">
            <Flex
              align="center"
              justify="between"
              gap="2xl"
              wrap
              style={styles.reviewsHeader}
            >
              <Text size="2xl" weight="semibold" style={styles.header}>
                Mentions
              </Text>
              {listingMentionTotal > 3 ? (
                <Flex gap="xl">
                  <ButtonLink
                    to="/products/$productId/mentions"
                    params={{ productId: productSlug }}
                    variant="secondary"
                  >
                    View all
                  </ButtonLink>
                </Flex>
              ) : null}
            </Flex>
            <Flex direction="column">
              {listingMentions.map((mention) => (
                <BlueskyMentionCard key={mention.id} mention={mention} />
              ))}
            </Flex>
          </Flex>
        ) : null}

        {relatedSectionListings.length > 0 ? (
          <RelatedProductsSection
            listings={relatedSectionListings}
            title={relatedSectionTitle}
          />
        ) : null}
      </Flex>
    </Page.Root>
  );
}

function HeroSection({
  listing,
  productId,
}: {
  listing: DirectoryListingDetail;
  productId: string;
}) {
  const primaryLink = listing.externalUrl || undefined;
  const buttonStyles = useButtonStyles({ variant: "secondary", size: "lg" });
  const { session } = Route.useLoaderData();
  const { data: favoriteStatus } = useSuspenseQuery(
    directoryListingApi.getDirectoryListingFavoriteStatusQueryOptions(
      productId,
    ),
  );
  const queryClient = useQueryClient();
  const favoriteStatusQueryOptions =
    directoryListingApi.getDirectoryListingFavoriteStatusQueryOptions(
      productId,
    );
  const profileFavoritesQueryOptions = session?.user?.did
    ? directoryListingApi.getProfileFavoriteListingsQueryOptions(
        session.user.did,
      )
    : null;
  const favoriteMutation = useMutation({
    mutationFn: async (nextIsFavorited: boolean) => {
      if (nextIsFavorited) {
        await directoryListingApi.favoriteDirectoryListing({
          data: { listingId: productId },
        });
        return;
      }
      await directoryListingApi.unfavoriteDirectoryListing({
        data: { listingId: productId },
      });
    },
    onMutate: async (nextIsFavorited: boolean) => {
      await queryClient.cancelQueries({
        queryKey: favoriteStatusQueryOptions.queryKey,
        exact: true,
      });
      const previousFavoriteStatus = queryClient.getQueryData(
        favoriteStatusQueryOptions.queryKey,
      );
      queryClient.setQueryData(favoriteStatusQueryOptions.queryKey, {
        isFavorited: nextIsFavorited,
      });
      return { previousFavoriteStatus };
    },
    onError: (_error, _nextIsFavorited, context) => {
      if (context?.previousFavoriteStatus !== undefined) {
        queryClient.setQueryData(
          favoriteStatusQueryOptions.queryKey,
          context.previousFavoriteStatus,
        );
      }
    },
    onSuccess: async (_result, nextIsFavorited) => {
      queryClient.setQueryData(favoriteStatusQueryOptions.queryKey, {
        isFavorited: nextIsFavorited,
      });
      if (profileFavoritesQueryOptions) {
        await queryClient.invalidateQueries({
          queryKey: profileFavoritesQueryOptions.queryKey,
          exact: true,
        });
      }
      globalThis.setTimeout(() => {
        void queryClient.invalidateQueries({
          queryKey: favoriteStatusQueryOptions.queryKey,
          exact: true,
        });
      }, 10_000);
    },
  });
  const canFavorite =
    Boolean(session?.user?.did) && Boolean(listing.atUri?.trim());

  const subproductCategories = collectSubproductCategories(
    listing.categorySlugs,
  );

  const verificationBadge = listing.isStoreManaged ? (
    <Tooltip text="This listing is managed by the ATStore team. Claim it to add more details.">
      <Pressable>
        <Badge size="sm" variant="warning" aria-label="Unverified listing">
          Unverified
        </Badge>
      </Pressable>
    </Tooltip>
  ) : (
    <Tooltip text="This listing is managed by the owner of the product.">
      <Pressable>
        <Badge size="sm" variant="success" aria-label="Claimed by owner">
          <BadgeCheck aria-hidden />
          Verified
        </Badge>
      </Pressable>
    </Tooltip>
  );

  const tags = (listing.appTags.length > 0 ||
    subproductCategories.length > 0) && (
    <Flex gap="md" style={styles.tagRow}>
      {subproductCategories.map((option) => (
        <RouterLink
          key={option.id}
          to="/categories/$categoryId"
          params={{ categoryId: option.id }}
          search={{ sort: "popular" }}
          {...stylex.props(styles.tagLink)}
        >
          <Badge size="sm" variant="default">
            {formatSubproductBadgeLabel(option)}
          </Badge>
        </RouterLink>
      ))}
      {listing.appTags.map((tag) => (
        <RouterLink
          key={tag}
          to="/apps/$tag"
          params={{ tag: getAppTagSlug(tag) }}
          search={{ sort: "popular" }}
          {...stylex.props(styles.tagLink)}
        >
          <Badge size="sm" variant="primary">
            {formatAppTagLabel(tag)}
          </Badge>
        </RouterLink>
      ))}
    </Flex>
  );

  const actions = (
    <Flex align="center" gap="md">
      {session?.user?.did && canFavorite ? (
        <ToggleButton
          variant="secondary"
          size="lg"
          isSelected={favoriteStatus.isFavorited}
          isDisabled={favoriteMutation.isPending}
          onPress={() =>
            void favoriteMutation.mutateAsync(!favoriteStatus.isFavorited)
          }
          aria-label={favoriteStatus.isFavorited ? "Unfavorite" : "Favorite"}
        >
          <Heart
            size={16}
            fill={favoriteStatus.isFavorited ? "currentColor" : "none"}
          />
        </ToggleButton>
      ) : null}
      {listing.productAccountDid ? (
        <AriaLink
          {...stylex.props(buttonStyles, styles.iconButton)}
          href={`https://bsky.app/profile/${listing.productAccountDid}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          <BlueskyIcon />
        </AriaLink>
      ) : null}
      {primaryLink ? (
        <ButtonLink
          to={primaryLink}
          size="lg"
          target="_blank"
          rel="noopener noreferrer"
        >
          Explore <ExternalLink />
        </ButtonLink>
      ) : null}
    </Flex>
  );

  return (
    <Flex direction="column" gap="6xl">
      {listing.heroImageUrl && (
        <HeroImage
          alt={getDirectoryListingHeroImageAlt(listing)}
          glowIntensity={0.9}
          src={listing.heroImageUrl}
        />
      )}

      <Flex direction="column" gap="3xl" style={styles.heroContent}>
        <Flex
          style={styles.mobileOnly}
          justify="between"
          gap="lg"
          align="center"
        >
          {tags}
          {actions}
        </Flex>
        <Flex direction="column" gap="lg">
          <Flex gap="2xl" align="center" style={styles.heroHeader}>
            <Avatar
              alt={listing.name}
              fallback={getInitials(listing.name)}
              size="xl"
              src={listing.iconUrl || undefined}
              style={styles.heroAvatar}
            />
            <Flex direction="column" gap="2xl" style={styles.heroHeaderText}>
              <Flex gap="xl" align="center" wrap>
                <Text
                  font="title"
                  size={{ default: "4xl", sm: "4xl" }}
                  weight="semibold"
                  style={styles.heroTitle}
                >
                  {listing.name}
                </Text>
                {verificationBadge}
                <div {...stylex.props(styles.desktopOnly)}>{tags}</div>
              </Flex>
              <Body style={[styles.heroTagline, styles.desktopOnly]}>
                {listing.tagline}
              </Body>
            </Flex>

            <div {...stylex.props(styles.desktopOnly)}>{actions}</div>
          </Flex>
          <Body style={[styles.heroTagline, styles.mobileOnly]}>
            {listing.tagline}
          </Body>
        </Flex>
      </Flex>
    </Flex>
  );
}

function ProductEcosystemSection({
  ecosystemRootId,
}: {
  ecosystemRootId: string;
}) {
  const { data } = useSuspenseQuery(
    directoryListingApi.getDirectoryCategoryPageQueryOptions({
      categoryId: ecosystemRootId,
      sort: "popular",
    }),
  );

  const appSegment = getAppSegmentFromEcosystemRootCategoryId(ecosystemRootId);

  if (!data || !appSegment) {
    return null;
  }

  const { category } = data;

  if (category.children.length === 0) {
    return null;
  }

  return (
    <Flex direction="column" gap="4xl" style={styles.ecosystemSection}>
      <Flex align="end" gap="3xl" style={styles.ecosystemHeader}>
        <Flex direction="column" gap="lg">
          <Text size="2xl" weight="semibold" style={styles.header}>
            Ecosystem
          </Text>
          <Body variant="secondary">
            Discover tools and products built for this app.
          </Body>
        </Flex>
        <Flex gap="2xl" style={styles.ecosystemLinks}>
          <ButtonLink
            variant="secondary"
            to="/ecosystems/$app"
            params={{ app: appSegment }}
          >
            Explore
          </ButtonLink>
        </Flex>
      </Flex>
      {category.children.length > 0 ? (
        <Grid style={styles.ecosystemGrid}>
          {category.children.map((child) => (
            <EcosystemCategoryCard key={child.id} category={child} />
          ))}
        </Grid>
      ) : (
        <Body variant="secondary">
          Explore this app&apos;s directory tree from the ecosystem home page,
          or search every listing filed under it.
        </Body>
      )}
    </Flex>
  );
}

function RelatedProductsSection({
  listings,
  title = "More Apps",
}: {
  listings: Array<DirectoryListingCard>;
  title?: string;
}) {
  return (
    <Flex direction="column" gap="3xl" style={styles.relatedSection}>
      <Text size="2xl" weight="semibold" style={styles.header}>
        {title}
      </Text>
      <Grid style={styles.relatedGrid}>
        {listings.map((listing) => (
          <RelatedProductCard key={listing.id} listing={listing} />
        ))}
      </Grid>
    </Flex>
  );
}

function RelatedProductCard({ listing }: { listing: DirectoryListingCard }) {
  return (
    <RouterLink
      to="/products/$productId"
      params={{ productId: getDirectoryListingSlug(listing) }}
      {...stylex.props(styles.relatedLink)}
    >
      <Card style={styles.relatedCard}>
        <Flex direction="column" style={styles.relatedCardBody}>
          <Flex align="center" gap="2xl" style={styles.relatedHeader}>
            <Avatar
              alt={listing.name}
              fallback={getInitials(listing.name)}
              size="xl"
              src={listing.iconUrl || undefined}
            />
            <Flex direction="column" gap="lg" style={styles.relatedInfo}>
              <Text size="xl" weight="semibold">
                {listing.name}
              </Text>
              <Text size="sm" variant="secondary">
                {listing.category}
              </Text>
            </Flex>
          </Flex>
          <Body variant="secondary" style={styles.relatedTagline}>
            {listing.tagline}
          </Body>
          <Flex justify="end" gap="xl" style={styles.relatedFooter}>
            <Flex align="center" gap="sm">
              <SmallBody variant="secondary">
                {listing.rating == null ? "—" : listing.rating.toFixed(1)}
              </SmallBody>
              <StarRating
                rating={listing.rating}
                reviewCount={listing.reviewCount}
                showReviewCount
              />
            </Flex>
          </Flex>
        </Flex>
      </Card>
    </RouterLink>
  );
}
