import type { LucideIcon } from "lucide-react";

import * as stylex from "@stylexjs/stylex";
import { useSuspenseQuery } from "@tanstack/react-query";
import {
  Link as RouterLink,
  createFileRoute,
  createLink,
  notFound,
  useRouter,
} from "@tanstack/react-router";
import { HeroImage } from "#/components/HeroImage";
import { StarRating } from "#/design-system/star-rating";
import {
  AppWindow,
  BarChart3,
  ChevronLeft,
  Code2,
  RadioTower,
} from "lucide-react";

import type {
  DirectoryCategoryPageData,
  DirectoryListingCard,
} from "../integrations/tanstack-query/api-directory-listings.functions";
import type { AppTagAccent } from "../lib/app-tag-visuals";
import type {
  DirectoryCategoryAccent,
  DirectoryCategoryTreeNode,
} from "../lib/directory-categories";

import { AppTagHero } from "../components/AppTagHero";
import { EcosystemCategoryCard } from "../components/EcosystemCategoryCard";
import { FeaturedListingFallbackCard } from "../components/FeaturedListingFallbackCard";
import { FeaturedListingGrid } from "../components/FeaturedListingGrid";
import { Avatar } from "../design-system/avatar";
import { Card } from "../design-system/card";
import { Flex } from "../design-system/flex";
import { Grid } from "../design-system/grid";
import { Link } from "../design-system/link";
import { Page } from "../design-system/page";
import { Select, SelectItem } from "../design-system/select";
import { uiColor } from "../design-system/theme/color.stylex";
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
import { Body, Heading1, SmallBody } from "../design-system/typography";
import { Text } from "../design-system/typography/text";
import { directoryListingApi } from "../integrations/tanstack-query/api-directory-listings.functions";
import {
  getAppSegmentFromEcosystemRootCategoryId,
  getDirectoryBrowsePath,
} from "../lib/directory-categories";
import { getDirectoryListingSlug } from "../lib/directory-listing-slugs";
import { getEcosystemCategoryEmoji } from "../lib/ecosystem-category-emoji";
import { getInitials } from "../lib/get-initials";
import { getDirectoryListingHeroImageAlt } from "../lib/listing-copy";
import { buildAppTagOgImageUrl, buildRouteOgMeta } from "../lib/og-meta";

const AppLink = createLink(Link);
const sortOptions = [
  { id: "popular", label: "Popular" },
  { id: "newest", label: "Newest" },
  { id: "alphabetical", label: "Alphabetical" },
] as const;

export const Route = createFileRoute("/_header-layout/categories/$categoryId")({
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
      directoryListingApi.getDirectoryCategoryPageQueryOptions({
        categoryId: params.categoryId,
        sort: deps.sort,
      }),
    );

    if (!data) {
      throw notFound();
    }

    const category = data.category;

    return {
      categoryId: params.categoryId,
      ogTitle: `${category.label} | at-store`,
      ogDescription: category.description,
      /**
       * OG card mirrors the `AppTagCard` look — accent + emoji from the category label via
       * `/og/tag` (Satori). In-app hero uses the same accent family + `getEcosystemCategoryEmoji`.
       */
      ogImage: buildAppTagOgImageUrl({
        tag: category.label,
        label: category.label,
        kind: "Category",
        count: data.listings.length,
      }),
    };
  },
  head: ({ loaderData }) =>
    buildRouteOgMeta({
      title: loaderData?.ogTitle ?? "Category | at-store",
      description:
        loaderData?.ogDescription ||
        "Browse listings assigned to this directory category.",
      image: loaderData?.ogImage,
    }),
  component: CategoryPage,
});

