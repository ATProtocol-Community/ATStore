import * as stylex from "@stylexjs/stylex";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, notFound, useRouter } from "@tanstack/react-router";
import { LocaleLink as RouterLink } from "../components/LocaleLink";
import { createLocaleLink } from "../components/LocaleLink";
import { ChevronLeft } from "lucide-react";

import { AppTagHero } from "../components/AppTagHero";
import { FeaturedListingFallbackCard } from "../components/FeaturedListingFallbackCard";
import { FeaturedListingGrid } from "../components/FeaturedListingGrid";
import { ProtocolCategoryCard } from "../components/ProtocolCategoryCard";
import { Avatar } from "../design-system/avatar";
import { Card } from "../design-system/card";
import { Flex } from "../design-system/flex";
import { Grid } from "../design-system/grid";
import { Link } from "../design-system/link";
import { Page } from "../design-system/page";
import { Select, SelectItem } from "../design-system/select";
import { blue } from "../design-system/theme/colors/blue.stylex";
import { indigo as green } from "../design-system/theme/colors/indigo.stylex";
import { pink } from "../design-system/theme/colors/pink.stylex";
import { purple } from "../design-system/theme/colors/purple.stylex";
import { breakpoints } from "../design-system/theme/media-queries.stylex";
import { radius } from "../design-system/theme/radius.stylex";
import {
  gap,
  horizontalSpace,
  verticalSpace,
} from "../design-system/theme/semantic-spacing.stylex";
import { shadow } from "../design-system/theme/shadow.stylex";
import { fontSize } from "../design-system/theme/typography.stylex";
import { Body, SmallBody } from "../design-system/typography";
import { Text } from "../design-system/typography/text";
import {
  directoryListingApi,
  type DirectoryListingCard,
  type DirectoryProtocolCategoryGroup,
} from "../integrations/tanstack-query/api-directory-listings.functions";
import { getDirectoryListingSlug } from "../lib/directory-listing-slugs";
import { buildRouteOgMeta } from "../lib/og-meta";
import { getProtocolCategoryCoverAssetPathForSegment } from "../lib/protocol-category-hero-art";
import { getProtocolCategoryDescription } from "../lib/protocol-category-metadata";
import { StarRating } from "#/design-system/star-rating";
import { uiColor } from "../design-system/theme/color.stylex";
import { HeroImage } from "#/components/HeroImage";

const sortOptions = [
  { id: "popular", label: "Popular" },
  { id: "newest", label: "Newest" },
  { id: "alphabetical", label: "Alphabetical" },
] as const;

export const Route = createFileRoute(
  "/$locale/_header-layout/protocol/$category",
)({
  validateSearch: (
    search,
  ): { sort: "popular" | "newest" | "alphabetical" } => ({
    sort:
      search.sort === "newest"
        ? "newest"
        : search.sort === "alphabetical"
          ? "alphabetical"
          : "popular",
  }),
  loaderDeps: ({ search }) => ({
    sort: search.sort,
  }),
  loader: async ({ context, params, deps }) => {
    const data = await context.queryClient.ensureQueryData(
      directoryListingApi.getProtocolCategoryPageQueryOptions({
        category: params.category,
        sort: deps.sort,
      }),
    );

    if (!data) {
      throw notFound();
    }

    const heroImage = getProtocolCategoryCoverAssetPathForSegment(data.segment);
    const description =
      data.description.trim() ||
      getProtocolCategoryDescription(data.categoryId);

    return {
      category: params.category,
      ogTitle: `${data.label} protocol tools | at-store`,
      ogDescription: description,
      ogImage: heroImage,
    };
  },
  head: ({ loaderData }) =>
    buildRouteOgMeta({
      title: loaderData?.ogTitle ?? "Protocol category | at-store",
      description:
        loaderData?.ogDescription ||
        "Browse protocol listings across the Bluesky infrastructure stack.",
      image: loaderData?.ogImage,
    }),
  component: ProtocolCategoryPage,
});

const LinkLink = createLocaleLink(Link);
const ROOT_PROTOCOL_SUBFOLDER = "__root__";

