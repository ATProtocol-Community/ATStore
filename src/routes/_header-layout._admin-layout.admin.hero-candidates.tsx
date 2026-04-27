import * as stylex from "@stylexjs/stylex";
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { createFileRoute, notFound } from "@tanstack/react-router";
import { useState } from "react";

import { Button } from "../design-system/button";
import { Card, CardBody, CardHeader, CardTitle } from "../design-system/card";
import { Flex } from "../design-system/flex";
import { Page } from "../design-system/page";
import { radius } from "../design-system/theme/radius.stylex";
import { shadow } from "../design-system/theme/shadow.stylex";
import {
  gap,
  horizontalSpace,
  verticalSpace,
} from "../design-system/theme/semantic-spacing.stylex";
import { uiColor } from "../design-system/theme/color.stylex";
import { ui } from "../design-system/theme/semantic-color.stylex";
import {
  Body,
  Heading1,
  Heading3,
  SmallBody,
} from "../design-system/typography";
import { Text } from "../design-system/typography/text";
import {
  adminHeroCandidatesApi,
  type HeroCandidateEntry,
} from "../integrations/tanstack-query/api-admin-hero-candidates.functions";

export const Route = createFileRoute(
  "/_header-layout/_admin-layout/admin/hero-candidates",
)({
  beforeLoad: () => {
    if (import.meta.env.PROD) {
      throw notFound();
    }
  },
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData(
      adminHeroCandidatesApi.getHeroCandidatesQueryOptions,
    );
  },
  component: AdminHeroCandidatesPage,
});

const styles = stylex.create({
  page: {
    paddingBottom: verticalSpace["10xl"],
    paddingTop: verticalSpace["6xl"],
  },
  section: {
    maxWidth: "84rem",
  },
  itemList: {
    display: "flex",
    flexDirection: "column",
    gap: gap.xl,
  },
  itemCard: {
    boxShadow: shadow.sm,
  },
  itemCardBody: {
    gap: gap.lg,
    paddingBottom: verticalSpace.xl,
    paddingLeft: horizontalSpace.xl,
    paddingRight: horizontalSpace.xl,
    paddingTop: verticalSpace.xl,
  },
  imagePair: {
    alignItems: "stretch",
    display: "flex",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: gap.lg,
    width: "100%",
  },
  imagePane: {
    flexBasis: 0,
    flexGrow: 1,
    flexShrink: 1,
    gap: gap.sm,
    minWidth: "20rem",
  },
  paneLabel: {
    alignItems: "center",
    gap: gap.sm,
  },
  pill: {
    backgroundColor: ui.bgGhost,
    borderRadius: "9999px",
    fontSize: "0.7rem",
    paddingBottom: verticalSpace.xs,
    paddingLeft: horizontalSpace.md,
    paddingRight: horizontalSpace.md,
    paddingTop: verticalSpace.xs,
    textTransform: "uppercase",
  },
  compImageBox: {
    aspectRatio: "16 / 9",
    backgroundColor: uiColor.component1,
    borderColor: uiColor.component2,
    borderRadius: radius.md,
    borderStyle: "solid",
    borderWidth: 1,
    overflow: "hidden",
    position: "relative",
    width: "100%",
  },
  compImage: {
    display: "block",
    height: "100%",
    objectFit: "cover",
    width: "100%",
  },
  compImagePlaceholder: {
    alignItems: "center",
    display: "flex",
    height: "100%",
    justifyContent: "center",
    paddingBottom: verticalSpace.lg,
    paddingLeft: horizontalSpace.lg,
    paddingRight: horizontalSpace.lg,
    paddingTop: verticalSpace.lg,
    textAlign: "center",
    width: "100%",
  },
  metaRow: {
    alignItems: "center",
    flexWrap: "wrap",
    gap: gap.md,
    justifyContent: "space-between",
  },
  externalUrl: {
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, monospace",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  buttonRow: {
    alignItems: "center",
    flexWrap: "wrap",
    gap: gap.md,
  },
  emptyMessage: {
    paddingBottom: verticalSpace["2xl"],
    paddingLeft: horizontalSpace["2xl"],
    paddingRight: horizontalSpace["2xl"],
    paddingTop: verticalSpace["2xl"],
  },
});

