import * as stylex from "@stylexjs/stylex";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link as RouterLink } from "@tanstack/react-router";
import { AppWindow, Code2, type LucideIcon } from "lucide-react";

import { Flex } from "../design-system/flex";
import { Grid } from "../design-system/grid";
import { HeaderLayout } from "../design-system/header-layout";
import { Link } from "../design-system/link";
import { Page } from "../design-system/page";
import { blue } from "../design-system/theme/colors/blue.stylex";
import { pink } from "../design-system/theme/colors/pink.stylex";
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
import { directoryListingApi } from "../integrations/tanstack-query/api-directory-listings.functions";
import {
  type DirectoryCategoryAccent,
  type DirectoryCategoryTreeNode,
} from "../lib/directory-categories";

export const Route = createFileRoute("/categories/all")({
  loader: ({ context }) =>
    context.queryClient.ensureQueryData(
      directoryListingApi.getDirectoryCategoryTreeQueryOptions,
    ),
  component: CategoriesChooserPage,
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
  pageHeader: {
    gap: gap["4xl"],
    maxWidth: "46rem",
  },
  categoriesGrid: {
    display: "grid",
    gap: gap["2xl"],
    gridTemplateColumns: {
      default: "1fr",
      [breakpoints.sm]: "repeat(2, minmax(0, 1fr))",
    },
  },
  categoryCardLink: {
    display: "block",
    textDecoration: "none",
  },
  categoryCard: {
    borderRadius: radius.xl,
    borderStyle: "solid",
    borderWidth: 1,
    boxShadow: shadow.lg,
    color: "white",
    cornerShape: "squircle",
    display: "flex",
    flexDirection: "column",
    gap: gap["4xl"],
    justifyContent: "space-between",
    minHeight: "14rem",
    paddingBottom: verticalSpace["4xl"],
    paddingLeft: horizontalSpace["4xl"],
    paddingRight: horizontalSpace["4xl"],
    paddingTop: verticalSpace["4xl"],
  },
  categoryHeader: {
    gap: gap["2xl"],
  },
  categoryIcon: {
    alignItems: "center",
    backdropFilter: "blur(10px)",
    backgroundColor: `color-mix(in srgb, ${uiColor.component1} 36%, transparent)`,
    borderColor: `color-mix(in srgb, ${uiColor.border1} 65%, transparent)`,
    borderRadius: radius.md,
    borderStyle: "solid",
    borderWidth: 1,
    display: "inline-flex",
    height: "2.75rem",
    justifyContent: "center",
    width: "2.75rem",
  },
  categoryContent: {
    gap: gap["lg"],
  },
  eyebrow: {
    letterSpacing: "0.16em",
    textTransform: "uppercase",
  },
  categoryTitle: {
    display: "block",
    textShadow: `0 10px 30px ${uiColor.overlayBackdrop}`,
  },
  categoryDescription: {
    color: uiColor.textContrast,
    textShadow: `0 6px 20px ${uiColor.overlayBackdrop}`,
  },
  helperText: {
    color: uiColor.textContrast,
    textShadow: `0 6px 20px ${uiColor.overlayBackdrop}`,
  },
  categoryCount: {
    color: uiColor.textContrast,
    textShadow: `0 6px 20px ${uiColor.overlayBackdrop}`,
  },
  subcategoryList: {
    gap: gap["md"],
  },
  subcategoryLink: {
    color: uiColor.textContrast,
    textDecoration: "underline",
    textDecorationColor: `color-mix(in srgb, ${uiColor.textContrast} 45%, transparent)`,
    textUnderlineOffset: "0.18em",
  },
  blueSurface: {
    backgroundImage: `linear-gradient(135deg, ${blue.border2} 0%, ${blue.solid1} 100%)`,
    borderColor: blue.border1,
  },
  pinkSurface: {
    backgroundImage: `linear-gradient(135deg, ${pink.border2} 0%, ${pink.solid1} 100%)`,
    borderColor: pink.border1,
  },
});

function CategoriesChooserPage() {
  const { data: categories } = useSuspenseQuery(
    directoryListingApi.getDirectoryCategoryTreeQueryOptions,
  );
  const rootCategories = categories.filter(
    (category) => category.id === "apps" || category.id === "protocol",
  );

  return (
    <HeaderLayout.Root>
      <HeaderLayout.Page>
        <Page.Root variant="large" style={styles.page}>
          <Flex direction="column" style={styles.pageContent}>
            <Flex gap="xl" style={styles.navLinks}>
              <Link href="/">Back to home</Link>
              {import.meta.env.DEV ? (
                <>
                  <Link href="/dev/categories">Recategorize DB</Link>
                  <Link href="/dev/app-tags">App tags</Link>
                </>
              ) : null}
            </Flex>

            <Flex direction="column" style={styles.pageHeader}>
              <Heading1>Browse Categories</Heading1>
              <Body variant="secondary">
                The directory is now split into dedicated Apps and Protocol
                browse pages. Choose a branch to explore the curated hierarchy
                with rolled-up counts and subcategory previews.
              </Body>
            </Flex>

            <Grid style={styles.categoriesGrid}>
              {rootCategories.map((category) => (
                <RootCategoryCard key={category.id} category={category} />
              ))}
            </Grid>
          </Flex>
        </Page.Root>
      </HeaderLayout.Page>
    </HeaderLayout.Root>
  );
}

function RootCategoryCard({
  category,
}: {
  category: DirectoryCategoryTreeNode;
}) {
  const CategoryIcon = getCategoryIcon(category.label);

  return (
    <RouterLink
      to={category.id === "apps" ? "/apps/all" : "/protocol/all"}
      {...stylex.props(styles.categoryCardLink)}
    >
      <div
        {...stylex.props(
          styles.categoryCard,
          getSoftAccentSurface(category.accent),
        )}
      >
        <Flex direction="column" style={styles.categoryHeader}>
          <div {...stylex.props(styles.categoryIcon)}>
            <CategoryIcon size={18} strokeWidth={2.25} />
          </div>
          <Flex direction="column" style={styles.categoryContent}>
            <SmallBody style={styles.eyebrow}>
              {formatCount(category.count)}
            </SmallBody>
            <Text size="3xl" weight="semibold" style={styles.categoryTitle}>
              {category.label}
            </Text>
            <Body style={styles.categoryDescription}>
              {category.description}
            </Body>
            <Text size="sm" style={styles.helperText}>
              Open the full {category.label.toLowerCase()} branch.
            </Text>
          </Flex>
        </Flex>

        <Flex direction="column" style={styles.subcategoryList}>
          {category.children.slice(0, 4).map((child) => (
            <Text key={child.id} size="sm" style={styles.subcategoryLink}>
              {child.label} ({formatCount(child.count).toLowerCase()})
            </Text>
          ))}
        </Flex>
      </div>
    </RouterLink>
  );
}

function getCategoryIcon(label: string): LucideIcon {
  if (label === "Protocol") return Code2;

  return AppWindow;
}

function getSoftAccentSurface(accent: DirectoryCategoryAccent) {
  if (accent === "pink") return styles.pinkSurface;

  return styles.blueSurface;
}

function formatCount(count: number) {
  return `${count} ${count === 1 ? "listing" : "listings"}`;
}
