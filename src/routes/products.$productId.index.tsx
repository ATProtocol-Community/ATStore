import * as stylex from "@stylexjs/stylex";
import { useSuspenseQuery } from "@tanstack/react-query";
import {
  createFileRoute,
  createLink,
  Link as RouterLink,
  notFound,
} from "@tanstack/react-router";
import { ChevronLeft, ExternalLink } from "lucide-react";

import { Avatar } from "../design-system/avatar";
import { Badge } from "../design-system/badge";
import { Button } from "../design-system/button";
import { Card } from "../design-system/card";
import { Flex } from "../design-system/flex";
import { Grid } from "../design-system/grid";
import { HeaderLayout } from "../design-system/header-layout";
import { Link } from "../design-system/link";
import { Page } from "../design-system/page";
import { StarRating } from "../design-system/star-rating";
import { blue } from "../design-system/theme/colors/blue.stylex";
import { fontSize } from "../design-system/theme/typography.stylex";
import { green } from "../design-system/theme/colors/green.stylex";
import { pink } from "../design-system/theme/colors/pink.stylex";
import { purple } from "../design-system/theme/colors/purple.stylex";
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
import { Body, Heading2, SubLabel } from "../design-system/typography";
import { Text } from "../design-system/typography/text";
import {
  directoryListingApi,
  type DirectoryListingCard,
  type DirectoryListingDetail,
} from "../integrations/tanstack-query/api-directory-listings.functions";
import {
  getPlaceholderReviews,
  PRODUCT_REVIEW_PREVIEW_COUNT,
} from "../lib/product-reviews";
import { formatAppTagLabel, getAppTagSlug } from "../lib/app-tag-metadata";

const ButtonLink = createLink(Button);

export const Route = createFileRoute("/products/$productId/")({
  loader: async ({ context, params }) => {
    const [listing] = await Promise.all([
      context.queryClient.ensureQueryData(
        directoryListingApi.getDirectoryListingDetailQueryOptions(
          params.productId,
        ),
      ),
      context.queryClient.ensureQueryData(
        directoryListingApi.getRelatedDirectoryListingsQueryOptions({
          id: params.productId,
          limit: 3,
        }),
      ),
    ]);

    if (!listing) {
      throw notFound();
    }

    return { productId: params.productId };
  },
  component: ProductPage,
});

