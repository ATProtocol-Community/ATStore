import * as stylex from "@stylexjs/stylex";
import { createFileRoute } from "@tanstack/react-router";
import { Flex } from "#/design-system/flex";
import { Link } from "#/design-system/link";
import { Page } from "#/design-system/page";
import {
  Table,
  TableBody,
  TableCell,
  TableColumn,
  TableHeader,
  TableRow,
} from "#/design-system/table";
import {
  horizontalSpace,
  verticalSpace,
} from "#/design-system/theme/semantic-spacing.stylex";
import {
  Blockquote,
  Body,
  Heading2,
  Heading3,
  InlineCode,
  Pre,
} from "#/design-system/typography";
import { Text } from "#/design-system/typography/text";
import { ATSTORE_XRPC_METHOD, NSID } from "#/lib/atproto/nsids";
import { buildRouteOgMeta } from "#/lib/og-meta";
import { ResizableTableContainer } from "react-aria-components";

const METHOD_ROWS: ReadonlyArray<{
  nsid: string;
  method: "GET";
  summary: string;
}> = [
  {
    nsid: ATSTORE_XRPC_METHOD.serverDescribe,
    method: "GET",
    summary: "Capabilities, limits, and registered method NSIDs.",
  },
  {
    nsid: ATSTORE_XRPC_METHOD.directorySearchListings,
    method: "GET",
    summary: "Search public listings with pagination (`q`, `sort`, `cursor`).",
  },
  {
    nsid: ATSTORE_XRPC_METHOD.directoryGetListing,
    method: "GET",
    summary:
      "Listing detail: exactly one of `uri` (listing.detail AT URI) or `externalUrl` (unique storefront URL).",
  },
  {
    nsid: ATSTORE_XRPC_METHOD.reviewsListForListing,
    method: "GET",
    summary:
      "Reviews for a listing (`uri` listing.detail AT URI, pagination); mirrored Tap index.",
  },
];

type MethodTableColumn = {
  id: "method" | "nsid" | "summary";
  name: string;
};

const METHOD_TABLE_COLUMNS: Array<MethodTableColumn> = [
  { id: "method", name: "HTTP" },
  { id: "nsid", name: "NSID" },
  { id: "summary", name: "Summary" },
];

const styles = stylex.create({
  page: {
    marginInline: "auto",
    paddingInline: horizontalSpace.xl,
    maxWidth: 920,
    paddingBottom: verticalSpace["10xl"],
    paddingTop: verticalSpace["6xl"],
  },
  monoTight: {
    fontFamily:
      "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
    fontSize: 13,
    lineHeight: 1.4,
    wordBreak: "break-word",
  },
  tableWrapper: {
    overflow: "auto",
  },
  methodsTable: {
    width: "100% !important",
  },
  pre: {
    marginBottom: 0,
    marginTop: 0,
  },
});

export const Route = createFileRoute("/_header-layout/developers/atproto")({
  head: () =>
    buildRouteOgMeta({
      title: "AT Protocol API | at-store",
      description:
        "Public AT Store directory XRPC endpoints and listing-review integration.",
    }),
  component: DevelopersAtprotoPage,
});

