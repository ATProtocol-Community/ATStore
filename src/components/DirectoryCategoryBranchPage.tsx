import * as stylex from "@stylexjs/stylex";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Link as RouterLink, createLink } from "@tanstack/react-router";
import {
  AppWindow,
  BarChart3,
  Code2,
  RadioTower,
  type LucideIcon,
} from "lucide-react";

import { Flex } from "../design-system/flex";
import { Grid } from "../design-system/grid";
import { HeaderLayout } from "../design-system/header-layout";
import { Link } from "../design-system/link";
import { Page } from "../design-system/page";
import { blue } from "../design-system/theme/colors/blue.stylex";
import { indigo as green } from "../design-system/theme/colors/indigo.stylex";
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
import { directoryListingApi } from "../integrations/tanstack-query/api-directory-listings.functions";
import {
  type DirectoryCategoryAccent,
  type DirectoryCategoryTreeNode,
} from "../lib/directory-categories";

export type RootDirectoryCategoryId = "apps" | "protocol";

const AppLink = createLink(Link);

const ROOT_CATEGORY_COPY = {
  apps: {
    alternateHref: "/protocol/all",
    alternateLabel: "Protocol",
    description:
      "Browse the curated Apps branch of the directory. Counts roll up from nested categories so you can jump straight into Bluesky clients, analytics, creator tools, and more.",
  },
  protocol: {
    alternateHref: "/apps/all",
    alternateLabel: "Apps",
    description:
      "Browse the curated Protocol branch of the directory. Counts roll up from nested categories so you can drill into PDS tooling, AppView services, moderation, infrastructure, and more.",
  },
} satisfies Record<
  RootDirectoryCategoryId,
  {
    alternateHref: string;
    alternateLabel: string;
    description: string;
  }
>;

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
    maxWidth: "52rem",
  },
  categoriesGrid: {
    display: "grid",
    gap: gap["2xl"],
    gridTemplateColumns: {
      default: "1fr",
      [breakpoints.sm]: "repeat(2, minmax(0, 1fr))",
      [breakpoints.lg]: "repeat(3, minmax(0, 1fr))",
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
  categoryCount: {
    color: uiColor.textContrast,
    textShadow: `0 6px 20px ${uiColor.overlayBackdrop}`,
  },
  subcategoryList: {
    gap: gap["sm"],
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
  purpleSurface: {
    backgroundImage: `linear-gradient(135deg, ${purple.border2} 0%, ${purple.solid1} 100%)`,
    borderColor: purple.border1,
  },
  greenSurface: {
    backgroundImage: `linear-gradient(135deg, ${green.border2} 0%, ${green.solid1} 100%)`,
    borderColor: green.border1,
  },
});

export function DirectoryCategoryBranchPage({
  rootCategoryId,
}: {
  rootCategoryId: RootDirectoryCategoryId;
}) {
  const { data: categories } = useSuspenseQuery(
    directoryListingApi.getDirectoryCategoryTreeQueryOptions,
  );
  const category = categories.find((item) => item.id === rootCategoryId);

  if (!category) {
    throw new Error(`Missing root category: ${rootCategoryId}`);
  }

  const copy = ROOT_CATEGORY_COPY[rootCategoryId];

  return (
    <HeaderLayout.Root>
      <HeaderLayout.Page>
        <Page.Root variant="large" style={styles.page}>
          <Flex direction="column" style={styles.pageContent}>
            <Flex gap="xl" style={styles.navLinks}>
              <AppLink to="/">Back to home</AppLink>
              <AppLink to={"/categories/all" as never}>All branches</AppLink>
              <AppLink to={copy.alternateHref as never}>
                Browse {copy.alternateLabel}
              </AppLink>
              {import.meta.env.DEV ? (
                <>
                  <AppLink to="/dev/categories">Recategorize DB</AppLink>
                  <AppLink to="/dev/app-tags">App tags</AppLink>
                </>
              ) : null}
            </Flex>

            <Flex direction="column" style={styles.pageHeader}>
              <SmallBody style={styles.eyebrow}>
                {formatCount(category.count)}
              </SmallBody>
              <Heading1>{category.label}</Heading1>
              <Body variant="secondary">{copy.description}</Body>
            </Flex>

            <Grid style={styles.categoriesGrid}>
              {category.children.map((child) => (
                <CategoryCard key={child.id} category={child} />
              ))}
            </Grid>
          </Flex>
        </Page.Root>
      </HeaderLayout.Page>
    </HeaderLayout.Root>
  );
}

function CategoryCard({ category }: { category: DirectoryCategoryTreeNode }) {
  const CategoryIcon = getCategoryIcon(category.label);

  return (
    <RouterLink
      to="/categories/$categoryId"
      params={{ categoryId: category.id }}
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
              {category.pathLabels.slice(0, -1).join(" / ") || "Top level"}
            </SmallBody>
            <Text size="3xl" weight="semibold" style={styles.categoryTitle}>
              {category.label}
            </Text>
            <Body style={styles.categoryDescription}>
              {category.description}
            </Body>
          </Flex>
        </Flex>

        <Flex direction="column" style={styles.subcategoryList}>
          <Text weight="semibold" style={styles.categoryCount}>
            {formatCount(category.count)}
          </Text>
          {category.children.map((child) => (
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
