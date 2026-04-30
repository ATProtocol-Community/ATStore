import * as stylex from "@stylexjs/stylex";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { ExternalLink } from "lucide-react";
import { useState } from "react";
import { Link as AriaLink } from "react-aria-components";

import { formatAppTagLabel } from "#/lib/app-tag-metadata";
import { RestrictedMarkdownContent } from "../components/restricted-markdown-content";
import { Badge } from "../design-system/badge";
import { Button } from "../design-system/button";
import {
  Card,
  CardBody,
  CardHeader,
  CardImage,
  CardTitle,
} from "../design-system/card";
import { Flex } from "../design-system/flex";
import { Page } from "../design-system/page";
import { shadow } from "../design-system/theme/shadow.stylex";
import {
  gap,
  horizontalSpace,
  verticalSpace,
} from "../design-system/theme/semantic-spacing.stylex";
import {
  Body,
  Heading1,
  ListItem,
  SmallBody,
  UnorderedList,
} from "../design-system/typography";
import { Text } from "../design-system/typography/text";
import { TextArea } from "../design-system/text-area";
import { adminApi } from "../integrations/tanstack-query/api-admin.functions";

export const Route = createFileRoute(
  "/_header-layout/_admin-layout/admin/unverified-listings",
)({
  component: UnverifiedListingsPage,
});

const styles = stylex.create({
  page: {
    paddingBottom: verticalSpace["10xl"],
    paddingTop: verticalSpace["6xl"],
  },
  section: {
    maxWidth: "60rem",
  },
  card: {
    boxShadow: shadow.sm,
    width: "100%",
  },
  cardBody: {
    gap: gap["2xl"],
  },
  preview: {
    gap: gap.xl,
  },
  previewIcon: {
    borderRadius: "12px",
    flexShrink: 0,
    height: "64px",
    objectFit: "cover",
    width: "64px",
  },
  productLink: {
    alignItems: "center",
    display: "inline-flex",
    gap: gap.sm,
    paddingLeft: horizontalSpace.xs,
    textDecoration: "none",
  },
  listStack: {
    gap: gap.xl,
  },
  appTagsRow: {
    flexWrap: "wrap",
    gap: gap.sm,
  },
  screenshotsScroller: {
    display: "flex",
    flexDirection: "row",
    gap: gap.md,
    overflowX: "auto",
    paddingBottom: verticalSpace.xs,
  },
  screenshotImage: {
    borderRadius: "8px",
    flexShrink: 0,
    height: "auto",
    maxHeight: "240px",
    objectFit: "contain",
    width: "auto",
  },
  rejectNotes: {
    maxWidth: "100%",
    width: "100%",
  },
  criteriaList: {
    marginBlock: 0,
    paddingInlineStart: horizontalSpace["2xl"],
  },
});

