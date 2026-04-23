import * as stylex from "@stylexjs/stylex";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link, type LinkProps } from "@tanstack/react-router";

import { Card, CardBody, CardHeader, CardTitle } from "../design-system/card";
import { Flex } from "../design-system/flex";
import { Page } from "../design-system/page";
import {
  gap,
  verticalSpace,
} from "../design-system/theme/semantic-spacing.stylex";
import { Body, Heading1, SmallBody } from "../design-system/typography";
import { Text } from "../design-system/typography/text";
import { adminApi } from "../integrations/tanstack-query/api-admin.functions";
import { ui } from "../design-system/theme/semantic-color.stylex";
import { useHover } from "react-aria";

export const Route = createFileRoute("/_header-layout/_admin-layout/admin/")({
  component: AdminOverviewPage,
});

const styles = stylex.create({
  page: {
    paddingBottom: verticalSpace["10xl"],
    paddingTop: verticalSpace["6xl"],
  },
  section: {
    maxWidth: "60rem",
  },
  summaryGrid: {
    display: "grid",
    gap: gap.xl,
    gridTemplateColumns: "repeat(auto-fill, minmax(14rem, 1fr))",
    width: "100%",
  },
  item: {
    cursor: "pointer",
    textDecoration: "none",
  },
  link: {
    textDecoration: "none",
  },
});

function AdminOverviewPage() {
  const { data } = useSuspenseQuery(adminApi.getAdminDashboardQueryOptions);

  const unverifiedCount = data.unverified.length;
  const pendingClaimCount = data.pendingClaims.length;
  const heroCount = data.homePageHeroListings.length;

  return (
    <Page.Root variant="large" style={styles.page}>
      <Flex direction="column" gap="6xl" style={styles.section}>
        <Heading1>Admin overview</Heading1>
        <SmallBody>
          Moderate listings and manage featured content. Pick a section from the
          sidebar to get started.
        </SmallBody>

        <div {...stylex.props(styles.summaryGrid)}>
          <SummaryCard
            count={unverifiedCount}
            description="Listings awaiting verification or rejection."
            title="Unverified listings"
            to="/admin/unverified-listings"
          />
          <SummaryCard
            count={pendingClaimCount}
            description="Ownership claims to approve or reject."
            title="Pending claims"
            to="/admin/pending-claims"
          />
          <SummaryCard
            count={heroCount}
            description="Apps featured on the homepage hero."
            title="Home page hero"
            to="/admin/home-page-hero"
          />
          <SummaryCard
            description="Confirm and manage Bluesky accounts tied to product listings."
            title="Product account associations"
            to="/admin/listing-product-accounts"
          />
          <SummaryCard
            description="Edit any listing still published from the store account — form, images, and generate/preview tools in one place."
            title="Managed listings"
            to="/admin/managed-listings"
          />
          <SummaryCard
            description="Publish a brand-new listing to the store PDS, with hero/icon generators built in."
            title="Add listing"
            to="/admin/add-listing"
          />
        </div>
      </Flex>
    </Page.Root>
  );
}

interface SummaryCardProps {
  count?: number;
  description: string;
  title: string;
  to: LinkProps["to"];
}

function SummaryCard({ count, description, title, to }: SummaryCardProps) {
  const { isHovered, hoverProps } = useHover({});
  return (
    <Link to={to} {...stylex.props(styles.link)}>
      <Card
        style={[styles.item, ui.borderInteractive, ui.bgGhost]}
        {...(hoverProps as Omit<typeof hoverProps, "style" | "className">)}
        data-hovered={isHovered || undefined}
      >
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardBody>
          <Flex direction="column" gap="4xl">
            {count !== undefined ? (
              <Text size="4xl" weight="bold">
                {count}
              </Text>
            ) : null}
            <Body variant="secondary">{description}</Body>
          </Flex>
        </CardBody>
      </Card>
    </Link>
  );
}