function AdminHeroCandidatesPage() {
  const { data } = useSuspenseQuery(
    adminHeroCandidatesApi.getHeroCandidatesQueryOptions,
  );

  const generatedAtLabel = data.generatedAt
    ? new Date(data.generatedAt).toLocaleString()
    : "never";

  return (
    <Page.Root variant="large" style={styles.page}>
      <Flex direction="column" gap="6xl" style={styles.section}>
        <Flex direction="column" gap="2xl">
          <Heading1>Hero candidate review queue (dev)</Heading1>
          <SmallBody>
            Every AtStore-managed listing for which the scrape captured a hero
            candidate &mdash; either the site&rsquo;s <code>og:image</code> or,
            when none is published, a screenshot of the homepage. The current
            hero is on the left, the candidate on the right. Click{" "}
            <em>Use as hero</em> to upload the candidate as a fresh atproto blob
            (this also marks the listing reviewed), <em>Skip</em> to leave the
            existing hero alone, <em>Remove og/screenshot</em> to delete the
            captured candidate from disk so it&rsquo;s not offered again, or{" "}
            <em>Remove hero</em> to clear the listing&rsquo;s current hero
            entirely (republishes the lexicon record with no{" "}
            <code>heroImage</code> blob &mdash; the directory then falls back to
            screenshots / category art). Reviews persist in{" "}
            <code>out/hero-candidates/reviewed.json</code>, so the queue shrinks
            as you work through it. Listings whose current hero is a legacy{" "}
            <code>/generated/listings/&hellip;</code> AI image (the ones we want
            to replace) are surfaced first, then og:image candidates, then
            screenshot fallbacks.
          </SmallBody>
          <Text size="sm" variant="secondary">
            {data.pending.length} pending &middot; {data.totalApplied} applied{" "}
            &middot; {data.totalDismissed} skipped &middot;{" "}
            {data.totalWithOgCandidate} og:image &middot;{" "}
            {data.totalWithScreenshotCandidate} screenshot &middot; last scrape:{" "}
            {generatedAtLabel}
          </Text>
        </Flex>

        {data.totalWithOgCandidate + data.totalWithScreenshotCandidate === 0 ? (
          <Card style={styles.itemCard}>
            <CardBody>
              <Body style={styles.emptyMessage}>
                No hero candidates in{" "}
                <code>out/hero-candidates/index.json</code>. Run{" "}
                <code>npm run scrape:product-hero-candidates</code> first.
              </Body>
            </CardBody>
          </Card>
        ) : data.pending.length === 0 ? (
          <Card style={styles.itemCard}>
            <CardBody>
              <Body style={styles.emptyMessage}>
                Queue empty &mdash; you&rsquo;ve reviewed all{" "}
                {data.totalWithOgCandidate + data.totalWithScreenshotCandidate}{" "}
                listings with a hero candidate. Delete{" "}
                <code>out/hero-candidates/reviewed.json</code> to start over.
              </Body>
            </CardBody>
          </Card>
        ) : (
          <div {...stylex.props(styles.itemList)}>
            {data.pending.map((entry) => (
              <HeroCandidateCard key={entry.id} entry={entry} />
            ))}
          </div>
        )}
      </Flex>
    </Page.Root>
  );
}

interface HeroCandidateCardProps {
  entry: HeroCandidateEntry;
}