const styles = stylex.create({
  listingAvatar: {
    borderRadius: radius["lg"],
  },
  page: {
    paddingBottom: verticalSpace["10xl"],
    paddingTop: verticalSpace["6xl"],
  },
  pageContent: {
    gap: {
      default: gap["6xl"],
      [breakpoints.xl]: gap["7xl"],
    },
  },
  navLinks: {
    flexWrap: "wrap",
  },
  sortSelect: {
    flexGrow: {
      default: 1,
      [breakpoints.sm]: 0,
    },
    minWidth: "12rem",
  },
  eyebrow: {
    letterSpacing: "0.16em",
    textTransform: "uppercase",
  },
  childGrid: {
    gap: gap["2xl"],
    display: "grid",
    gridTemplateColumns: {
      default: "1fr",
      [breakpoints.sm]: "repeat(2, minmax(0, 1fr))",
      [breakpoints.lg]: "repeat(3, minmax(0, 1fr))",
    },
  },
  childCardLink: {
    textDecoration: "none",
    display: "block",
  },
  childCard: {
    borderRadius: radius.xl,
    borderStyle: "solid",
    borderWidth: 1,
    cornerShape: "squircle",
    gap: gap["3xl"],
    boxShadow: shadow.lg,
    color: "white",
    display: "flex",
    flexDirection: "column",
    minHeight: "12rem",
    paddingBottom: verticalSpace["4xl"],
    paddingLeft: horizontalSpace["4xl"],
    paddingRight: horizontalSpace["4xl"],
    paddingTop: verticalSpace["4xl"],
  },
  childIcon: {
    borderColor: `color-mix(in srgb, ${uiColor.border1} 65%, transparent)`,
    borderRadius: radius.md,
    borderStyle: "solid",
    borderWidth: 1,
    alignItems: "center",
    backdropFilter: "blur(10px)",
    backgroundColor: `color-mix(in srgb, ${uiColor.component1} 36%, transparent)`,
    display: "inline-flex",
    justifyContent: "center",
    height: "2.5rem",
    width: "2.5rem",
  },
  childDescription: {
    color: uiColor.textContrast,
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
  listingLink: {
    textDecoration: "none",
    display: "block",
    position: "relative",
    zIndex: 1,
    height: "100%",
  },
  listingLinkFeatured: {
    zIndex: 0,
  },
  listingCard: {
    borderRadius: radius["2xl"],
    boxSizing: "border-box",
    height: "100%",
    paddingBottom: verticalSpace["2xl"],
    paddingLeft: horizontalSpace["2xl"],
    paddingRight: horizontalSpace["2xl"],
    paddingTop: verticalSpace["2xl"],
    width: "100%",
  },
  listingCardBody: {
    gap: gap["4xl"],
    position: "relative",
    height: "100%",
    paddingBottom: verticalSpace["xl"],
    paddingLeft: horizontalSpace["xl"],
    paddingRight: horizontalSpace["xl"],
    paddingTop: verticalSpace["xl"],
  },
  listingHeader: {
    gap: gap["2xl"],
    position: "relative",
    zIndex: 1,
  },
  listingInfo: {
    flexBasis: "0%",
    flexGrow: "1",
    flexShrink: "1",
    minWidth: 0,
  },
  listingTagline: {
    flexGrow: 1,
  },
  featuredImageFrame: {
    inset: 0,
    objectFit: "cover",
    position: "absolute",
    height: "100%",
    width: "100%",
  },
  emptyState: {
    gap: gap["lg"],
    maxWidth: "40rem",
  },
  softBlueSurface: {
    borderColor: blue.border1,
    backgroundImage: `linear-gradient(135deg, ${blue.border2} 0%, ${blue.solid1} 100%)`,
  },
  softPinkSurface: {
    borderColor: pink.border1,
    backgroundImage: `linear-gradient(135deg, ${pink.border2} 0%, ${pink.solid1} 100%)`,
  },
  softPurpleSurface: {
    borderColor: purple.border1,
    backgroundImage: `linear-gradient(135deg, ${purple.border2} 0%, ${purple.solid1} 100%)`,
  },
  softGreenSurface: {
    borderColor: green.border1,
    backgroundImage: `linear-gradient(135deg, ${green.border2} 0%, ${green.solid1} 100%)`,
  },
});

function CategoryPage() {
  const search = Route.useSearch();
  const router = useRouter();
  const { categoryId } = Route.useLoaderData();
  const { data } = useSuspenseQuery(
    directoryListingApi.getDirectoryCategoryPageQueryOptions({
      categoryId,
      sort: search.sort,
    }),
  );
  const { data: categoryTree } = useSuspenseQuery(
    directoryListingApi.getDirectoryCategoryTreeQueryOptions,
  );

  if (!data) {
    throw notFound();
  }

  const category = data.category;
  const browsePath = getDirectoryBrowsePath(category.id);
  const [, AppName] = category.pathLabels;
  const appSegment =
    category.pathIds[0] === "apps" && category.pathIds[1]
      ? getAppSegmentFromEcosystemRootCategoryId(
          `${category.pathIds[0]}/${category.pathIds[1]}`,
        )
      : null;
  const otherAppCategories = getOtherAppCategories(data, categoryTree);

  return (
    <Page.Root variant="large" style={styles.page}>
      <Flex direction="column" style={styles.pageContent}>
        <Flex direction="column" gap="4xl">
          <Flex gap="xl" style={styles.navLinks}>
            {appSegment ? (
              <AppLink to="/ecosystems/$app" params={{ app: appSegment }}>
                <ChevronLeft />
                Back to {AppName} Ecosystem
              </AppLink>
            ) : (
              <AppLink to={browsePath as never}>
                <ChevronLeft />
                Back to categories
              </AppLink>
            )}
          </Flex>

          <AppTagHero
            eyebrow={formatCount(category.count)}
            title={category.label}
            description={category.description}
            accent={mapCategoryAccentToTagAccent(category.accent)}
            emojis={buildCategoryHeroEmojis(category)}
            action={
              <Select
                aria-label="Sort category listings"
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
                    to: "/categories/$categoryId",
                    params: { categoryId },
                    search: { sort: key },
                  });
                }}
              >
                {(item) => <SelectItem>{item.label}</SelectItem>}
              </Select>
            }
          />
        </Flex>

        {data.listings.length > 0 ? (
          <FeaturedListingGrid
            items={data.listings}
            getKey={(listing) => listing.id}
            canFeature={(listing) => Boolean(listing.heroImageUrl)}
            renderItem={(listing, { featured }) => (
              <CategoryListingCard featured={featured} listing={listing} />
            )}
          />
        ) : (
          <Flex direction="column" style={styles.emptyState}>
            <Body variant="secondary">
              No listings are assigned to this branch yet.
            </Body>
            {import.meta.env.DEV ? (
              <AppLink to={"/dev/categories" as never}>
                Open the dev recategorization panel to assign some.
              </AppLink>
            ) : null}
          </Flex>
        )}

        {category.children.length > 0 ? (
          <Flex direction="column" gap="2xl">
            <Heading1>Subcategories</Heading1>
            <Grid style={styles.childGrid}>
              {category.children.map((child) => (
                <ChildCategoryCard key={child.id} category={child} />
              ))}
            </Grid>
          </Flex>
        ) : null}

        {otherAppCategories.length > 0 ? (
          <RelatedAppCategoriesSection categories={otherAppCategories} />
        ) : null}
      </Flex>
    </Page.Root>
  );
}

