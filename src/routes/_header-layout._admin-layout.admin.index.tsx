import * as stylex from "@stylexjs/stylex";
import { useSuspenseQuery } from "@tanstack/react-query";
import {
  createFileRoute,
  createLink,
  Link as RouterLink,
  type LinkProps,
} from "@tanstack/react-router";
import {
  ChevronRightIcon,
  LayoutTemplateIcon,
  PencilIcon,
  PlusIcon,
} from "lucide-react";

import { Button } from "../design-system/button";
import {
  Card,
  CardBody,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../design-system/card";
import { Flex } from "../design-system/flex";
import { Link } from "../design-system/link";
import { Page } from "../design-system/page";
import { StarRating } from "../design-system/star-rating";
import { uiColor } from "../design-system/theme/color.stylex";
import { radius } from "../design-system/theme/radius.stylex";
import {
  success,
  ui,
  warning,
} from "../design-system/theme/semantic-color.stylex";
import {
  gap,
  horizontalSpace,
  verticalSpace,
} from "../design-system/theme/semantic-spacing.stylex";
import { Body, Heading1, LabelText } from "../design-system/typography";
import { Text } from "../design-system/typography/text";
import { adminApi } from "../integrations/tanstack-query/api-admin.functions";
import { useHover } from "react-aria";

import { getDirectoryListingSlug } from "../lib/directory-listing-slugs";

export const Route = createFileRoute("/_header-layout/_admin-layout/admin/")({
  component: AdminOverviewPage,
});

const ProductLink = createLink(Link);
const ButtonLink = createLink(Button);

const styles = stylex.create({
  page: {
    paddingBottom: verticalSpace["10xl"],
    paddingTop: verticalSpace["6xl"],
  },
  section: {
    maxWidth: "min(1200px, 100%)",
    width: "100%",
  },
  headlineBlock: {
    gap: gap["5xl"],
    display: "flex",
    flexDirection: "column",
    maxWidth: "42rem",
  },
  actionsRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: gap.md,
    alignItems: "center",
  },
  kpiGrid: {
    display: "grid",
    gap: gap.lg,
    gridTemplateColumns: {
      default: "repeat(1, minmax(0, 1fr))",
      "@media (min-width: 640px)": "repeat(2, minmax(0, 1fr))",
      "@media (min-width: 900px)": "repeat(3, minmax(0, 1fr))",
    },
    width: "100%",
  },
  kpiCard: {
    cursor: "pointer",
    position: "relative",
    textDecoration: "none",
    borderRadius: radius.lg,
  },
  kpiCardInner: {
    height: "100%",
  },
  kpiIconWrap: {
    position: "absolute",
    right: horizontalSpace.lg,
    top: verticalSpace.lg,
    color: uiColor.text1,
    opacity: 0.65,
    pointerEvents: "none",
  },
  kpiValue: {
    marginTop: verticalSpace.sm,
  },
  midGrid: {
    display: "grid",
    gap: gap.xl,
    gridTemplateColumns: {
      default: "minmax(0, 1fr)",
      "@media (min-width: 960px)": "1.4fr 1fr",
    },
    width: "100%",
  },
  chartWrap: {
    width: "100%",
  },
  chartSvg: {
    display: "block",
    height: "auto",
    maxWidth: "100%",
    width: "100%",
  },
  legendRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: gap.xl,
    marginTop: gap.lg,
    alignItems: "center",
  },
  legendItem: {
    alignItems: "center",
    gap: gap.sm,
    display: "inline-flex",
  },
  legendSwatch: {
    borderRadius: 2,
    flexShrink: 0,
    height: 3,
    width: 20,
  },
  tableScroll: {
    overflowX: "auto",
    width: "100%",
  },
  table: {
    borderCollapse: "collapse",
    width: "100%",
    fontSize: "0.8125rem",
  },
  th: {
    borderBottomColor: uiColor.border1,
    borderBottomStyle: "solid",
    borderBottomWidth: 1,
    color: uiColor.text1,
    fontWeight: 600,
    paddingBottom: verticalSpace.md,
    paddingRight: horizontalSpace.lg,
    paddingTop: verticalSpace.sm,
    textAlign: "left",
    whiteSpace: "nowrap",
  },
  td: {
    borderBottomColor: uiColor.border1,
    borderBottomStyle: "solid",
    borderBottomWidth: 1,
    color: uiColor.text2,
    paddingBottom: verticalSpace.md,
    paddingRight: horizontalSpace.lg,
    paddingTop: verticalSpace.md,
    verticalAlign: "middle",
  },
  tdMuted: {
    color: uiColor.text1,
    maxWidth: "14rem",
  },
  linkRow: {
    marginTop: verticalSpace.lg,
  },
  kpiLink: {
    textDecoration: "none",
    color: "inherit",
    display: "block",
    height: "100%",
  },
  badgeBase: {
    borderRadius: radius.full,
    borderStyle: "solid",
    borderWidth: 1,
    fontSize: "0.75rem",
    fontWeight: 500,
    paddingLeft: horizontalSpace.md,
    paddingRight: horizontalSpace.md,
    paddingTop: 2,
    paddingBottom: 2,
    textTransform: "lowercase",
    whiteSpace: "nowrap",
  },
});

