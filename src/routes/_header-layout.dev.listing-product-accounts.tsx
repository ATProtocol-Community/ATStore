import * as stylex from "@stylexjs/stylex";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, createLink, notFound } from "@tanstack/react-router";
import { useState } from "react";

import { Avatar } from "../design-system/avatar";
import { Button } from "../design-system/button";
import { Card } from "../design-system/card";
import { Flex } from "../design-system/flex";
import { HeaderLayout } from "../design-system/header-layout";
import { Link } from "../design-system/link";
import { Page } from "../design-system/page";
import { uiColor } from "../design-system/theme/color.stylex";
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
  type ProductAccountCandidateQueueItem,
} from "../integrations/tanstack-query/api-directory-listings.functions";

export const Route = createFileRoute(
  "/_header-layout/dev/listing-product-accounts",
)({
  loader: async ({ context }) => {
    if (!import.meta.env.DEV) {
      throw notFound();
    }

    await context.queryClient.prefetchQuery(
      directoryListingApi.getNextProductAccountCandidateQueryOptions,
    );
  },
  component: DevListingProductAccountsPage,
});

const AppLink = createLink(Link);

const styles = stylex.create({
  page: {
    paddingBottom: verticalSpace["10xl"],
    paddingTop: verticalSpace["6xl"],
  },
  pageContent: {
    gap: gap["6xl"],
  },
  pageHeader: {
    gap: gap["4xl"],
    maxWidth: "52rem",
  },
  card: {
    borderRadius: radius.xl,
    boxShadow: shadow.lg,
    maxWidth: "48rem",
    paddingBottom: verticalSpace["4xl"],
    paddingLeft: horizontalSpace["4xl"],
    paddingRight: horizontalSpace["4xl"],
    paddingTop: verticalSpace["4xl"],
  },
  row: {
    gap: gap["3xl"],
  },
  meta: {
    color: uiColor.text2,
  },
  actions: {
    flexWrap: "wrap",
    gap: gap["2xl"],
  },
});

function profileUrl(did: string) {
  return `https://bsky.app/profile/${encodeURIComponent(did)}`;
}

function DevListingProductAccountsPage() {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const { data, isFetching, refetch } = useQuery({
    ...directoryListingApi.getNextProductAccountCandidateQueryOptions,
  });

  async function refreshQueue() {
    await queryClient.invalidateQueries({
      queryKey: ["storeListings", "dev", "nextProductAccountCandidate"],
    });
    await refetch();
  }

  async function onConfirm(item: ProductAccountCandidateQueueItem) {
    setBusy(true);
    setError(null);
    try {
      await directoryListingApi.confirmProductAccountCandidate({
        data: { candidateId: item.candidateId },
      });
      await queryClient.invalidateQueries({ queryKey: ["storeListings"] });
      await refreshQueue();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function onReject(item: ProductAccountCandidateQueueItem) {
    setBusy(true);
    setError(null);
    try {
      await directoryListingApi.rejectProductAccountCandidate({
        data: { candidateId: item.candidateId },
      });
      await refreshQueue();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <HeaderLayout.Page>
      <Page.Root variant="large" style={styles.page}>
        <Flex direction="column" style={styles.pageContent}>
          <Flex gap="xl" style={{ flexWrap: "wrap" }}>
            <AppLink to="/dev/app-tags">App tags</AppLink>
            <AppLink to="/dev/categories">Categories</AppLink>
            <AppLink to="/">Home</AppLink>
          </Flex>

          <Flex direction="column" style={styles.pageHeader}>
            <Heading1>Product Bluesky account</Heading1>
            <Body style={styles.meta}>
              Review queued candidates one at a time. Confirm publishes{" "}
              <code>productAccountDid</code> to the store repo and updates the
              listing row.
            </Body>
          </Flex>

          {error ? (
            <Text size="sm" style={{ color: uiColor.danger }}>
              {error}
            </Text>
          ) : null}

          {isFetching && !data ? (
            <SmallBody>Loading…</SmallBody>
          ) : !data ? (
            <Card style={styles.card}>
              <Body>No pending candidates. Run </Body>
              <code>pnpm discover:product-bsky</code>
              <Body> to enqueue.</Body>
            </Card>
          ) : (
            <Card style={styles.card}>
              <Flex direction="column" style={styles.row}>
                <Flex align="center" gap="lg">
                  <Avatar alt="" size="lg" src={data.iconUrl ?? undefined} />
                  <Flex direction="column" gap="xs">
                    <Text size="2xl" weight="semibold">
                      {data.listingName}
                    </Text>
                    <SmallBody style={styles.meta}>
                      /products/{data.listingSlug}
                    </SmallBody>
                  </Flex>
                </Flex>

                <Flex direction="column" gap="sm">
                  <SmallBody style={styles.meta}>
                    Source: {data.source}
                  </SmallBody>
                  <Body>
                    <strong>Candidate DID:</strong>{" "}
                    <a
                      href={profileUrl(data.candidateDid)}
                      rel="noreferrer"
                      target="_blank"
                    >
                      {data.candidateDid}
                    </a>
                  </Body>
                  {data.candidateHandle ? (
                    <Body>
                      <strong>Handle (at enqueue):</strong>{" "}
                      {data.candidateHandle}
                    </Body>
                  ) : null}
                  {data.externalUrl ? (
                    <Body>
                      <strong>External URL:</strong>{" "}
                      <a
                        href={data.externalUrl}
                        rel="noreferrer"
                        target="_blank"
                      >
                        {data.externalUrl}
                      </a>
                    </Body>
                  ) : null}
                </Flex>

                <Flex style={styles.actions}>
                  <Button
                    disabled={busy}
                    onPress={() => onConfirm(data)}
                    prominence="high"
                  >
                    Confirm match
                  </Button>
                  <Button
                    disabled={busy}
                    onPress={() => onReject(data)}
                    prominence="low"
                  >
                    Reject
                  </Button>
                </Flex>
              </Flex>
            </Card>
          )}
        </Flex>
      </Page.Root>
    </HeaderLayout.Page>
  );
}