function RelatedAppCategoriesSection({
  categories,
}: {
  categories: Array<DirectoryCategoryTreeNode>;
}) {
  return (
    <Flex direction="column" style={styles.relatedSection}>
      <Flex direction="column" gap="4xl" style={styles.relatedHeader}>
        <Text size="3xl" weight="semibold">
          Other app categories
        </Text>
        <Body variant="secondary" style={styles.relatedDescription}>
          Explore neighboring app categories to discover more tools in adjacent
          workflows.
        </Body>
      </Flex>
      <Grid style={styles.childGrid}>
        {categories.map((category) => (
          <EcosystemCategoryCard key={category.id} category={category} />
        ))}
      </Grid>
    </Flex>
  );
}

function ChildCategoryCard({
  category,
}: {
  category: DirectoryCategoryTreeNode;
}) {
  const CategoryIcon = getCategoryIcon(category.label);

  return (
    <RouterLink
      to="/categories/$categoryId"
      params={{ categoryId: category.id }}
      search={{ sort: "popular" }}
      {...stylex.props(styles.childCardLink)}
    >
      <div
        {...stylex.props(
          styles.childCard,
          getSoftAccentSurface(category.accent),
        )}
      >
        <div {...stylex.props(styles.childIcon)}>
          <CategoryIcon size={18} strokeWidth={2.25} />
        </div>
        <Flex direction="column" gap="lg">
          <SmallBody style={styles.eyebrow}>
            {category.pathLabels.slice(0, -1).join(" / ")}
          </SmallBody>
          <Text size="2xl" weight="semibold">
            {category.label}
          </Text>
          <Body style={styles.childDescription}>{category.description}</Body>
          <Text weight="semibold">{formatCount(category.count)}</Text>
        </Flex>
      </div>
    </RouterLink>
  );
}