const chartColors = {
  unclaimed: "#f97316",
  claimed: "#1d7afc",
} as const;

function formatRelativeTime(iso: string): string {
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  const diffMs = new Date(iso).getTime() - Date.now();
  const diffSec = Math.round(diffMs / 1000);
  const absSec = Math.abs(diffSec);
  if (absSec < 60) {
    return rtf.format(Math.round(diffMs / 1000), "second");
  }
  const diffMin = Math.round(diffMs / 60000);
  if (Math.abs(diffMin) < 60) {
    return rtf.format(diffMin, "minute");
  }
  const diffHr = Math.round(diffMs / 3600000);
  if (Math.abs(diffHr) < 48) {
    return rtf.format(diffHr, "hour");
  }
  const diffDay = Math.round(diffMs / 86400000);
  return rtf.format(diffDay, "day");
}

function excerpt(text: string | null, max = 96): string {
  if (!text || text.trim() === "") {
    return "—";
  }
  const t = text.trim();
  if (t.length <= max) {
    return t;
  }
  return `${t.slice(0, max - 1)}…`;
}

interface ClaimsPoint {
  monthLabel: string;
  unclaimed: number;
  claimedCumulative: number;
}

function ClaimsOverTimeChart({ data }: { data: ClaimsPoint[] }) {
  const w = 480;
  const h = 200;
  const pad = { t: 18, r: 14, b: 40, l: 44 };
  const innerW = w - pad.l - pad.r;
  const innerH = h - pad.t - pad.b;
  const maxY = Math.max(
    1,
    ...data.flatMap((d) => [d.unclaimed, d.claimedCumulative]),
  );
  const n = data.length;
  const xAt = (i: number) =>
    pad.l + (n <= 1 ? innerW / 2 : (innerW * i) / (n - 1));
  const yAt = (v: number) => pad.t + innerH - (innerH * v) / maxY;

  const dUnclaimed = data
    .map((p, i) => {
      const x = xAt(i);
      const y = yAt(p.unclaimed);
      return `${i === 0 ? "M" : "L"}${String(x)} ${String(y)}`;
    })
    .join(" ");
  const dClaimed = data
    .map((p, i) => {
      const x = xAt(i);
      const y = yAt(p.claimedCumulative);
      return `${i === 0 ? "M" : "L"}${String(x)} ${String(y)}`;
    })
    .join(" ");

  const yTicks = [0, Math.round(maxY / 2), maxY];

  return (
    <svg
      {...stylex.props(styles.chartSvg)}
      viewBox={`0 0 ${String(w)} ${String(h)}`}
    >
      {yTicks.map((tv) => {
        const y = yAt(tv);
        return (
          <g key={tv}>
            <line
              stroke={uiColor.border1}
              strokeDasharray="4 4"
              strokeWidth={1}
              x1={pad.l}
              x2={w - pad.r}
              y1={y}
              y2={y}
            />
            <text
              fill={uiColor.text1}
              fontSize={10}
              textAnchor="end"
              x={pad.l - 6}
              y={y + 3}
            >
              {String(tv)}
            </text>
          </g>
        );
      })}
      {data.map((p, i) => (
        <text
          fill={uiColor.text1}
          fontSize={10}
          key={p.monthLabel}
          textAnchor="middle"
          x={xAt(i)}
          y={h - 12}
        >
          {p.monthLabel}
        </text>
      ))}
      <path
        d={dUnclaimed}
        fill="none"
        stroke={chartColors.unclaimed}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
      />
      <path
        d={dClaimed}
        fill="none"
        stroke={chartColors.claimed}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
      />
    </svg>
  );
}