function DevelopersAtprotoPage() {
  const origin =
    typeof globalThis.location?.origin === "string"
      ? globalThis.location.origin
      : "https://your-deployment.example";

  return (
    <Page.Root variant="large" style={styles.page}>
      <Flex direction="column" gap="7xl">
        <Flex direction="column" gap="6xl">
          <Heading2>AT Protocol on ATStore</Heading2>
          <Body variant="secondary">
            Public GET endpoints under{" "}
            <Text weight="medium">/xrpc/&lt;nsid&gt;</Text>. Lexicons:{" "}
            <Text weight="medium">lexicons/fyi/atstore/</Text>.
          </Body>
        </Flex>

        <Flex direction="column" gap="4xl">
          <Heading3>Base URL</Heading3>
          <Body variant="secondary">
            Replace the origin with your deployment (local dev shown when opened
            in the browser):
          </Body>
          <Blockquote>{`${origin}/xrpc/`}</Blockquote>
        </Flex>

        <Flex direction="column" gap="4xl">
          <Heading3>Methods</Heading3>
          <ResizableTableContainer {...stylex.props(styles.tableWrapper)}>
            <Table
              aria-label="AT Store XRPC methods"
              style={styles.methodsTable}
            >
              <TableHeader columns={METHOD_TABLE_COLUMNS}>
                {(column) => (
                  <TableColumn
                    width={
                      column.id === "nsid"
                        ? 320
                        : column.id === "method"
                          ? 32
                          : 400
                    }
                  >
                    {column.name}
                  </TableColumn>
                )}
              </TableHeader>
              <TableBody items={[...METHOD_ROWS]}>
                {(row) => (
                  <TableRow
                    columns={METHOD_TABLE_COLUMNS}
                    id={row.nsid}
                    textValue={`${row.method} ${row.nsid} ${row.summary}`}
                  >
                    {(column) => (
                      <TableCell>
                        {column.id === "method" ? (
                          <Text weight="medium">{row.method}</Text>
                        ) : column.id === "nsid" ? (
                          <span {...stylex.props(styles.monoTight)}>
                            {row.nsid}
                          </span>
                        ) : (
                          <Body>{row.summary}</Body>
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </ResizableTableContainer>
        </Flex>

        <Flex direction="column" gap="5xl">
          <Heading3>Listing reviews</Heading3>
          <Body variant="secondary">
            Reviews are written with{" "}
            <Text weight="medium">com.atproto.repo.createRecord</Text> on the
            author&apos;s PDS (
            <Link href="https://atproto.com/specs/repository">repository</Link>
            ). Use{" "}
            <span {...stylex.props(styles.monoTight)}>
              {ATSTORE_XRPC_METHOD.directoryGetListing}
            </span>{" "}
            with query param <Text weight="medium">uri</Text> (the
            listing.detail AT URI) or <Text weight="medium">externalUrl</Text>{" "}
            (unique storefront URL); do not pass both. The JSON includes{" "}
            <Text weight="medium">listing.uri</Text>. Use that value as{" "}
            <Text weight="medium">subject</Text> on a new{" "}
            <span {...stylex.props(styles.monoTight)}>
              {NSID.listingReview}
            </span>{" "}
            record.
          </Body>
          <Body variant="secondary">
            The author&apos;s repo must include{" "}
            <span {...stylex.props(styles.monoTight)}>{NSID.profile}</span> at
            record key <Text weight="medium">self</Text>
            —directory ingestion does not pick up{" "}
            <span {...stylex.props(styles.monoTight)}>
              {NSID.listingReview}
            </span>{" "}
            records until that profile exists.
          </Body>
          <Body variant="secondary">
            Example <Text weight="medium">record</Text> (omit{" "}
            <Text weight="medium">text</Text> for stars-only):
          </Body>
          <Pre style={styles.pre}>
            <InlineCode>
              {`{
  "$type": "${NSID.listingReview}",
  "subject": "at://…/${NSID.listingDetail}/…",
  "rating": 4,
  "createdAt": "2026-05-04T12:00:00.000Z",
  "text": "Optional prose."
}`}
            </InlineCode>
          </Pre>
          <Blockquote>
            <Text leading="base">
              Permission-set{" "}
              <span {...stylex.props(styles.monoTight)}>
                {NSID.authThirdPartyReviews}
              </span>{" "}
              bundles <Text weight="medium">repo:create</Text> on{" "}
              <span {...stylex.props(styles.monoTight)}>{NSID.profile}</span>{" "}
              and{" "}
              <span {...stylex.props(styles.monoTight)}>
                {NSID.listingReview}
              </span>{" "}
              (
              <Link href="https://atproto.com/specs/permission">
                permissions
              </Link>
              ).
            </Text>
          </Blockquote>
        </Flex>

        <Flex direction="column" gap="6xl">
          <Flex direction="column" gap="4xl">
            <Heading2>Login to the atmosphere</Heading2>
            <Body variant="secondary">
              A convention for letting a user who is logged in on one atmosphere
              app get a fast, one-tap sign-in when they follow a link to
              another. It is a <Text weight="medium">hint</Text>, not
              authentication: a DID is public, so passing one only tells the
              destination who to offer login to—the destination must still run
              its own ATProto{" "}
              <Link href="https://atproto.com/specs/oauth">OAuth</Link>.
            </Body>
          </Flex>

          <Flex direction="column" gap="4xl">
            <Heading3>referrer_did convention</Heading3>
            <Body variant="secondary">
              When your app links out to another atmosphere app and the current
              viewer is logged in, append the viewer&apos;s DID as{" "}
              <InlineCode>referrer_did</InlineCode>:
            </Body>
            <Blockquote>
              <span {...stylex.props(styles.monoTight)}>
                https://other-app.example/path?referrer_did=did:plc:abc123
              </span>
            </Blockquote>
            <Body variant="secondary">
              <Text weight="medium">Consuming it:</Text> on load, read{" "}
              <InlineCode>referrer_did</InlineCode> from the URL. If it is a
              valid DID and the user is not signed in, offer &quot;Continue as
              @handle&quot; that starts OAuth with the DID as the login hint
              (resolve DID → PDS → authorize). ATStore does this at{" "}
              <InlineCode>/login?referrer_did=…</InlineCode>.
            </Body>
            <Blockquote>
              <Text leading="base">
                Privacy: this discloses the viewer&apos;s DID to the
                destination. Only send it to atmosphere destinations you intend
                to hand off to (not, for example, a privacy-policy or
                source-code link).
              </Text>
            </Blockquote>
          </Flex>
        </Flex>
      </Flex>
    </Page.Root>
  );
}