function CategoryListingCard({
  listing,
  featured = false,
}: {
  listing: DirectoryListingCard;
  featured?: boolean;
}) {
  return (
    <RouterLink
      to="/products/$productId"
      params={{ productId: getDirectoryListingSlug(listing) }}
      {...stylex.props(
        styles.listingLink,
        featured && styles.listingLinkFeatured,
      )}
    >
      {featured ? (
        listing.heroImageUrl ? (
          <HeroImage
            alt={getDirectoryListingHeroImageAlt(listing)}
            glowIntensity={0.8}
            src={listing.heroImageUrl}
          />
        ) : (
          <FeaturedListingFallbackCard listing={listing} />
        )
      ) : (
        <Card style={[styles.listingCard]}>
          {featured && listing.heroImageUrl ? (
            <img
              src={listing.heroImageUrl}
              alt=""
              aria-hidden="true"
              {...stylex.props(styles.featuredImageFrame)}
            />
          ) : null}
          <Flex direction="column" style={[styles.listingCardBody]}>
            <Flex gap="2xl" align="center" style={styles.listingHeader}>
              <Avatar
                alt={listing.name}
                fallback={getInitials(listing.name)}
                size="xl"
                src={listing.iconUrl || undefined}
                style={styles.listingAvatar}
              />
              <Flex direction="column" gap="md" style={styles.listingInfo}>
                <Text size="xl" weight="semibold">
                  {listing.name}
                </Text>
                <Flex align="center" gap="lg">
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
            <Body variant="secondary" style={styles.listingTagline}>
              {listing.tagline}
            </Body>
          </Flex>
        </Card>
      )}
    </RouterLink>
  );
}

function getCategoryIcon(label: string): LucideIcon {
  if (label === "Analytics") return BarChart3;
  if (label === "Protocol" || label === "Tools") return Code2;
  if (label === "PDS" || label === "AppView") return RadioTower;

  return AppWindow;
}

function getSoftAccentSurface(accent: DirectoryCategoryAccent) {
  if (accent === "pink") return styles.softPinkSurface;
  if (accent === "purple") return styles.softPurpleSurface;
  if (accent === "green") return styles.softGreenSurface;

  return styles.softBlueSurface;
}

function formatCount(count: number) {
  return `${count} ${count === 1 ? "listing" : "listings"}`;
}