interface KpiCardProps {
  count: number;
  title: string;
  to: LinkProps["to"];
}

function KpiCard({ count, title, to }: KpiCardProps) {
  const { isHovered, hoverProps } = useHover({});
  return (
    <RouterLink to={to} {...stylex.props(styles.kpiLink)}>
      <Card
        style={[styles.kpiCard, ui.borderInteractive, ui.bgGhost]}
        {...(hoverProps as Omit<typeof hoverProps, "style" | "className">)}
        data-hovered={isHovered || undefined}
        size="lg"
      >
        <CardBody style={styles.kpiCardInner}>
          <Flex direction="column" gap="xl">
            <LabelText variant="secondary">{title}</LabelText>
            <Flex direction="column" gap="5xl">
              <Text size="4xl" style={styles.kpiValue} weight="bold">
                {count}
              </Text>
            </Flex>
          </Flex>
        </CardBody>
      </Card>
    </RouterLink>
  );
}

function StatusBadge({ label }: { label: "approved" | "pending" }) {
  const isApproved = label === "approved";
  return (
    <span
      {...stylex.props(
        styles.badgeBase,
        isApproved ? success.borderInteractive : warning.borderInteractive,
        isApproved ? success.text : warning.text,
      )}
    >
      {label}
    </span>
  );
}

