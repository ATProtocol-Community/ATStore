import * as stylex from "@stylexjs/stylex";
import { useSuspenseQuery } from "@tanstack/react-query";
import {
  createFileRoute,
  Link as RouterLink,
  notFound,
} from "@tanstack/react-router";
import {
  AppWindow,
  BarChart3,
  Code2,
  RadioTower,
  type LucideIcon,
} from "lucide-react";

import { Avatar } from "../design-system/avatar";
import { Card } from "../design-system/card";
import { Flex } from "../design-system/flex";
import { Grid } from "../design-system/grid";
import { HeaderLayout } from "../design-system/header-layout";
import { Link } from "../design-system/link";
import { Page } from "../design-system/page";
import { blue } from "../design-system/theme/colors/blue.stylex";
import { green } from "../design-system/theme/colors/green.stylex";
import { pink } from "../design-system/theme/colors/pink.stylex";
import { purple } from "../design-system/theme/colors/purple.stylex";
import { uiColor } from "../design-system/theme/color.stylex";
import { breakpoints } from "../design-system/theme/media-queries.stylex";
import {
  gap,
  horizontalSpace,
  verticalSpace,
} from "../design-system/theme/semantic-spacing.stylex";
import { radius } from "../design-system/theme/radius.stylex";
import { shadow } from "../design-system/theme/shadow.stylex";
import { Body, Heading1, SmallBody } from "../design-system/typography";
import { Text } from "../design-system/typography/text";
import {
  directoryListingApi,
  type DirectoryListingCard,
} from "../integrations/tanstack-query/api-directory-listings.functions";
import {
  getDirectoryBrowsePath,
  type DirectoryCategoryAccent,
  type DirectoryCategoryTreeNode,
} from "../lib/directory-categories";
import { getDirectoryListingSlug } from "../lib/directory-listing-slugs";

export const Route = createFileRoute("/categories/$categoryId")({
  loader: async ({ context, params }) => {
    const data = await context.queryClient.ensureQueryData(
      directoryListingApi.getDirectoryCategoryPageQueryOptions({
        categoryId: params.categoryId,
      }),
    );

    if (!data) {
      throw notFound();
    }

    return params;
  },
  component: CategoryPage,
});

const styles = stylex.create({
  page: {
    paddingBottom: verticalSpace["10xl"],
    paddingTop: verticalSpace["6xl"],
  },
  pageContent: {
    gap: gap["6xl"],
  },
  navLinks: {
    flexWrap: "wrap",
  },
  headerCard: {
    borderRadius: radius.xl,
    borderStyle: "solid",
    borderWidth: 1,
    boxShadow: shadow.lg,
    color: "white",
    cornerShape: "squircle",
    display: "flex",
    flexDirection: "column",
    gap: gap["3xl"],
    minHeight: "16rem",
    paddingBottom: verticalSpace["5xl"],
    paddingLeft: horizontalSpace["5xl"],
    paddingRight: horizontalSpace["5xl"],
    paddingTop: verticalSpace["5xl"],
  },
  headerMeta: {
    gap: gap["md"],
  },
  eyebrow: {
    letterSpacing: "0.16em",
    textTransform: "uppercase",
  },
  headerTitle: {
    display: "block",
    textShadow: `0 10px 30px ${uiColor.overlayBackdrop}`,
  },
  headerDescription: {
    color: uiColor.textContrast,
    maxWidth: "44rem",
    textShadow: `0 6px 20px ${uiColor.overlayBackdrop}`,
  },
  childGrid: {
    display: "grid",
    gap: gap["2xl"],
    gridTemplateColumns: {
      default: "1fr",
      [breakpoints.sm]: "repeat(2, minmax(0, 1fr))",
      [breakpoints.lg]: "repeat(3, minmax(0, 1fr))",
    },
  },
  childCardLink: {
    display: "block",
    textDecoration: "none",
  },
  childCard: {
    borderRadius: radius.xl,
    borderStyle: "solid",
    borderWidth: 1,
    boxShadow: shadow.lg,
    color: "white",
    cornerShape: "squircle",
    display: "flex",
    flexDirection: "column",
    gap: gap["3xl"],
    minHeight: "12rem",
    paddingBottom: verticalSpace["4xl"],
    paddingLeft: horizontalSpace["4xl"],
    paddingRight: horizontalSpace["4xl"],
    paddingTop: verticalSpace["4xl"],
  },
  childIcon: {
    alignItems: "center",
    backdropFilter: "blur(10px)",
    backgroundColor: `color-mix(in srgb, ${uiColor.component1} 36%, transparent)`,
    borderColor: `color-mix(in srgb, ${uiColor.border1} 65%, transparent)`,
    borderRadius: radius.md,
    borderStyle: "solid",
    borderWidth: 1,
    display: "inline-flex",
    height: "2.5rem",
    justifyContent: "center",
    width: "2.5rem",
  },
  childDescription: {
    color: uiColor.textContrast,
  },
  listingGrid: {
    display: "grid",
    gap: gap["2xl"],
    gridTemplateColumns: {
      default: "1fr",
      [breakpoints.sm]: "repeat(2, minmax(0, 1fr))",
      [breakpoints.lg]: "repeat(3, minmax(0, 1fr))",
    },
  },
  listingLink: {
    display: "block",
    height: "100%",
    textDecoration: "none",
  },
  listingCard: {
    height: "100%",
    minHeight: "15rem",
  },
  listingCardBody: {
    gap: gap["4xl"],
    height: "100%",
    paddingBottom: verticalSpace["4xl"],
    paddingLeft: horizontalSpace["4xl"],
    paddingRight: horizontalSpace["4xl"],
    paddingTop: verticalSpace["4xl"],
  },
  listingHeader: {
    gap: gap["2xl"],
  },
  listingInfo: {
    flex: 1,
    minWidth: 0,
  },
  listingFooter: {
    alignItems: "center",
  },
  emptyState: {
    gap: gap["lg"],
    maxWidth: "40rem",
  },
  blueSurface: {
    backgroundImage: `linear-gradient(135deg, ${blue.border2} 0%, ${blue.solid1} 100%)`,
    borderColor: blue.border1,
  },
  pinkSurface: {
    backgroundImage: `linear-gradient(135deg, ${pink.border2} 0%, ${pink.solid1} 100%)`,
    borderColor: pink.border1,
  },
  purpleSurface: {
    backgroundImage: `linear-gradient(135deg, ${purple.border2} 0%, ${purple.solid1} 100%)`,
    borderColor: purple.border1,
  },
  greenSurface: {
    backgroundImage: `linear-gradient(135deg, ${green.border2} 0%, ${green.solid1} 100%)`,
    borderColor: green.border1,
  },
});