const styles = stylex.create({
  pageContent: {
    gap: {
      default: gap["6xl"],
      [breakpoints.xl]: gap["7xl"],
    },
  },
  blurContainer: {
    inset: 0,
    overflow: "hidden",
    position: "absolute",
    zIndex: 0,
  },
  blur: {
    backdropFilter: "blur(32px) saturate(500%)",
    position: "absolute",
    bottom: -48,
    left: -48,
    right: -48,
    top: -48,
  },
  page: {
    paddingBottom: verticalSpace["10xl"],
    paddingTop: verticalSpace["6xl"],
  },
  navLinks: {
    flexWrap: "wrap",
  },
  resultsHeader: {
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  resultsActions: {
    alignItems: "center",
    flexWrap: "wrap",
  },
  resultCount: {
    letterSpacing: "0.16em",
    textTransform: "uppercase",
  },
  sortSelect: {
    minWidth: "12rem",
    flexGrow: {
      default: 1,
      [breakpoints.sm]: 0,
    },
  },
  listingLink: {
    display: "block",
    height: "100%",
    textDecoration: "none",
    position: "relative",
    zIndex: 1,
  },
  listingLinkFeatured: {
    zIndex: 0,
  },
  listingCard: {
    height: "100%",
    width: "100%",
    boxSizing: "border-box",
  },
  listingCardFeatured: {
    borderRadius: radius["3xl"],
    borderStyle: "solid",
    borderWidth: 1,
    color: uiColor.text2,
    cornerShape: "squircle",
    overflow: "hidden",
    position: "relative",
    boxShadow: shadow["2xl"],
  },
  listingCardBody: {
    gap: gap["4xl"],
    height: "100%",
    paddingBottom: verticalSpace["xl"],
    paddingLeft: horizontalSpace["xl"],
    paddingRight: horizontalSpace["xl"],
    paddingTop: verticalSpace["xl"],
    position: "relative",
  },
  listingCardBodyFeatured: {
    gap: gap["3xl"],
    height: "100%",
    justifyContent: "flex-end",
    paddingBottom: verticalSpace["md"],
    paddingLeft: horizontalSpace["md"],
    paddingRight: horizontalSpace["md"],
    paddingTop: verticalSpace["md"],
    position: "relative",
    zIndex: 1,
  },
  listingHeader: {
    gap: gap["2xl"],
    position: "relative",
    zIndex: 1,
  },
  featuredInfoContent: {
    position: "relative",
    zIndex: 1,
    paddingTop: verticalSpace["4xl"],
    paddingBottom: verticalSpace["4xl"],
  },
  featuredImageFrame: {
    height: "100%",
    inset: 0,
    objectFit: "cover",
    position: "absolute",
    width: "100%",
  },
  featuredInfoPanel: {
    backdropFilter: "blur(18px) saturate(180%)",
    backgroundColor:
      "light-dark(rgba(255, 252, 255, 0.55), rgba(252, 252, 252, 0.4))",
    borderColor: `color-mix(in srgb, ${uiColor.border1} 60%, transparent)`,
    borderRadius: radius["xl"],
    borderStyle: "solid",
    borderWidth: 1,
    boxShadow: `${shadow.lg}, 0 18px 48px color-mix(in srgb, ${uiColor.overlayBackdrop} 42%, transparent)`,
    display: "flex",
    flexDirection: "column",
    gap: gap["4xl"],
    height: "fit-content",
    overflow: "hidden",
    margin: verticalSpace["2xl"],
    maxWidth: "34rem",
    position: "relative",
    paddingLeft: horizontalSpace["4xl"],
    paddingRight: horizontalSpace["4xl"],
    paddingTop: verticalSpace["4xl"],
    paddingBottom: verticalSpace["4xl"],
  },
  featuredAvatarContainer: {
    height: "100%",
    aspectRatio: 1 / 1,
    display: "flex",
    flexDirection: "column",
    position: "relative",
  },
  featuredAvatar: {
    position: "absolute",
    inset: 0,
    height: "100%",
    width: "100%",
  },
  featuredTitle: {
    display: "block",
    maxWidth: "18ch",
  },
  featuredTagline: {
    color: uiColor.text1,
    fontSize: fontSize["lg"],
    margin: 0,
    maxWidth: "32rem",
    position: "relative",
    zIndex: 1,
  },
  listingInfo: {
    flex: 1,
    minWidth: 0,
  },
  listingFooter: {
    alignItems: "center",
  },
  listingTagline: {
    flexGrow: 1,
  },
  blueSurface: {
    backgroundImage: `linear-gradient(135deg, ${blue.solid1} 0%, ${blue.solid2} 45%, ${blue.border3} 100%)`,
    borderColor: blue.border1,
  },
  pinkSurface: {
    backgroundImage: `linear-gradient(135deg, ${pink.solid1} 0%, ${pink.solid2} 45%, ${purple.solid1} 100%)`,
    borderColor: pink.border1,
  },
  purpleSurface: {
    backgroundImage: `linear-gradient(135deg, ${purple.solid1} 0%, ${purple.solid2} 45%, ${pink.border3} 100%)`,
    borderColor: purple.border1,
  },
  greenSurface: {
    backgroundImage: `linear-gradient(135deg, ${green.solid1} 0%, ${green.solid2} 45%, ${green.border3} 100%)`,
    borderColor: green.border1,
  },
  blueGlow: {
    backgroundImage: `radial-gradient(circle, ${blue.component3}, transparent 70%)`,
  },
  pinkGlow: {
    backgroundImage: `radial-gradient(circle, ${pink.component3}, transparent 70%)`,
  },
  purpleGlow: {
    backgroundImage: `radial-gradient(circle, ${purple.component3}, transparent 70%)`,
  },
  greenGlow: {
    backgroundImage: `radial-gradient(circle, ${green.component3}, transparent 70%)`,
  },
  relatedSection: {
    gap: gap["5xl"],
    paddingTop: verticalSpace["6xl"],
  },
  relatedHeader: {
    maxWidth: "44rem",
  },
  relatedDescription: {
    maxWidth: "40rem",
  },
  relatedGrid: {
    display: "grid",
    gap: gap["2xl"],
    gridTemplateColumns: {
      default: "1fr",
      [breakpoints.sm]: "repeat(2, minmax(0, 1fr))",
      [breakpoints.md]: "repeat(4, minmax(0, 1fr))",
    },
  },
  subfolderSection: {
    gap: gap["4xl"],
  },
  subfolderHeader: {
    maxWidth: "44rem",
  },
  subfolderEyebrow: {
    letterSpacing: "0.16em",
    textTransform: "uppercase",
  },
});

function ProtocolCategoryPage() {
  const search = Route.useSearch();
  const router = useRouter();
  const { category } = Route.useLoaderData();
  const { data } = useSuspenseQuery(
    directoryListingApi.getProtocolCategoryPageQueryOptions({
      category,
      sort: search.sort,
    }),
  );
  const { data: allGroups } = useSuspenseQuery(
    directoryListingApi.getProtocolCategoriesQueryOptions,
  );

  if (!data) {
    throw notFound();
  }

  const heroImage = getProtocolCategoryCoverAssetPathForSegment(data.segment);
  const description =
    data.description.trim() || getProtocolCategoryDescription(data.categoryId);
  const related = getRelatedProtocolCategories(data, allGroups);
  const subfolderSections = getProtocolSubfolderSections(data);

  return (
    <Page.Root variant="large" style={styles.page}>
      <Flex direction="column" style={styles.pageContent}>
        <Flex direction="column" gap="4xl">
          <Flex gap="xl" style={styles.navLinks}>
            <LinkLink to="/$locale/protocol/tags">
              <ChevronLeft />
              All protocol categories
            </LinkLink>
          </Flex>

          <AppTagHero
            description={description}
            eyebrow={formatProtocolListingCount(data.count)}
            imageSrc={heroImage}
            title={data.label}
            action={
              <Select
                aria-label="Sort protocol category listings"
                items={sortOptions}
                placeholder="Sort listings"
                size="lg"
                style={styles.sortSelect}
                value={search.sort}
                variant="secondary"
                onChange={(key) => {
                  if (
                    key !== "popular" &&
                    key !== "newest" &&
                    key !== "alphabetical"
                  ) {
                    return;
                  }

                  void router.navigate({
                    to: "/$locale/protocol/$category",
                    params: { category },
                    search: { sort: key },
                  });
                }}
              >
                {(item) => <SelectItem>{item.label}</SelectItem>}
              </Select>
            }
          />
        </Flex>

        {subfolderSections.length > 0 ? (
          <Flex direction="column" gap="6xl">
            {subfolderSections.map((section, sectionIndex) => (
              <ProtocolSubfolderSection
                key={section.id}
                section={section}
                sectionIndex={sectionIndex}
              />
            ))}
          </Flex>
        ) : (
          <FeaturedListingGrid
            getKey={(listing) => `${data.categoryId}-${listing.id}`}
            items={data.listings}
            canFeature={(listing) => Boolean(listing.heroImageUrl)}
            renderItem={(listing, { featured }) => (
              <ProtocolCategoryListingCard
                featured={featured}
                listing={listing}
              />
            )}
          />
        )}

        {related.length > 0 ? (
          <RelatedProtocolSection groups={related} />
        ) : null}
      </Flex>
    </Page.Root>
  );
}

function RelatedProtocolSection({
  groups,
}: {
  groups: DirectoryProtocolCategoryGroup[];
}) {
  return (
    <Flex direction="column" gap="4xl" style={styles.relatedSection}>
      <Flex direction="column" gap="4xl" style={styles.relatedHeader}>
        <Text size="3xl" weight="semibold">
          More protocol categories
        </Text>
        <Body variant="secondary" style={styles.relatedDescription}>
          Explore neighboring infrastructure categories in the directory.
        </Body>
      </Flex>
      <Grid style={styles.relatedGrid}>
        {groups.map((group) => (
          <ProtocolCategoryCard
            key={group.categoryId}
            category={{
              count: group.count,
              label: group.label,
              segment: group.segment,
            }}
          />
        ))}
      </Grid>
    </Flex>
  );
}

function ProtocolCategoryListingCard({
  listing,
  featured = false,
}: {
  listing: DirectoryListingCard;
  featured?: boolean;
}) {
  return (
    <RouterLink
      params={{ productId: getDirectoryListingSlug(listing) }}
      to="/$locale/products/$productId"
      {...stylex.props(
        styles.listingLink,
        featured && styles.listingLinkFeatured,
      )}
    >
      {featured ? (
        listing.heroImageUrl ? (
          <HeroImage
            alt={`${listing.name} preview`}
            glowIntensity={0.8}
            src={listing.heroImageUrl}
          />
        ) : (
          <FeaturedListingFallbackCard listing={listing} />
        )
      ) : (
        <Card style={[styles.listingCard]}>
          <Flex direction="column" style={[styles.listingCardBody]}>
            <Flex align="center" gap="2xl" style={styles.listingHeader}>
              <Avatar
                alt={listing.name}
                fallback={getInitials(listing.name)}
                size="xl"
                src={listing.iconUrl || undefined}
              />
              <Flex direction="column" gap="md" style={styles.listingInfo}>
                <Text
                  font="title"
                  size={{ default: "lg", sm: "xl" }}
                  weight="semibold"
                >
                  {listing.name}
                </Text>
                <SmallBody variant="secondary">
                  @
                  {listing.productAccountHandle?.replace(/^@/, "") || "unknown"}
                </SmallBody>
              </Flex>
            </Flex>
            <Body variant="secondary" style={styles.listingTagline}>
              {listing.tagline}
            </Body>
            <div />
            <Flex gap="xl" justify="end" style={styles.listingFooter}>
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
      )}
    </RouterLink>
  );
}

function formatProtocolListingCount(count: number) {
  return `${count} ${count === 1 ? "listing" : "listings"}`;
}

function getRelatedProtocolCategories(
  current: DirectoryProtocolCategoryGroup,
  groups: DirectoryProtocolCategoryGroup[],
) {
  const currentListingIds = new Set(
    current.listings.map((listing) => listing.id),
  );

  return groups
    .filter((group) => group.categoryId !== current.categoryId)
    .sort((left, right) => {
      const leftOverlap = left.listings.reduce(
        (count, listing) => count + Number(currentListingIds.has(listing.id)),
        0,
      );
      const rightOverlap = right.listings.reduce(
        (count, listing) => count + Number(currentListingIds.has(listing.id)),
        0,
      );

      if (rightOverlap !== leftOverlap) {
        return rightOverlap - leftOverlap;
      }

      if (right.count !== left.count) {
        return right.count - left.count;
      }

      return left.label.localeCompare(right.label);
    })
    .slice(0, 4);
}

type ProtocolSubfolderSectionData = {
  id: string;
  label: string;
  listings: DirectoryListingCard[];
};

function ProtocolSubfolderSection({
  section,
  sectionIndex,
}: {
  section: ProtocolSubfolderSectionData;
  sectionIndex: number;
}) {
  return (
    <Flex direction="column" style={styles.subfolderSection}>
      <Flex direction="column" gap="2xl" style={styles.subfolderHeader}>
        <Text size="sm" style={styles.subfolderEyebrow}>
          {formatProtocolListingCount(section.listings.length)}
        </Text>
        <Text size="2xl" weight="semibold">
          {section.label}
        </Text>
      </Flex>

      <FeaturedListingGrid
        hasFeatured={sectionIndex === 0}
        items={section.listings}
        getKey={(listing) => `${section.id}-${listing.id}`}
        canFeature={(listing) => Boolean(listing.heroImageUrl)}
        renderItem={(listing, { featured }) => (
          <ProtocolCategoryListingCard featured={featured} listing={listing} />
        )}
      />
    </Flex>
  );
}

function getProtocolSubfolderSections(
  category: DirectoryProtocolCategoryGroup,
): ProtocolSubfolderSectionData[] {
  const rootPrefix = `${category.categoryId}/`;
  const sectionMap = new Map<string, ProtocolSubfolderSectionData>();
  const rootListings: DirectoryListingCard[] = [];

  for (const listing of category.listings) {
    const subfolders = new Set<string>();
    for (const categorySlug of listing.categorySlugs) {
      if (!categorySlug.startsWith(rootPrefix)) {
        continue;
      }

      const remainder = categorySlug.slice(rootPrefix.length);
      const [subfolder] = remainder.split("/");
      if (subfolder) {
        subfolders.add(subfolder);
      }
    }

    if (subfolders.size === 0) {
      rootListings.push(listing);
      continue;
    }

    for (const subfolder of subfolders) {
      const existing = sectionMap.get(subfolder);
      if (existing) {
        existing.listings.push(listing);
        continue;
      }

      sectionMap.set(subfolder, {
        id: subfolder,
        label: formatProtocolSubfolderLabel(subfolder),
        listings: [listing],
      });
    }
  }

  if (sectionMap.size === 0) {
    return [];
  }

  const sections = [...sectionMap.values()].sort((left, right) => {
    if (right.listings.length !== left.listings.length) {
      return right.listings.length - left.listings.length;
    }

    return left.label.localeCompare(right.label);
  });

  if (rootListings.length > 0) {
    sections.unshift({
      id: ROOT_PROTOCOL_SUBFOLDER,
      label: "General",
      listings: rootListings,
    });
  }

  return sections;
}

function getInitials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("");
}

function formatProtocolSubfolderLabel(value: string) {
  return value
    .split(/[-_]+/)
    .filter(Boolean)
    .map((segment) => segment[0]?.toUpperCase() + segment.slice(1))
    .join(" ");
}

function getAccentSurface(accent: DirectoryListingCard["accent"]) {
  if (accent === "pink") return styles.pinkSurface;
  if (accent === "purple") return styles.purpleSurface;
  if (accent === "green") return styles.greenSurface;

  return styles.blueSurface;
}