function UnverifiedListingsPage() {
  const queryClient = useQueryClient();
  const { data } = useSuspenseQuery(adminApi.getAdminDashboardQueryOptions);
  const [busy, setBusy] = useState<string | null>(null);
  const [rejectDraft, setRejectDraft] = useState<Record<string, string>>({});

  async function refresh() {
    await queryClient.invalidateQueries({ queryKey: ["admin"] });
  }

  return (
    <Page.Root variant="large" style={styles.page}>
      <Flex direction="column" gap="6xl" style={styles.section}>
        <Heading1>Unverified listings</Heading1>
        <SmallBody>
          Review and moderate unverified listings. Approve to verify, or reject
          to remove them from discovery.
        </SmallBody>

        <Card>
          <CardHeader>
            <CardTitle>Acceptance criteria</CardTitle>
          </CardHeader>
          <CardBody>
            <UnorderedList style={styles.criteriaList}>
              <ListItem>
                <Text size="sm" variant="secondary">
                  Open the product link and confirm it works and matches the
                  listing.
                </Text>
              </ListItem>
              <ListItem>
                <Text size="sm" variant="secondary">
                  Check the Bluesky product account handle — it should clearly
                  belong to this product (official or dedicated), not an
                  unrelated personal account.
                </Text>
              </ListItem>
              <ListItem>
                <Text size="sm" variant="secondary">
                  Category and tags should accurately describe the tool. If they
                  are misleading or plainly miss better-fitting tags, reject or
                  send back for fixes. A quick sanity check is enough — no need
                  for a full tagging audit or long notes.
                </Text>
              </ListItem>
              <ListItem>
                <Text size="sm" variant="secondary">
                  No prerelease-only listings: if a user cannot sign in and use
                  the product <Text weight="bold">today</Text>, do not verify.
                  If sign-in works and real product use is available, it&apos;s
                  acceptable even if the product still calls itself beta.
                </Text>
              </ListItem>
              <ListItem>
                <Text size="sm" variant="secondary">
                  In general we only accept{" "}
                  <Text weight="bold">user-facing tools</Text> that people can
                  log into — not libraries, raw APIs, or other non-app surfaces
                  unless that is genuinely what the listing is.
                </Text>
              </ListItem>
              <ListItem>
                <Text size="sm" variant="secondary">
                  Hero image should follow the same guidelines as the listing
                  form: wide 16:9 (e.g. at least 1600×900), product name (and
                  tagline if present) readable, subject centered for the blurred
                  backdrop crop, no browser chrome / device mockups / watermarks
                  / tiny UI text.
                </Text>
              </ListItem>
            </UnorderedList>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Queue ({data.unverified.length})</CardTitle>
          </CardHeader>
          <CardBody>
            {data.unverified.length === 0 ? (
              <Body>None.</Body>
            ) : (
              <Flex direction="column" style={styles.listStack}>
                {data.unverified.map((row) => (
                  <Card key={row.id} style={styles.card} size="lg">
                    {row.heroImageUrl ? (
                      <CardImage
                        aspectRatio={16 / 9}
                        src={row.heroImageUrl}
                        alt=""
                      />
                    ) : null}
                    <CardBody>
                      <Flex direction="column" style={styles.cardBody}>
                        <Flex direction="column" style={styles.preview}>
                          <Flex gap="xl" align="start">
                            {row.iconUrl ? (
                              <img
                                src={row.iconUrl}
                                alt=""
                                {...stylex.props(styles.previewIcon)}
                              />
                            ) : null}
                            <Flex direction="column" gap="xl">
                              <Text size="2xl" weight="bold">
                                {row.name}
                              </Text>
                              {row.tagline ? (
                                <Text size="base" variant="secondary">
                                  {row.tagline}
                                </Text>
                              ) : null}
                              <Text size="sm" weight="bold">
                                {row.categorySlugs?.[0]
                                  ? `${row.categorySlugs[0]}`
                                  : ""}
                              </Text>
                              <Flex wrap gap="xl">
                                {row.externalUrl ? (
                                  <AriaLink
                                    href={row.externalUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    {...stylex.props(styles.productLink)}
                                  >
                                    <Text size="sm" variant="secondary">
                                      View product
                                    </Text>
                                    <ExternalLink size={14} />
                                  </AriaLink>
                                ) : null}
                                {row.productAccountHandle ? (
                                  <AriaLink
                                    href={`https://bsky.app/profile/${row.productAccountHandle}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    {...stylex.props(styles.productLink)}
                                  >
                                    <Text size="sm" variant="secondary">
                                      @{row.productAccountHandle}
                                    </Text>
                                    <ExternalLink size={14} />
                                  </AriaLink>
                                ) : null}
                              </Flex>
                            </Flex>
                          </Flex>
                          {row.fullDescription ? (
                            <RestrictedMarkdownContent
                              compact
                              content={row.fullDescription}
                              paragraphVariant="secondary"
                            />
                          ) : null}
                          {row.appTags && row.appTags.length > 0 ? (
                            <Flex style={styles.appTagsRow}>
                              {row.appTags.map((tag) => (
                                <Badge key={tag} size="sm">
                                  {formatAppTagLabel(tag)}
                                </Badge>
                              ))}
                            </Flex>
                          ) : null}
                          {row.screenshotUrls &&
                          row.screenshotUrls.length > 0 ? (
                            <div {...stylex.props(styles.screenshotsScroller)}>
                              {row.screenshotUrls.map((url) => (
                                <img
                                  key={url}
                                  src={url}
                                  alt=""
                                  {...stylex.props(styles.screenshotImage)}
                                />
                              ))}
                            </div>
                          ) : null}
                        </Flex>
                        <Flex
                          direction="column"
                          gap="sm"
                          style={styles.rejectNotes}
                        >
                          <TextArea
                            label="Rejection reason"
                            placeholder="Explain why — required to reject."
                            rows={3}
                            value={rejectDraft[row.id] ?? ""}
                            onChange={(value) =>
                              setRejectDraft((prev) => ({
                                ...prev,
                                [row.id]: value,
                              }))
                            }
                          />
                        </Flex>
                        <Flex gap="md">
                          <Button
                            isDisabled={busy === row.id}
                            onPress={async () => {
                              setBusy(row.id);
                              try {
                                await adminApi.setListingVerification({
                                  data: {
                                    listingId: row.id,
                                    status: "verified",
                                  },
                                });
                                await refresh();
                              } finally {
                                setBusy(null);
                              }
                            }}
                          >
                            Verify
                          </Button>
                          <Button
                            variant="secondary"
                            isDisabled={
                              busy === row.id ||
                              (rejectDraft[row.id]?.trim() ?? "").length === 0
                            }
                            onPress={async () => {
                              setBusy(row.id);
                              try {
                                const notes = rejectDraft[row.id]?.trim();
                                await adminApi.setListingVerification({
                                  data: {
                                    listingId: row.id,
                                    status: "rejected",
                                    notes,
                                  },
                                });
                                await refresh();
                                setRejectDraft((prev) => {
                                  const next = { ...prev };
                                  delete next[row.id];
                                  return next;
                                });
                              } finally {
                                setBusy(null);
                              }
                            }}
                          >
                            Reject
                          </Button>
                        </Flex>
                      </Flex>
                    </CardBody>
                  </Card>
                ))}
              </Flex>
            )}
          </CardBody>
        </Card>
      </Flex>
    </Page.Root>
  );
}
