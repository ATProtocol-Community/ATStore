import * as stylex from "@stylexjs/stylex";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, createLink } from "@tanstack/react-router";
import { ExternalLink } from "lucide-react";

import { Badge } from "../design-system/badge";
import { Card, CardBody, CardHeader, CardTitle } from "../design-system/card";
import { Flex } from "../design-system/flex";
import { Link } from "../design-system/link";
import { Page } from "../design-system/page";
import { uiColor } from "../design-system/theme/color.stylex";
import {
  gap,
  horizontalSpace,
  verticalSpace,
} from "../design-system/theme/semantic-spacing.stylex";
import { shadow } from "../design-system/theme/shadow.stylex";
import { Body, Heading1, SmallBody } from "../design-system/typography";
import { adminApi } from "../integrations/tanstack-query/api-admin.functions";

export const Route = createFileRoute(
  "/_header-layout/_admin-layout/admin/oauth-url-gaps",
)({
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData(
      adminApi.getAdminOAuthUrlGapsQueryOptions,
    );
  },
  component: AdminOAuthUrlGapsPage,
});

const ProductLink = createLink(Link);

const styles = stylex.create({
  page: {
    paddingBottom: verticalSpace["10xl"],
    paddingTop: verticalSpace["6xl"],
  },
  content: {
    gap: gap["4xl"],
    maxWidth: "min(1100px, 100%)",
    width: "100%",
  },
  header: {
    gap: gap.lg,
    maxWidth: "48rem",
  },
  card: {
    boxShadow: shadow.sm,
    width: "100%",
  },
  tableWrap: {
    overflowX: "auto",
    width: "100%",
  },
  table: {
    borderCollapse: "collapse",
    fontSize: "0.875rem",
    width: "100%",
  },
  th: {
    textAlign: "left" as const,
    whiteSpace: "nowrap" as const,
    borderBottomColor: uiColor.border2,
    borderBottomStyle: "solid",
    borderBottomWidth: 1,
    paddingBottom: verticalSpace.sm,
    paddingRight: horizontalSpace.md,
    paddingTop: verticalSpace.sm,
  },
  td: {
    verticalAlign: "top" as const,
    borderBottomColor: uiColor.border2,
    borderBottomStyle: "solid",
    borderBottomWidth: 1,
    paddingBottom: verticalSpace.md,
    paddingRight: horizontalSpace.md,
    paddingTop: verticalSpace.md,
  },
  mono: {
    fontFamily: "ui-monospace, monospace",
    fontSize: "0.8125rem",
    wordBreak: "break-all" as const,
  },
  rowMuted: {
    color: uiColor.text2,
  },
});

type Gaps = Awaited<ReturnType<typeof adminApi.getAdminOAuthUrlGaps>>;

function verificationBadge(status: string) {
  if (status === "verified") {
    return <Badge variant="success">Verified</Badge>;
  }
  if (status === "unverified") {
    return <Badge variant="warning">Unverified</Badge>;
  }
  if (status === "rejected") {
    return <Badge variant="critical">Rejected</Badge>;
  }
  return <Badge>{status}</Badge>;
}

function AdminOAuthUrlGapsPage() {
  const { data } = useSuspenseQuery(adminApi.getAdminOAuthUrlGapsQueryOptions);

  return (
    <Page.Root variant="large" style={styles.page}>
      <Flex direction="column" style={styles.content}>
        <Flex direction="column" style={styles.header}>
          <Heading1>OAuth client metadata gaps</Heading1>
          <Body variant="secondary">
            Listings with an HTTPS storefront that still need a discoverable OAuth
            client-metadata URL, plus listings whose last automated probe threw an
            error. Protocol directory rows and <code>at:</code> links are excluded
            (same rules as the discovery script).
          </Body>
          <SmallBody variant="secondary">
            Populate URLs with{" "}
            <code>pnpm listing:oauth-discover-metadata</code> or sync probes; see{" "}
            <code>store_listing_oauth_discovery</code> and{" "}
            <code>store_listing_oauth_probes</code>.
          </SmallBody>
        </Flex>

        <GapTable
          title="No client-metadata URL yet"
          description="Neither manual discovery nor the last successful probe recorded a client-metadata URL. App-password and mobile-only listings are omitted."
          rows={data.missingClientMetadataUrl}
          kind="missing"
        />

        <GapTable
          title="Probe failures"
          description="Latest `listing:oauth-probes-sync` run ended in status `error` for this listing."
          rows={data.probeErrors}
          kind="errors"
        />
      </Flex>
    </Page.Root>
  );
}

