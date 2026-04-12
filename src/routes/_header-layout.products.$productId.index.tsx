import * as stylex from "@stylexjs/stylex";
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import {
  createFileRoute,
  createLink,
  Link as RouterLink,
  notFound,
  redirect,
  useCanGoBack,
  useNavigate,
  useRouter,
} from "@tanstack/react-router";
import { ChevronLeft, ExternalLink, Heart } from "lucide-react";
import { useState } from "react";
import { Link as AriaLink } from "react-aria-components";

import { Avatar } from "../design-system/avatar";
import { Badge } from "../design-system/badge";
import { Button } from "../design-system/button";
import { Card } from "../design-system/card";
import { Flex } from "../design-system/flex";
import { Grid } from "../design-system/grid";
import { Link } from "../design-system/link";
import { Lightbox } from "../design-system/lightbox";
import { Page } from "../design-system/page";
import { StarRating } from "../design-system/star-rating";
import { fontSize } from "../design-system/theme/typography.stylex";
import { uiColor } from "../design-system/theme/color.stylex";
import { breakpoints } from "../design-system/theme/media-queries.stylex";
import {
  gap,
  horizontalSpace,
  size,
  verticalSpace,
} from "../design-system/theme/semantic-spacing.stylex";
import { radius } from "../design-system/theme/radius.stylex";
import { shadow } from "../design-system/theme/shadow.stylex";
import {
  Body,
  Heading2,
  SmallBody,
  SubLabel,
} from "../design-system/typography";
import { Text } from "../design-system/typography/text";
import { DirectoryListingReviewCard } from "../components/DirectoryListingReviewCard";
import { EcosystemCategoryCard } from "../components/EcosystemCategoryCard";
import {
  directoryListingApi,
  type DirectoryListingCard,
  type DirectoryListingDetail,
} from "../integrations/tanstack-query/api-directory-listings.functions";
import { user } from "../integrations/tanstack-query/api-user.functions";
import {
  getAppEcosystemRootCategoryId,
  getAppSegmentFromEcosystemRootCategoryId,
} from "../lib/directory-categories";
import { pickListingImageForCategoryBranch } from "../lib/ecosystem-listings";
import { PRODUCT_REVIEW_PREVIEW_COUNT } from "../lib/product-reviews";
import { formatAppTagLabel, getAppTagSlug } from "../lib/app-tag-metadata";
import {
  getDirectoryListingSlug,
  getLegacyDirectoryListingId,
} from "../lib/directory-listing-slugs";
import { buildRouteOgMeta } from "../lib/og-meta";
import { useButtonStyles } from "#/design-system/theme/useButtonStyles";
import { BlueskyIcon } from "#/components/bluesky-icon";
import { ToggleButton } from "#/design-system/toggle-button";

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

    const listingReviews = await context.queryClient.ensureQueryData(
      directoryListingApi.getDirectoryListingReviewsQueryOptions(listing.id),
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

    return {
      productId: listing.id,
      productSlug,
      ecosystemRootId,
      listing,
      relatedProducts,
      listingReviews,
      session,
      editAccess,
      ogTitle: `${listing.name} | at-store`,
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
  iconButton: {
    height: size["4xl"],
    width: size["4xl"],
  },
  noReviews: {
    paddingTop: verticalSpace["8xl"],
    paddingBottom: verticalSpace["8xl"],
    borderStyle: "dashed",
    borderWidth: 1,
    borderColor: uiColor.border2,
    borderRadius: radius["xl"],
    cornerShape: "squircle",
  },
  ecosystemSection: {
    marginTop: verticalSpace["5xl"],
  },
  heroAvatar: {
    height: size["7xl"],
    width: size["7xl"],
  },
  page: {
    paddingBottom: verticalSpace["11xl"],
    paddingTop: verticalSpace["6xl"],
    position: "relative",
  },
  backLinkRow: {
    alignItems: "center",
    width: "100%",
  },
  hero: {
    borderRadius: radius["3xl"],
    cornerShape: "squircle",
    overflow: "hidden",
    position: "relative",
  },
  heroImage: {
    aspectRatio: "16 / 9",
    display: "block",
    objectFit: "cover",
    width: "100%",
  },
  heroImageOverlay: {
    backgroundImage: `linear-gradient(180deg, color-mix(in srgb, ${uiColor.overlayBackdrop} 6%, transparent) 0%, color-mix(in srgb, ${uiColor.overlayBackdrop} 24%, transparent) 38%, color-mix(in srgb, ${uiColor.overlayBackdrop} 92%, transparent) 100%)`,
    inset: 0,
    position: "absolute",
  },
  heroFallback: {
    alignItems: "center",
    aspectRatio: "16 / 9",
    display: "flex",
    justifyContent: "center",
    width: "100%",
  },
  heroFallbackIcon: {
    backgroundColor: `color-mix(in srgb, ${uiColor.overlayBackdrop} 24%, transparent)`,
    borderRadius: radius["3xl"],
    color: uiColor.textContrast,
    paddingBottom: verticalSpace["3xl"],
    paddingLeft: horizontalSpace["3xl"],
    paddingRight: horizontalSpace["3xl"],
    paddingTop: verticalSpace["3xl"],
  },
  heroOverlay: {
    background: `linear-gradient(180deg, color-mix(in srgb, ${uiColor.overlayBackdrop} 6%, transparent) 0%, color-mix(in srgb, ${uiColor.overlayBackdrop} 24%, transparent) 38%, color-mix(in srgb, ${uiColor.overlayBackdrop} 92%, transparent) 100%)`,
    inset: 0,
    position: "absolute",
  },
  heroHeader: {
    boxSizing: "border-box",
    color: uiColor.textContrast,
    paddingBottom: verticalSpace["2xl"],
  },
  heroHeaderText: {
    flex: 1,
    minWidth: 0,
  },
  heroTitle: {
    display: "block",
    color: uiColor.text2,
  },
  heroTagline: {
    color: uiColor.text1,
  },
  tagRow: {
    flexWrap: "wrap",
  },
  tagLink: {
    textDecoration: "none",
  },
  ctaRow: {
    alignItems: "center",
    flexWrap: "wrap",
  },
  ratingRow: {
    alignItems: "center",
  },
  metadataGridItem: {
    flexGrow: 1,
    flexBasis: "240px",
  },
  metaCard: {
    boxShadow: shadow.sm,
    height: "100%",
  },
  metaCardBody: {
    paddingLeft: horizontalSpace["5xl"],
    paddingRight: horizontalSpace["5xl"],
    paddingTop: verticalSpace["5xl"],
    paddingBottom: verticalSpace["5xl"],
  },
  metaLabel: {
    textTransform: "uppercase",
  },
  metaIcon: {
    color: uiColor.text1,
  },
  previewsSection: {
    gap: gap["2xl"],
  },
  previewGrid: {
    display: "grid",
    gap: gap["2xl"],
    gridTemplateColumns: {
      default: "1fr",
      [breakpoints.sm]: "repeat(2, minmax(0, 1fr))",
      [breakpoints.lg]: "repeat(3, minmax(0, 1fr))",
    },
  },
  previewCard: {
    boxShadow: shadow.sm,
  },
  previewImage: {
    aspectRatio: "16 / 10",
    display: "block",
    objectFit: "cover",
    width: "100%",
  },
  descriptionCard: {
    boxShadow: shadow.sm,
  },
  descriptionText: {
    whiteSpace: "pre-wrap",
    fontSize: fontSize["xl"],
  },
  detailsCard: {
    boxShadow: shadow.sm,
  },
  detailsBody: {
    gap: gap["xl"],
  },
  detailRow: {
    gap: gap["xl"],
    paddingBottom: verticalSpace["lg"],
    paddingTop: verticalSpace["lg"],
  },
  detailLabel: {
    minWidth: "8rem",
  },
  detailValue: {
    minWidth: 0,
    textAlign: "right",
  },
  reviewsHeader: {
    alignItems: "flex-start",
    paddingTop: verticalSpace["5xl"],
  },
  reviewsHeaderTop: {
    width: "100%",
  },
  reviewsActions: {
    flexWrap: "wrap",
  },
  reviewsGrid: {
    display: "grid",
    gap: gap["2xl"],
    gridTemplateColumns: "1fr",
  },
  relatedSection: {
    paddingTop: verticalSpace["6xl"],
  },
  relatedGrid: {
    display: "grid",
    gap: gap["2xl"],
    gridTemplateColumns: {
      default: "1fr",
      [breakpoints.lg]: "repeat(3, minmax(0, 1fr))",
    },
  },
  ecosystemGrid: {
    display: "grid",
    gap: gap["2xl"],
    gridTemplateColumns: {
      default: "1fr",
      [breakpoints.sm]: "repeat(2, minmax(0, 1fr))",
      [breakpoints.lg]: "repeat(3, minmax(0, 1fr))",
    },
  },
  ecosystemHeader: {
    alignItems: "flex-start",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  ecosystemLinks: {
    flexWrap: "wrap",
  },
  relatedLink: {
    display: "block",
    height: "100%",
    textDecoration: "none",
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
    flex: 1,
    minWidth: 0,
  },
  relatedTagline: {
    flexGrow: 1,
  },
  relatedFooter: {
    alignItems: "center",
  },
  devToolbar: {
    bottom: verticalSpace["4xl"],
    boxShadow: shadow.md,
    position: "fixed",
    right: horizontalSpace["4xl"],
    width: "min(22rem, calc(100% - 2rem))",
    zIndex: 1,
  },
  devToolbarBody: {
    gap: gap["lg"],
    paddingBottom: verticalSpace["lg"],
    paddingLeft: horizontalSpace["lg"],
    paddingRight: horizontalSpace["lg"],
    paddingTop: verticalSpace["lg"],
  },
  devToolbarButtons: {
    gap: gap["lg"],
  },
  devToolbarStatus: {
    minHeight: "1.25rem",
  },
  imageReviewPanel: {
    bottom: verticalSpace["4xl"],
    boxShadow: shadow.lg,
    left: horizontalSpace["4xl"],
    maxHeight: "min(70vh, 520px)",
    maxWidth: "min(40rem, calc(100% - 8rem))",
    overflow: "auto",
    position: "fixed",
    width: "min(40rem, calc(100% - 8rem))",
    zIndex: 25,
  },
  imageReviewCardBody: {
    gap: gap["2xl"],
    paddingBottom: verticalSpace["4xl"],
    paddingLeft: horizontalSpace["4xl"],
    paddingRight: horizontalSpace["4xl"],
    paddingTop: verticalSpace["4xl"],
  },
  imageReviewHeading: {
    color: uiColor.text2,
  },
  imageReviewFigure: {
    alignItems: "center",
    backgroundColor: `color-mix(in srgb, ${uiColor.overlayBackdrop} 8%, transparent)`,
    borderRadius: radius["2xl"],
    display: "flex",
    justifyContent: "center",
    margin: 0,
    maxHeight: "min(42vh, 360px)",
    overflow: "hidden",
    padding: horizontalSpace["2xl"],
  },
  imageReviewHeroImg: {
    borderRadius: radius["xl"],
    display: "block",
    height: "auto",
    maxHeight: "min(40vh, 340px)",
    maxWidth: "100%",
    objectFit: "contain",
  },
  imageReviewIconImg: {
    borderRadius: radius["2xl"],
    display: "block",
    height: "auto",
    maxHeight: 192,
    maxWidth: 192,
    objectFit: "contain",
  },
  imageReviewActions: {
    gap: gap["2xl"],
    justifyContent: "flex-end",
  },
  screenshotsSection: {
    paddingTop: verticalSpace["4xl"],
  },
  screenshotCarousel: {
    display: "flex",
    flexDirection: "row",
    gap: gap["xl"],
    overflowX: "auto",
    overscrollBehaviorX: "contain",
    scrollSnapType: "x mandatory",
    width: "100%",
  },
  screenshotSlide: {
    flexShrink: 0,
    flexBasis: "auto",
    scrollSnapAlign: "start",
  },
  screenshotButton: {
    appearance: "none",
    backgroundColor: "transparent",
    borderColor: "transparent",
    borderStyle: "solid",
    borderWidth: 0,
    cursor: "zoom-in",
    display: "block",
    margin: 0,
    padding: 0,
    width: "auto",
  },
  screenshotImage: {
    backgroundColor: `color-mix(in srgb, ${uiColor.overlayBackdrop} 8%, transparent)`,
    borderRadius: radius["md"],
    display: "block",
    height: "auto",
    maxHeight: 180,
    objectFit: "contain",
    width: "auto",
  },
});

function ProductPage() {
  const {
    productId,
    productSlug,
    ecosystemRootId,
    listing,
    relatedProducts,
    listingReviews,
    session,
    editAccess,
  } = Route.useLoaderData();

  const queryClient = useQueryClient();

  const detailQueryOptions =
    directoryListingApi.getDirectoryListingDetailQueryOptions(productId);
  const relatedQueryOptions =
    directoryListingApi.getRelatedDirectoryListingsQueryOptions({
      id: productId,
      limit: 3,
    });

  if (!listing) {
    throw notFound();
  }

  const previewReviews = listingReviews.slice(0, PRODUCT_REVIEW_PREVIEW_COUNT);

  const [type, scope, domain] = listing.categoryPathLabel?.split(" / ") || [];
  const isRootApp = type === "Apps" && scope && !domain;
  const canGoBack = useCanGoBack();
  const navigate = useNavigate();
  const router = useRouter();
  const [pendingGeneration, setPendingGeneration] = useState<
    null | "hero" | "icon" | "tagline" | "description"
  >(null);
  const [pendingImageCommit, setPendingImageCommit] = useState(false);
  const [imageReviewDraft, setImageReviewDraft] = useState<null | {
    kind: "hero" | "icon";
    mimeType: string;
    imageBase64: string;
    /** Icon preview only: discovered on site vs Gemini */
    previewSource?: "site_asset" | "model";
  }>(null);
  const [toolbarStatus, setToolbarStatus] = useState<{
    tone: "neutral" | "critical";
    text: string;
  } | null>(null);
  const [isScreenshotLightboxOpen, setIsScreenshotLightboxOpen] =
    useState(false);
  const [screenshotLightboxIndex, setScreenshotLightboxIndex] = useState(0);

  const listingId = listing.id;

  function dismissImageReview() {
    setImageReviewDraft(null);
    setToolbarStatus(null);
  }

  async function commitImageReview() {
    if (!imageReviewDraft) {
      return;
    }
    setPendingImageCommit(true);
    setToolbarStatus(null);
    try {
      const { kind, mimeType, imageBase64 } = imageReviewDraft;
      if (kind === "hero") {
        await directoryListingApi.commitDirectoryListingHeroImage({
          data: {
            id: listingId,
            mimeType,
            imageBase64,
          },
        });
        setToolbarStatus({
          tone: "neutral",
          text: "Published the new hero image to the listing record.",
        });
      } else {
        await directoryListingApi.commitDirectoryListingIcon({
          data: {
            id: listingId,
            mimeType,
            imageBase64,
          },
        });
        setToolbarStatus({
          tone: "neutral",
          text: "Published the new icon to the listing record.",
        });
      }
      setImageReviewDraft(null);
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: detailQueryOptions.queryKey,
          exact: true,
        }),
        queryClient.invalidateQueries({
          queryKey: relatedQueryOptions.queryKey,
          exact: true,
        }),
        router.invalidate(),
      ]);
    } catch (error) {
      setToolbarStatus({
        tone: "critical",
        text: error instanceof Error ? error.message : "Publish failed.",
      });
    } finally {
      setPendingImageCommit(false);
    }
  }

  async function runGeneration(
    action: "hero" | "icon" | "tagline" | "description",
  ) {
    setPendingGeneration(action);
    setToolbarStatus(null);

    try {
      if (action === "hero") {
        const preview =
          await directoryListingApi.previewDirectoryListingHeroImage({
            data: {
              id: listingId,
            },
          });
        setImageReviewDraft({
          kind: "hero",
          mimeType: preview.mimeType,
          imageBase64: preview.imageBase64,
        });
        setToolbarStatus({
          tone: "neutral",
          text: "Review the hero preview below, then accept or discard.",
        });
      } else if (action === "icon") {
        const preview = await directoryListingApi.previewDirectoryListingIcon({
          data: {
            id: listingId,
          },
        });
        setImageReviewDraft({
          kind: "icon",
          mimeType: preview.mimeType,
          imageBase64: preview.imageBase64,
          previewSource: preview.previewSource,
        });
        setToolbarStatus({
          tone: "neutral",
          text:
            preview.previewSource === "site_asset"
              ? "Preview from site favicon/logo, refined with Gemini. Accept or discard."
              : "Review the generated icon below, then accept or discard.",
        });
      } else if (action === "tagline") {
        const result =
          await directoryListingApi.regenerateDirectoryListingTagline({
            data: {
              id: listingId,
            },
          });
        setToolbarStatus({
          tone: "neutral",
          text:
            result.source === "website"
              ? "Generated a new tagline from homepage copy."
              : "Generated a new tagline from homepage context.",
        });
      } else {
        const result =
          await directoryListingApi.regenerateDirectoryListingDescription({
            data: {
              id: listingId,
            },
          });
        setToolbarStatus({
          tone: "neutral",
          text:
            result.source === "website"
              ? "Generated a new description from homepage copy."
              : "Generated a new description from homepage context.",
        });
      }

      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: detailQueryOptions.queryKey,
          exact: true,
        }),
        queryClient.invalidateQueries({
          queryKey: relatedQueryOptions.queryKey,
          exact: true,
        }),
        router.invalidate(),
      ]);
    } catch (error) {
      setToolbarStatus({
        tone: "critical",
        text: error instanceof Error ? error.message : "Generation failed.",
      });
    } finally {
      setPendingGeneration(null);
    }
  }

  return (
    <Page.Root variant="small" style={styles.page}>
      <Flex direction="column" gap="6xl">
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
          {editAccess?.canEdit ? (
            <AppLink
              to="/products/$productId/edit"
              params={{ productId: productSlug }}
            >
              Edit listing
            </AppLink>
          ) : null}
        </Flex>
        {editAccess?.needsClaim ? (
          <Text size="sm" variant="secondary">
            This listing is still published from the store account.{" "}
            <AppLink to="/product/claim">Claim it</AppLink> to edit from your
            PDS.
          </Text>
        ) : null}
        <HeroSection listing={listing} productId={productId} />
        <Flex direction="column" gap="5xl">
          {getDescriptionBlocks(listing.description).map((block, index) => (
            <Body
              key={`${listing.id}-description-${index}`}
              style={styles.descriptionText}
            >
              {block}
            </Body>
          ))}
        </Flex>
        {type === "Apps" ? (
          domain ? (
            <Flex gap="xl">
              <MetaCard label="App" value={scope} />
              <MetaCard label="Domain" value={domain} />
            </Flex>
          ) : null
        ) : (
          <Flex gap="xl">
            <MetaCard label="Type" value={type || "Unknown"} />
            <MetaCard label="Domain" value={scope || "Unknown"} />
          </Flex>
        )}

        {/* screenshots */}
        {listing.screenshots.length > 0 ? (
          <Flex direction="column" gap="4xl" style={styles.screenshotsSection}>
            <Text size="2xl" weight="semibold">
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
              <Flex gap="4xl" align="center">
                <Heading2>Reviews</Heading2>
                <Flex gap="md" style={styles.ratingRow}>
                  <StarRating
                    rating={listing.rating}
                    reviewCount={listing.reviewCount}
                    showReviewCount
                  />
                  <Text weight="semibold">
                    {listing.rating != null ? listing.rating.toFixed(1) : "—"}
                  </Text>
                </Flex>
              </Flex>
              <Flex gap="xl" style={styles.reviewsActions}>
                <ButtonLink
                  to="/products/$productId/reviews"
                  params={{ productId: productSlug }}
                  size="lg"
                  variant="secondary"
                >
                  View all
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

          <ButtonLink
            to="/products/$productId/reviews/write"
            params={{ productId: productSlug }}
            size="lg"
            variant="secondary"
          >
            Create review
          </ButtonLink>
        </Flex>
        {relatedProducts.length > 0 ? (
          <RelatedProductsSection listings={relatedProducts} />
        ) : null}
      </Flex>
      {import.meta.env.DEV && imageReviewDraft ? (
        <Card style={styles.imageReviewPanel}>
          <Flex direction="column" style={styles.imageReviewCardBody}>
            <Text size="sm" weight="semibold" style={styles.imageReviewHeading}>
              {imageReviewDraft.kind === "hero"
                ? "Review new hero image"
                : "Review new icon"}
            </Text>
            {imageReviewDraft.kind === "icon" &&
            imageReviewDraft.previewSource ? (
              <Text size="sm" variant="secondary">
                {imageReviewDraft.previewSource === "site_asset"
                  ? "Sourced from site favicon or logo asset, then refined with Gemini."
                  : "Generated from a homepage screenshot."}
              </Text>
            ) : null}
            <figure {...stylex.props(styles.imageReviewFigure)}>
              <img
                alt={
                  imageReviewDraft.kind === "hero"
                    ? "Generated hero preview"
                    : "Generated icon preview"
                }
                src={`data:${imageReviewDraft.mimeType};base64,${imageReviewDraft.imageBase64}`}
                {...stylex.props(
                  imageReviewDraft.kind === "hero"
                    ? styles.imageReviewHeroImg
                    : styles.imageReviewIconImg,
                )}
              />
            </figure>
            <Flex style={styles.imageReviewActions}>
              <Button
                variant="secondary"
                isDisabled={pendingImageCommit}
                onPress={dismissImageReview}
              >
                Discard
              </Button>
              <Button
                isPending={pendingImageCommit}
                isDisabled={pendingImageCommit}
                onPress={() => void commitImageReview()}
              >
                Publish to listing
              </Button>
            </Flex>
          </Flex>
        </Card>
      ) : null}
      {import.meta.env.DEV ? (
        <Card style={styles.devToolbar}>
          <Flex direction="column" style={styles.devToolbarBody}>
            <Text size="sm" weight="semibold">
              Dev tools
            </Text>
            <Flex direction="column" style={styles.devToolbarButtons}>
              <Button
                variant="secondary"
                isPending={pendingGeneration === "icon"}
                isDisabled={
                  pendingGeneration !== null || imageReviewDraft !== null
                }
                onPress={() => void runGeneration("icon")}
              >
                Generate icon
              </Button>
              <Button
                variant="secondary"
                isPending={pendingGeneration === "hero"}
                isDisabled={
                  pendingGeneration !== null || imageReviewDraft !== null
                }
                onPress={() => void runGeneration("hero")}
              >
                Generate hero image
              </Button>
              <Button
                variant="secondary"
                isPending={pendingGeneration === "tagline"}
                isDisabled={pendingGeneration !== null}
                onPress={() => void runGeneration("tagline")}
              >
                Generate tagline
              </Button>
              <Button
                variant="secondary"
                isPending={pendingGeneration === "description"}
                isDisabled={pendingGeneration !== null}
                onPress={() => void runGeneration("description")}
              >
                Generate description
              </Button>
            </Flex>
            <Text
              size="sm"
              variant={
                toolbarStatus?.tone === "critical" ? "critical" : "secondary"
              }
              style={styles.devToolbarStatus}
            >
              {toolbarStatus?.text ?? " "}
            </Text>
          </Flex>
        </Card>
      ) : null}
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
      window.setTimeout(() => {
        void queryClient.invalidateQueries({
          queryKey: favoriteStatusQueryOptions.queryKey,
          exact: true,
        });
      }, 10_000);
    },
  });
  const canFavorite =
    Boolean(session?.user?.did) && Boolean(listing.atUri?.trim());

  return (
    <Flex direction="column" gap="6xl">
      {listing.heroImageUrl && (
        <div {...stylex.props(styles.hero)}>
          <img
            alt={`${listing.name} preview`}
            src={listing.heroImageUrl}
            {...stylex.props(styles.heroImage)}
          />
          <div {...stylex.props(styles.heroOverlay)} />
        </div>
      )}

      <Flex gap="2xl" align="center" style={styles.heroHeader}>
        <Avatar
          alt={listing.name}
          fallback={getInitials(listing.name)}
          size="xl"
          src={listing.iconUrl || undefined}
          style={styles.heroAvatar}
        />
        <Flex direction="column" gap="2xl" style={styles.heroHeaderText}>
          <Flex gap="xl" align="center">
            <Text
              font="title"
              size={{ default: "4xl", sm: "4xl" }}
              weight="semibold"
              style={styles.heroTitle}
            >
              {listing.name}
            </Text>
            {listing.appTags.length > 0 ? (
              <Flex gap="md" style={styles.tagRow}>
                {listing.appTags.map((tag) => (
                  <RouterLink
                    key={tag}
                    to="/apps/$tag"
                    params={{ tag: getAppTagSlug(tag) }}
                    {...stylex.props(styles.tagLink)}
                  >
                    <Badge size="sm" variant="primary">
                      {formatAppTagLabel(tag)}
                    </Badge>
                  </RouterLink>
                ))}
              </Flex>
            ) : null}
          </Flex>
          <Body style={styles.heroTagline}>{listing.tagline}</Body>
        </Flex>

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
              aria-label={
                favoriteStatus.isFavorited ? "Unfavorite" : "Favorite"
              }
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
              {listing.priceLabel} <ExternalLink />
            </ButtonLink>
          ) : null}
        </Flex>
      </Flex>
    </Flex>
  );
}