function AdminOverviewPage() {
  const { data } = useSuspenseQuery(adminApi.getAdminDashboardQueryOptions);

  const unverifiedCount = data.unverified.length;
  const pendingClaimCount = data.pendingClaims.length;
  const totalClaimed = data.totalClaimedCount;

  return (
    <Page.Root variant="large" style={styles.page}>
      <Flex direction="column" gap="6xl" style={styles.section}>
        <div {...stylex.props(styles.headlineBlock)}>
          <Heading1>Admin overview</Heading1>
          <Body variant="secondary">
            Moderate listings and manage featured content. Pick a section from
            the sidebar to get started.
          </Body>
        </div>

        <div {...stylex.props(styles.actionsRow)}>
          <ButtonLink to="/admin/add-listing" size="lg" variant="primary">
            <PlusIcon aria-hidden />
            Add listing
          </ButtonLink>
          <ButtonLink
            to="/admin/managed-listings"
            size="lg"
            variant="secondary"
          >
            <PencilIcon aria-hidden />
            Edit a listing
          </ButtonLink>
          <ButtonLink to="/admin/home-page-hero" size="lg" variant="secondary">
            <LayoutTemplateIcon aria-hidden />
            Edit home page heroes
          </ButtonLink>
        </div>

        <div {...stylex.props(styles.kpiGrid)}>
          <KpiCard
            count={unverifiedCount}
            title="Unverified listings"
            to="/admin/unverified-listings"
          />
          <KpiCard
            count={pendingClaimCount}
            title="Pending claims"
            to="/admin/pending-claims"
          />
          <KpiCard
            count={totalClaimed}
            title="Total claimed"
            to="/admin/recently-claimed"
          />
        </div>

        <div {...stylex.props(styles.midGrid)}>
          <Card style={[ui.borderInteractive, ui.bgGhost]}>
            <CardHeader>
              <CardTitle>Claims over time</CardTitle>
              <CardDescription>
                Unclaimed burn-down vs claimed growth (last 2 months, verified
                listings still eligible to claim vs new claims per month).
              </CardDescription>
            </CardHeader>
            <CardBody>
              <div {...stylex.props(styles.chartWrap)}>
                <ClaimsOverTimeChart data={data.claimsOverTime} />
              </div>
              <div {...stylex.props(styles.legendRow)}>
                <div {...stylex.props(styles.legendItem)}>
                  <span
                    {...stylex.props(styles.legendSwatch)}
                    style={{ backgroundColor: chartColors.unclaimed }}
                  />
                  <Text size="sm" variant="secondary">
                    Unclaimed
                  </Text>
                </div>
                <div {...stylex.props(styles.legendItem)}>
                  <span
                    {...stylex.props(styles.legendSwatch)}
                    style={{ backgroundColor: chartColors.claimed }}
                  />
                  <Text size="sm" variant="secondary">
                    Claimed
                  </Text>
                </div>
              </div>
            </CardBody>
          </Card>

          <Card style={[ui.borderInteractive, ui.bgGhost]}>
            <CardHeader>
              <CardTitle>Recently claimed</CardTitle>
              <CardDescription>
                Listings recently claimed by owners, newest activity first.
              </CardDescription>
            </CardHeader>
            <CardBody>
              {data.recentClaimedPreview.length === 0 ? (
                <Body variant="secondary">None yet.</Body>
              ) : (
                <div {...stylex.props(styles.tableScroll)}>
                  <table {...stylex.props(styles.table)}>
                    <thead>
                      <tr>
                        <th {...stylex.props(styles.th)}>Listing</th>
                        <th {...stylex.props(styles.th)}>When</th>
                        <th {...stylex.props(styles.th)}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.recentClaimedPreview.map((row) => (
                        <tr key={row.id}>
                          <td {...stylex.props(styles.td)}>
                            <ProductLink
                              params={{
                                productId: getDirectoryListingSlug({
                                  name: row.name,
                                  slug: row.slug,
                                }),
                              }}
                              to="/products/$productId"
                            >
                              <Text size="sm" weight="medium">
                                {row.name}
                              </Text>
                            </ProductLink>
                          </td>
                          <td {...stylex.props(styles.td, styles.tdMuted)}>
                            {formatRelativeTime(row.whenIso)}
                          </td>
                          <td {...stylex.props(styles.td)}>
                            <StatusBadge label={row.statusLabel} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <div {...stylex.props(styles.linkRow)}>
                <Link href="/admin/recently-claimed">
                  <Text size="sm" variant="secondary">
                    View all claimed
                  </Text>{" "}
                  <ChevronRightIcon
                    aria-hidden
                    size={14}
                    style={{ display: "inline", verticalAlign: "middle" }}
                  />
                </Link>
              </div>
            </CardBody>
          </Card>
        </div>

        <Card style={[ui.borderInteractive, ui.bgGhost]}>
          <CardHeader>
            <CardTitle>Recent reviews</CardTitle>
            <CardDescription>
              All product reviews across the directory, newest first.
            </CardDescription>
          </CardHeader>
          <CardBody>
            {data.recentReviewsPreview.length === 0 ? (
              <Body variant="secondary">None yet.</Body>
            ) : (
              <div {...stylex.props(styles.tableScroll)}>
                <table {...stylex.props(styles.table)}>
                  <thead>
                    <tr>
                      <th {...stylex.props(styles.th)}>Listing</th>
                      <th {...stylex.props(styles.th)}>Reviewer</th>
                      <th {...stylex.props(styles.th)}>Rating</th>
                      <th {...stylex.props(styles.th)}>Excerpt</th>
                      <th {...stylex.props(styles.th)}>Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.recentReviewsPreview.map((r) => {
                      const handle = r.authorHandle?.trim();
                      const reviewerLabel = handle
                        ? `@${handle}`
                        : r.authorDisplayName?.trim() || "—";
                      return (
                        <tr key={r.id}>
                          <td {...stylex.props(styles.td)}>
                            <ProductLink
                              params={{
                                productId: getDirectoryListingSlug({
                                  name: r.listingName,
                                  slug: r.listingSlug,
                                }),
                              }}
                              to="/products/$productId"
                            >
                              <Text size="sm" weight="medium">
                                {r.listingName}
                              </Text>
                            </ProductLink>
                          </td>
                          <td {...stylex.props(styles.td, styles.tdMuted)}>
                            {handle ? (
                              <Link
                                href={`https://bsky.app/profile/${encodeURIComponent(handle)}`}
                                rel="noopener noreferrer"
                                target="_blank"
                              >
                                <Text size="sm">{reviewerLabel}</Text>
                              </Link>
                            ) : (
                              <Text size="sm">{reviewerLabel}</Text>
                            )}
                          </td>
                          <td {...stylex.props(styles.td)}>
                            <StarRating
                              rating={r.rating}
                              showReviewCount={false}
                              size={14}
                            />
                          </td>
                          <td {...stylex.props(styles.td, styles.tdMuted)}>
                            {excerpt(r.text)}
                          </td>
                          <td {...stylex.props(styles.td, styles.tdMuted)}>
                            {formatRelativeTime(r.reviewCreatedAt)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            <div {...stylex.props(styles.linkRow)}>
              <Link href="/admin/reviews">
                <Text size="sm" variant="secondary">
                  View all reviews
                </Text>{" "}
                <ChevronRightIcon
                  aria-hidden
                  size={14}
                  style={{ display: "inline", verticalAlign: "middle" }}
                />
              </Link>
            </div>
          </CardBody>
        </Card>
      </Flex>
    </Page.Root>
  );
}