function CategoryPage() {
  const params = Route.useLoaderData();
  const { data } = useSuspenseQuery(
    directoryListingApi.getDirectoryCategoryPageQueryOptions({
      categoryId: params.categoryId,
    }),
  );

  if (!data) {
    throw notFound();
  }

  const category = data.category;
  const browsePath = getDirectoryBrowsePath(category.id);

  return (
    <HeaderLayout.Root>
      <HeaderLayout.Page>
        <Page.Root variant="large" style={styles.page}>
          <Flex direction="column" style={styles.pageContent}>
            <Flex gap="xl" style={styles.navLinks}>
              <Link href={browsePath}>Back to categories</Link>
              <Link href="/">Home</Link>
              {import.meta.env.DEV ? (
                <>
                  <Link href="/dev/categories">Recategorize DB</Link>
                  <Link href="/dev/app-tags">App tags</Link>
                </>
              ) : null}
            </Flex>

            <div
              {...stylex.props(
                styles.headerCard,
                getSoftAccentSurface(category.accent),
              )}
            >
              <Flex direction="column" style={styles.headerMeta}>
                <SmallBody style={styles.eyebrow}>
                  {category.pathLabels.join(" / ")}
                </SmallBody>
                <Text size="sm">{formatCount(category.count)}</Text>
              </Flex>
              <Heading1 style={styles.headerTitle}>{category.label}</Heading1>
              <Body style={styles.headerDescription}>
                {category.description}
              </Body>
            </div>

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

            <Flex direction="column" gap="2xl">
              <Heading1>Listings</Heading1>
              {data.listings.length > 0 ? (
                <Grid style={styles.listingGrid}>
                  {data.listings.map((listing) => (
                    <CategoryListingCard key={listing.id} listing={listing} />
                  ))}
                </Grid>
              ) : (
                <Flex direction="column" style={styles.emptyState}>
                  <Body variant="secondary">
                    No listings are assigned to this branch yet.
                  </Body>
                  {import.meta.env.DEV ? (
                    <Link href="/dev/categories">
                      Open the dev recategorization panel to assign some.
                    </Link>
                  ) : null}
                </Flex>
              )}
            </Flex>
          </Flex>
        </Page.Root>
      </HeaderLayout.Page>
    </HeaderLayout.Root>
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

function CategoryListingCard({ listing }: { listing: DirectoryListingCard }) {
  return (
    <RouterLink
      to="/products/$productId"
      params={{ productId: getDirectoryListingSlug(listing) }}
      {...stylex.props(styles.listingLink)}
    >
      <Card style={styles.listingCard}>
        <Flex direction="column" style={styles.listingCardBody}>
          <Flex gap="2xl" style={styles.listingHeader}>
            <Avatar
              alt={listing.name}
              fallback={getInitials(listing.name)}
              size="xl"
              src={listing.iconUrl || undefined}
            />
            <Flex direction="column" gap="md" style={styles.listingInfo}>
              <Text size="xl" weight="semibold">
                {listing.name}
              </Text>
              <SmallBody variant="secondary">{listing.category}</SmallBody>
            </Flex>
          </Flex>
          <Body variant="secondary">{listing.tagline}</Body>
          <div />
          <Flex justify="between" gap="xl" style={styles.listingFooter}>
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

function getCategoryIcon(label: string): LucideIcon {
  if (label === "Analytics") return BarChart3;
  if (label === "Protocol" || label === "Tools") return Code2;
  if (label === "PDS" || label === "AppView") return RadioTower;

  return AppWindow;
}

function getSoftAccentSurface(accent: DirectoryCategoryAccent) {
  if (accent === "pink") return styles.pinkSurface;
  if (accent === "purple") return styles.purpleSurface;
  if (accent === "green") return styles.greenSurface;

  return styles.blueSurface;
}

function formatCount(count: number) {
  return `${count} ${count === 1 ? "listing" : "listings"}`;
}

function getInitials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("");
}