function MetaCard({ label, value }: { label: string; value: string }) {
  return (
    <Card style={[styles.metaCard, styles.metadataGridItem]}>
      <Flex
        direction="column"
        align="center"
        gap="2xl"
        style={styles.metaCardBody}
      >
        <SubLabel variant="secondary" style={styles.metaLabel}>
          {label}
        </SubLabel>
        <Text weight="semibold">{value}</Text>
      </Flex>
    </Card>
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
    }),
  );

  const appSegment = getAppSegmentFromEcosystemRootCategoryId(ecosystemRootId);

  if (!data || !appSegment) {
    return null;
  }

  const { category, listings } = data;

  if (!category.children.length) {
    return null;
  }

  return (
    <Flex direction="column" gap="4xl" style={styles.ecosystemSection}>
      <Flex align="center" gap="5xl" style={styles.ecosystemHeader}>
        <Flex direction="column" gap="2xl">
          <Heading2>Ecosystem</Heading2>
          <Body variant="secondary">
            Discover tools and products built for this app.
          </Body>
        </Flex>
        <Flex gap="2xl" style={styles.ecosystemLinks}>
          <ButtonLink
            size="lg"
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
            <EcosystemCategoryCard
              key={child.id}
              category={child}
              imageSrc={pickListingImageForCategoryBranch(child.id, listings)}
            />
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
}: {
  listings: DirectoryListingCard[];
}) {
  return (
    <Flex direction="column" gap="4xl" style={styles.relatedSection}>
      <Heading2>More Apps</Heading2>
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
                {listing.rating != null ? listing.rating.toFixed(1) : "—"}
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

function getInitials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("");
}

function getDescriptionBlocks(description: string) {
  const blocks = description
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean);

  return blocks.length > 0 ? blocks : [description];
}