function HeroCandidateCard({ entry }: HeroCandidateCardProps) {
  const queryClient = useQueryClient();

  const invalidateQueue = async () => {
    await queryClient.invalidateQueries({
      queryKey: ["admin", "hero-candidates"],
    });
  };

  const applyMutation = useMutation({
    mutationFn: async () =>
      adminHeroCandidatesApi.applyHeroCandidate({
        data: { listingId: entry.id },
      }),
    onSuccess: invalidateQueue,
  });

  const dismissMutation = useMutation({
    mutationFn: async () =>
      adminHeroCandidatesApi.dismissHeroCandidate({
        data: { listingId: entry.id },
      }),
    onSuccess: invalidateQueue,
  });

  const removeOgMutation = useMutation({
    mutationFn: async () =>
      adminHeroCandidatesApi.removeOgCandidate({
        data: { listingId: entry.id },
      }),
    onSuccess: invalidateQueue,
  });

  const removeHeroMutation = useMutation({
    mutationFn: async () =>
      adminHeroCandidatesApi.removeHero({
        data: { listingId: entry.id },
      }),
    onSuccess: invalidateQueue,
  });

  const busy =
    applyMutation.isPending ||
    dismissMutation.isPending ||
    removeOgMutation.isPending ||
    removeHeroMutation.isPending;
  const errorMessage =
    applyMutation.error instanceof Error
      ? applyMutation.error.message
      : dismissMutation.error instanceof Error
        ? dismissMutation.error.message
        : removeOgMutation.error instanceof Error
          ? removeOgMutation.error.message
          : removeHeroMutation.error instanceof Error
            ? removeHeroMutation.error.message
            : null;

  const liveHeroUrl = entry.currentHeroImageUrl;

  return (
    <Card style={styles.itemCard}>
      <CardHeader>
        <Flex style={styles.metaRow}>
          <Flex direction="column" gap="xs">
            <CardTitle>{entry.name}</CardTitle>
            {entry.externalUrl ? (
              <Text size="xs" variant="secondary" style={styles.externalUrl}>
                <a
                  href={entry.externalUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {entry.externalUrl}
                </a>
              </Text>
            ) : null}
          </Flex>
          <Flex style={styles.buttonRow}>
            <span {...stylex.props(styles.pill)}>
              {entry.candidate.kind === "og" ? "og:image" : "screenshot"}
            </span>
            {entry.currentHeroIsAiGenerated ? (
              <span {...stylex.props(styles.pill)}>AI-generated hero</span>
            ) : null}
          </Flex>
        </Flex>
      </CardHeader>
      <CardBody>
        <Flex direction="column" style={styles.itemCardBody}>
          <div {...stylex.props(styles.imagePair)}>
            <Flex direction="column" style={styles.imagePane}>
              <Flex style={styles.paneLabel}>
                <Heading3>Current hero</Heading3>
              </Flex>
              <ComparisonImage
                src={liveHeroUrl}
                fallbackText="No hero image set"
              />
              <Text size="xs" variant="secondary" style={styles.externalUrl}>
                {liveHeroUrl ?? "—"}
              </Text>
            </Flex>

            <Flex direction="column" style={styles.imagePane}>
              <Flex style={styles.paneLabel}>
                <Heading3>
                  Proposed (
                  {entry.candidate.kind === "og" ? "og:image" : "screenshot"})
                </Heading3>
              </Flex>
              <ComparisonImage
                src={entry.candidateImageUrl}
                fallbackText="candidate file not on disk"
              />
              <Text size="xs" variant="secondary" style={styles.externalUrl}>
                {entry.candidate.sourceUrl}
              </Text>
            </Flex>
          </div>

          {errorMessage ? (
            <Text size="sm" variant="critical">
              {errorMessage}
            </Text>
          ) : null}

          <Flex style={styles.buttonRow}>
            <Button
              size="sm"
              isDisabled={busy}
              onPress={() => applyMutation.mutate()}
            >
              {applyMutation.isPending ? "Uploading blob…" : "Use as hero"}
            </Button>
            <Button
              size="sm"
              variant="secondary"
              isDisabled={busy}
              onPress={() => dismissMutation.mutate()}
            >
              {dismissMutation.isPending ? "Skipping…" : "Skip"}
            </Button>
            <Button
              size="sm"
              variant="critical"
              isDisabled={busy}
              onPress={() => removeOgMutation.mutate()}
            >
              {removeOgMutation.isPending
                ? "Removing…"
                : entry.candidate.kind === "og"
                  ? "Remove og"
                  : "Remove screenshot"}
            </Button>
            <Button
              size="sm"
              variant="critical"
              isDisabled={busy || !entry.currentHeroImageUrl}
              onPress={() => removeHeroMutation.mutate()}
            >
              {removeHeroMutation.isPending ? "Clearing hero…" : "Remove hero"}
            </Button>
            <Button
              size="sm"
              variant="secondary"
              isDisabled={busy}
              onPress={() => {
                window.open(entry.candidateImageUrl, "_blank");
              }}
            >
              Open candidate
            </Button>
          </Flex>
        </Flex>
      </CardBody>
    </Card>
  );
}

interface ComparisonImageProps {
  src: string | null;
  fallbackText: string;
}

function ComparisonImage({ src, fallbackText }: ComparisonImageProps) {
  const [errored, setErrored] = useState(false);
  const showImage = src && !errored;
  return (
    <div {...stylex.props(styles.compImageBox)}>
      {showImage ? (
        <img
          src={src}
          alt=""
          onError={() => setErrored(true)}
          {...stylex.props(styles.compImage)}
        />
      ) : (
        <div {...stylex.props(styles.compImagePlaceholder)}>
          <Text size="sm" variant="secondary">
            {errored ? `Failed to load: ${src}` : fallbackText}
          </Text>
        </div>
      )}
    </div>
  );
}