const styles = stylex.create({
  heroAvatar: {
    height: size["7xl"],
    width: size["7xl"],
  },
  page: {
    paddingBottom: verticalSpace["11xl"],
    paddingTop: verticalSpace["6xl"],
  },
  backLinkRow: {
    alignItems: "center",
  },
  hero: {
    borderRadius: radius["3xl"],
    borderStyle: "solid",
    borderWidth: 1,
    cornerShape: "squircle",
    overflow: "hidden",
    position: "relative",
  },
  heroBlue: {
    backgroundImage: `linear-gradient(135deg, ${blue.solid1} 0%, ${blue.solid2} 45%, ${blue.border3} 100%)`,
    borderColor: blue.border1,
  },
  heroPink: {
    backgroundImage: `linear-gradient(135deg, ${pink.solid1} 0%, ${pink.solid2} 45%, ${purple.solid1} 100%)`,
    borderColor: pink.border1,
  },
  heroPurple: {
    backgroundImage: `linear-gradient(135deg, ${purple.solid1} 0%, ${purple.solid2} 45%, ${pink.border3} 100%)`,
    borderColor: purple.border1,
  },
  heroGreen: {
    backgroundImage: `linear-gradient(135deg, ${green.solid1} 0%, ${green.solid2} 45%, ${green.border3} 100%)`,
    borderColor: green.border1,
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
  metadataGrid: {
    display: "grid",
    gap: gap["2xl"],
    gridTemplateColumns: {
      default: "1fr",
      [breakpoints.sm]: "repeat(3, minmax(0, 1fr))",
    },
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
  reviewCard: {
    boxShadow: shadow.sm,
    height: "100%",
  },
  reviewCardBody: {
    gap: gap["5xl"],
    height: "100%",
    paddingBottom: verticalSpace["4xl"],
    paddingLeft: horizontalSpace["4xl"],
    paddingRight: horizontalSpace["4xl"],
    paddingTop: verticalSpace["4xl"],
  },
  reviewHeader: {
    alignItems: "center",
  },
  reviewAuthor: {
    flex: 1,
    minWidth: 0,
  },
  reviewMeta: {
    color: uiColor.text1,
  },
  reviewQuote: {
    fontSize: fontSize["lg"],
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
});

function ProductPage() {
  const { productId } = Route.useLoaderData();
  const { data: listing } = useSuspenseQuery(
    directoryListingApi.getDirectoryListingDetailQueryOptions(productId),
  );
  const { data: relatedProducts } = useSuspenseQuery(
    directoryListingApi.getRelatedDirectoryListingsQueryOptions({
      id: productId,
      limit: 3,
    }),
  );

  if (!listing) {
    throw notFound();
  }

  const reviews = getPlaceholderReviews(listing);

  return (
    <HeaderLayout.Root>
      <HeaderLayout.Page>
        <Page.Root variant="small" style={styles.page}>
          <Flex direction="column" gap="6xl">
            <Flex style={styles.backLinkRow}>
              <Link href="/">
                <ChevronLeft />
                Back to directory
              </Link>
            </Flex>

            <HeroSection listing={listing} />

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

            <Grid style={styles.metadataGrid}>
              <MetaCard label="Scope" value={listing.scope || "Unknown"} />
              <MetaCard label="Domain" value={listing.domain || "Unknown"} />
              <MetaCard
                label="Product type"
                value={listing.productType || listing.rawCategoryHint || "Tool"}
              />
            </Grid>

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
                        showReviewCount={false}
                      />
                      <Text weight="semibold">{listing.rating.toFixed(1)}</Text>
                    </Flex>
                  </Flex>
                  <ButtonLink
                    to="/products/$productId/reviews"
                    params={{ productId }}
                    size="lg"
                    variant="secondary"
                  >
                    View all
                  </ButtonLink>
                </Flex>
              </Flex>

              <Grid style={styles.reviewsGrid}>
                {reviews
                  .slice(0, PRODUCT_REVIEW_PREVIEW_COUNT)
                  .map((review) => (
                    <Card
                      key={`${listing.id}-review-${review.author}`}
                      style={styles.reviewCard}
                    >
                      <Flex direction="column" style={styles.reviewCardBody}>
                        <Flex gap="2xl" style={styles.reviewHeader}>
                          <Avatar
                            alt={review.author}
                            fallback={getInitials(review.author)}
                            size="lg"
                          />
                          <Flex
                            direction="column"
                            gap="lg"
                            style={styles.reviewAuthor}
                          >
                            <Text weight="semibold">{review.author}</Text>
                            <Text size="sm" variant="secondary">
                              {review.role}
                            </Text>
                          </Flex>
                          <StarRating
                            rating={review.rating}
                            showReviewCount={false}
                          />
                        </Flex>
                        <Body style={styles.reviewQuote}>{review.quote}</Body>
                        <Text
                          size="sm"
                          variant="secondary"
                          style={styles.reviewMeta}
                        >
                          {review.context}
                        </Text>
                      </Flex>
                    </Card>
                  ))}
              </Grid>

              <Button isDisabled size="lg" variant="secondary">
                Create review
              </Button>
            </Flex>

            {relatedProducts.length > 0 ? (
              <RelatedProductsSection listings={relatedProducts} />
            ) : null}
          </Flex>
        </Page.Root>
      </HeaderLayout.Page>
    </HeaderLayout.Root>
  );
}

function HeroSection({ listing }: { listing: DirectoryListingDetail }) {
  const primaryLink = listing.externalUrl || undefined;

  return (
    <Flex direction="column" gap="6xl">
      {listing.imageUrl && (
        <div {...stylex.props(styles.hero, getHeroSurface(listing.accent))}>
          <img
            alt={`${listing.name} preview`}
            src={listing.imageUrl}
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
          <Text
            font="title"
            size={{ default: "4xl", sm: "4xl" }}
            weight="semibold"
            style={styles.heroTitle}
          >
            {listing.name}
          </Text>
          <Body style={styles.heroTagline}>{listing.tagline}</Body>
        </Flex>

        {primaryLink && (
          <ButtonLink
            to={primaryLink}
            size="xl"
            target="_blank"
            rel="noopener noreferrer"
          >
            {listing.priceLabel} <ExternalLink />
          </ButtonLink>
        )}
      </Flex>
    </Flex>
  );
}

function MetaCard({ label, value }: { label: string; value: string }) {
  return (
    <Card style={styles.metaCard}>
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

function RelatedProductsSection({
  listings,
}: {
  listings: DirectoryListingCard[];
}) {
  return (
    <Flex direction="column" gap="4xl" style={styles.relatedSection}>
      <Heading2>Related Products</Heading2>
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
      params={{ productId: listing.id }}
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
          <Flex justify="between" gap="xl" style={styles.relatedFooter}>
            <Text size="sm" weight="semibold">
              {listing.rating.toFixed(1)} rating
            </Text>
            <Text weight="semibold">{listing.priceLabel}</Text>
          </Flex>
        </Flex>
      </Card>
    </RouterLink>
  );
}

function getHeroSurface(accent: DirectoryListingDetail["accent"]) {
  if (accent === "pink") return styles.heroPink;
  if (accent === "purple") return styles.heroPurple;
  if (accent === "green") return styles.heroGreen;

  return styles.heroBlue;
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