function getOtherAppCategories(
  pageData: DirectoryCategoryPageData,
  categoryTree: Array<DirectoryCategoryTreeNode>,
) {
  const currentCategory = pageData.category;
  if (currentCategory.pathIds[0] !== "apps") {
    return [];
  }

  const ecosystemRootId = currentCategory.pathIds.slice(0, 2).join("/");
  const parentCategoryId = currentCategory.pathIds.slice(0, -1).join("/");
  const ecosystemRootNode = findCategoryNodeById(categoryTree, ecosystemRootId);
  const parentNode = findCategoryNodeById(categoryTree, parentCategoryId);
  if (!ecosystemRootNode) {
    return [];
  }

  const siblingCategories =
    parentNode?.children.filter((node) => node.id !== currentCategory.id) ?? [];

  const ecosystemCategories = flattenCategoryNodes(
    ecosystemRootNode.children,
  ).filter((node) => node.id !== currentCategory.id);

  const allCandidates = [...siblingCategories, ...ecosystemCategories];
  const seen = new Set<string>();

  return allCandidates
    .filter((category) => category.count > 0)
    .filter((category) => {
      if (seen.has(category.id)) {
        return false;
      }
      seen.add(category.id);
      return true;
    })
    .toSorted((left, right) => {
      if (right.count !== left.count) {
        return right.count - left.count;
      }

      return left.label.localeCompare(right.label);
    })
    .slice(0, 3);
}

function flattenCategoryNodes(
  nodes: Array<DirectoryCategoryTreeNode>,
): Array<DirectoryCategoryTreeNode> {
  const flattened: Array<DirectoryCategoryTreeNode> = [];
  for (const node of nodes) {
    flattened.push(node);
    flattened.push(...flattenCategoryNodes(node.children));
  }
  return flattened;
}

function findCategoryNodeById(
  nodes: Array<DirectoryCategoryTreeNode>,
  categoryId: string,
): DirectoryCategoryTreeNode | null {
  for (const node of nodes) {
    if (node.id === categoryId) {
      return node;
    }

    const match = findCategoryNodeById(node.children, categoryId);
    if (match) {
      return match;
    }
  }

  return null;
}

/**
 * Bridge `DirectoryCategoryAccent` (the 4-color accent baked into directory metadata) over
 * to the broader `AppTagAccent` palette used by `AppTagHero` / `AppTagCard`.
 *
 * "green" maps to `indigo` to stay visually consistent with `EcosystemCategoryCard`, which
 * (for legacy reasons) imports `indigo as green` and renders the green-accent surface using
 * the indigo palette. Changing one without the other would make the hero and the tile cards
 * disagree on what "green" looks like.
 */
function mapCategoryAccentToTagAccent(
  accent: DirectoryCategoryAccent,
): AppTagAccent {
  switch (accent) {
    case "blue": {
      return "blue";
    }
    case "pink": {
      return "pink";
    }
    case "purple": {
      return "purple";
    }
    case "green": {
      return "indigo";
    }
  }
}

/**
 * Build the emoji list for the hero's scatter. Anchors on the category's own emoji, then
 * walks `children` (and grandchildren if the immediate child layer is too narrow) to add
 * distinct glyphs. Mirrors the approach in `EcosystemCategoryCard.pickSlotEmojis` so the
 * page hero and the children-tile grid below it share the same vocabulary.
 */
function buildCategoryHeroEmojis(
  category: DirectoryCategoryTreeNode,
): Array<string> {
  const anchor = getEcosystemCategoryEmoji(category.label);
  const seen = new Set<string>([anchor]);
  const pool: Array<string> = [anchor];

  const visit = (nodes: Array<DirectoryCategoryTreeNode>) => {
    for (const node of nodes) {
      const emoji = getEcosystemCategoryEmoji(node.label);
      if (seen.has(emoji)) continue;
      seen.add(emoji);
      pool.push(emoji);
    }
  };

  visit(category.children);
  if (pool.length < 5) {
    for (const child of category.children) {
      visit(child.children);
      if (pool.length >= 5) break;
    }
  }

  return pool;
}