function GapTable({
  title,
  description,
  rows,
  kind,
}: {
  title: string;
  description: string;
  rows: Gaps["missingClientMetadataUrl"] | Gaps["probeErrors"];
  kind: "missing" | "errors";
}) {
  return (
    <Card style={styles.card}>
      <CardHeader>
        <CardTitle>
          {title} ({rows.length})
        </CardTitle>
        <SmallBody variant="secondary">{description}</SmallBody>
      </CardHeader>
      <CardBody>
        {rows.length === 0 ? (
          <Body variant="secondary">None right now.</Body>
        ) : (
          <div {...stylex.props(styles.tableWrap)}>
            <table {...stylex.props(styles.table)}>
              <thead>
                <tr>
                  <th {...stylex.props(styles.th)}>Listing</th>
                  <th {...stylex.props(styles.th)}>Status</th>
                  {kind === "missing" ? (
                    <>
                      <th {...stylex.props(styles.th)}>Discovery</th>
                      <th {...stylex.props(styles.th)}>Probe</th>
                      <th {...stylex.props(styles.th)}>Probed</th>
                    </>
                  ) : (
                    <>
                      <th {...stylex.props(styles.th)}>Error</th>
                      <th {...stylex.props(styles.th)}>Probed URL</th>
                      <th {...stylex.props(styles.th)}>Probed</th>
                    </>
                  )}
                  <th {...stylex.props(styles.th)}>Links</th>
                </tr>
              </thead>
              <tbody>
                {kind === "missing"
                  ? (rows as Gaps["missingClientMetadataUrl"]).map((row) => (
                      <tr key={row.id}>
                        <td {...stylex.props(styles.td)}>
                          <Flex direction="column" gap="sm">
                            <ProductLink
                              to="/products/$productId"
                              params={{ productId: row.slug }}
                            >
                              {row.name}
                            </ProductLink>
                            <span {...stylex.props(styles.mono)}>{row.slug}</span>
                          </Flex>
                        </td>
                        <td {...stylex.props(styles.td)}>
                          {verificationBadge(row.verificationStatus)}
                        </td>
                        <td {...stylex.props(styles.td)}>
                          {row.discoveryResolution ? (
                            <Flex direction="column" gap="xs">
                              <span {...stylex.props(styles.mono)}>
                                {row.discoveryResolution}
                              </span>
                              <span
                                {...stylex.props(styles.rowMuted, styles.mono)}
                              >
                                {row.discoveryAuthMethod}
                              </span>
                            </Flex>
                          ) : (
                            <span {...stylex.props(styles.rowMuted)}>—</span>
                          )}
                        </td>
                        <td {...stylex.props(styles.td)}>
                          <span {...stylex.props(styles.mono)}>
                            {row.probeStatus ?? "—"}
                          </span>
                        </td>
                        <td {...stylex.props(styles.td, styles.rowMuted)}>
                          {row.probedAt
                            ? new Date(row.probedAt).toLocaleString()
                            : "—"}
                        </td>
                        <td {...stylex.props(styles.td)}>
                          {row.externalUrl ? (
                            <a
                              href={row.externalUrl}
                              target="_blank"
                              rel="noreferrer"
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 4,
                              }}
                            >
                              Site <ExternalLink size={14} />
                            </a>
                          ) : (
                            "—"
                          )}
                        </td>
                      </tr>
                    ))
                  : (rows as Gaps["probeErrors"]).map((row) => (
                      <tr key={row.id}>
                        <td {...stylex.props(styles.td)}>
                          <Flex direction="column" gap="sm">
                            <ProductLink
                              to="/products/$productId"
                              params={{ productId: row.slug }}
                            >
                              {row.name}
                            </ProductLink>
                            <span {...stylex.props(styles.mono)}>{row.slug}</span>
                          </Flex>
                        </td>
                        <td {...stylex.props(styles.td)}>
                          {verificationBadge(row.verificationStatus)}
                        </td>
                        <td {...stylex.props(styles.td)}>
                          <span {...stylex.props(styles.mono)}>
                            {row.probeError ?? "(no message)"}
                          </span>
                        </td>
                        <td {...stylex.props(styles.td, styles.mono)}>
                          {row.probedUrl ?? "—"}
                        </td>
                        <td {...stylex.props(styles.td, styles.rowMuted)}>
                          {row.probedAt
                            ? new Date(row.probedAt).toLocaleString()
                            : "—"}
                        </td>
                        <td {...stylex.props(styles.td)}>
                          {row.externalUrl ? (
                            <a
                              href={row.externalUrl}
                              target="_blank"
                              rel="noreferrer"
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 4,
                              }}
                            >
                              Site <ExternalLink size={14} />
                            </a>
                          ) : (
                            "—"
                          )}
                        </td>
                      </tr>
                    ))}
              </tbody>
            </table>
          </div>
        )}
      </CardBody>
    </Card>
  );
}
