import type { ReactNode } from "react";

import * as stylex from "@stylexjs/stylex";
import { createFileRoute } from "@tanstack/react-router";
import { ATSTORE_XRPC_METHOD, NSID } from "#/lib/atproto/nsids";
import { buildRouteOgMeta } from "#/lib/og-meta";
import { ShieldCheck } from "lucide-react";
import { useSyncExternalStore } from "react";

import searchListingsLexicon from "../../lexicons/fyi/atstore/directory/searchListings.json";
import { CodeBlock, Eyebrow, Mono } from "../components/shelf/info/InfoBlocks";
import { PageHero } from "../components/shelf/Section";
import { animationDuration } from "../design-system/theme/animations.stylex";
import { uiColor } from "../design-system/theme/color.stylex";
import { breakpoints } from "../design-system/theme/media-queries.stylex";
import {
  fontFamily,
  fontWeight,
} from "../design-system/theme/typography.stylex";

/** Production origin, used for SSR so the first paint matches hydration. */
const DEFAULT_ORIGIN = "https://atstore.fyi";

const METHOD_ROWS: ReadonlyArray<{
  nsid: string;
  method: "GET";
  summary: ReactNode;
}> = [
  {
    nsid: ATSTORE_XRPC_METHOD.serverDescribe,
    method: "GET",
    summary: "Capabilities, limits, and registered method NSIDs.",
  },
  {
    nsid: ATSTORE_XRPC_METHOD.directorySearchListings,
    method: "GET",
    summary: (
      <>
        Search and filter public listings, with the same filters as /apps (
        <DocLink href="#search-listings">parameters below</DocLink>).
      </>
    ),
  },
  {
    nsid: ATSTORE_XRPC_METHOD.directoryGetListing,
    method: "GET",
    summary: (
      <>
        Listing detail: exactly one of <Mono>uri</Mono> (listing.detail AT URI)
        or <Mono>externalUrl</Mono> (unique storefront URL).
      </>
    ),
  },
  {
    nsid: ATSTORE_XRPC_METHOD.directoryGetListingAuth,
    method: "GET",
    summary:
      "How a listing's app signs in (`uri` listing.detail AT URI): `authMethod`, its OAuth `clientMetadataUrl` (client_id) when known, and the last probed `scope`.",
  },
  {
    nsid: ATSTORE_XRPC_METHOD.reviewsListForListing,
    method: "GET",
    summary: (
      <>
        Reviews for a listing (<Mono>uri</Mono> listing.detail AT URI,
        paginated); mirrored Tap index.
      </>
    ),
  },
];

type LexiconParam = {
  type: "string" | "integer" | "array";
  description?: string;
  default?: string | number;
  enum?: Array<string>;
  knownValues?: Array<string>;
  minimum?: number;
  maximum?: number;
  items?: { type: string; knownValues?: Array<string> };
};

/** Lexicon params without a description of their own. */
const PARAM_FALLBACK_DESCRIPTIONS: Record<string, string> = {
  q: "Free-text search over names, taglines and descriptions.",
  limit: "Page size.",
  cursor: "Opaque cursor from the previous page's response.",
};

const SEARCH_PARAMS = Object.entries(
  searchListingsLexicon.defs.main.parameters.properties as Record<
    string,
    LexiconParam
  >,
).map(([name, param]) => {
  const type =
    param.type === "array" ? `${param.items?.type ?? "string"}[]` : param.type;
  const values =
    param.enum ?? param.knownValues ?? param.items?.knownValues ?? [];
  const range =
    param.minimum != null && param.maximum != null
      ? `${param.minimum}–${param.maximum}`
      : null;
  return {
    name,
    type,
    values,
    range,
    defaultValue: param.default,
    description: param.description ?? PARAM_FALLBACK_DESCRIPTIONS[name] ?? "",
  };
});

const TOC = [
  { id: "base-url", label: "Base URL" },
  { id: "methods", label: "Methods" },
  { id: "search-listings", label: "searchListings" },
  { id: "listing-reviews", label: "Writing reviews" },
] as const;

const SAMPLE_RESPONSE = JSON.stringify(
  {
    listings: [
      {
        uri: `at://did:plc:…/${NSID.listingDetail}/…`,
        name: "Mu",
        tagline: "Proper Cringe™",
        rating: "4.8",
        reviewCount: 37,
        appTags: ["news", "social"],
        productAccountHandle: "mu.social",
        listingType: "app",
      },
    ],
    cursor: "…",
  },
  null,
  2,
);

const SAMPLE_REVIEW = JSON.stringify(
  {
    $type: NSID.listingReview,
    subject: `at://…/${NSID.listingDetail}/…`,
    rating: 4,
    createdAt: "2026-05-04T12:00:00.000Z",
    text: "Optional prose. Omit for a stars-only review.",
  },
  null,
  2,
);

const styles = stylex.create({
  layout: {
    columnGap: 56,
    display: "grid",
    fontFamily: fontFamily.sans,
    gridTemplateColumns: {
      default: "minmax(0, 1fr)",
      [breakpoints.lg]: "200px minmax(0, 1fr)",
    },
  },
  toc: {
    alignSelf: "start",
    display: { default: "none", [breakpoints.lg]: "flex" },
    flexDirection: "column",
    fontSize: 14,
    position: "sticky",
    rowGap: 10,
    paddingTop: 56,
    top: 96,
  },
  tocEyebrow: {
    marginBottom: 2,
  },
  tocLink: {
    textDecoration: "none",
    color: { default: uiColor.text1, ":hover": uiColor.text2 },
    transitionDuration: animationDuration.default,
    transitionProperty: "color",
  },
  doc: {
    maxWidth: 760,
    minWidth: 0,
    paddingBottom: 24,
  },
  h2: {
    color: uiColor.text2,
    fontFamily: fontFamily.title,
    fontSize: 24,
    fontWeight: fontWeight.bold,
    letterSpacing: "-0.017em",
    lineHeight: 1.2,
    marginBottom: 14,
    marginTop: 40,
    scrollMarginTop: 96,
  },
  h2First: {
    marginTop: 8,
  },
  p: {
    color: uiColor.text1,
    lineHeight: 1.65,
    marginBottom: 16,
    marginTop: 0,
  },
  tableWrap: {
    marginBottom: 16,
    overflowX: "auto",
  },
  table: {
    borderCollapse: "collapse",
    fontSize: 14,
    width: "100%",
  },
  th: {
    paddingBlock: 10,
    color: uiColor.text1,
    fontSize: 12,
    fontWeight: fontWeight.semibold,
    textAlign: "left",
    whiteSpace: "nowrap",
    borderBottomColor: uiColor.border2,
    borderBottomStyle: "solid",
    borderBottomWidth: 1,
    paddingLeft: 0,
    paddingRight: 12,
  },
  td: {
    paddingBlock: 12,
    color: uiColor.text2,
    lineHeight: 1.5,
    verticalAlign: "top",
    borderBottomColor: uiColor.border1,
    borderBottomStyle: "solid",
    borderBottomWidth: 1,
    paddingLeft: 0,
    paddingRight: 12,
  },
  stackHead: {
    display: { default: "none", [breakpoints.md]: "table-header-group" },
  },
  stackRow: {
    paddingBlock: { default: 12, [breakpoints.md]: 0 },
    display: { default: "block", [breakpoints.md]: "table-row" },
    borderBottomColor: uiColor.border1,
    borderBottomStyle: { default: "solid", [breakpoints.md]: "none" },
    borderBottomWidth: 1,
  },
  stackCell: {
    paddingBlock: { default: 0, [breakpoints.md]: 12 },
    display: { default: "block", [breakpoints.md]: "table-cell" },
    borderBottomStyle: { default: "none", [breakpoints.md]: "solid" },
  },
  stackFirst: {
    whiteSpace: { default: "normal", [breakpoints.md]: "nowrap" },
    wordBreak: "break-word",
    marginBottom: { default: 6, [breakpoints.md]: 0 },
  },
  tdMono: {
    fontFamily: fontFamily.mono,
    fontSize: 13,
    whiteSpace: "nowrap",
  },
  tdDim: {
    color: uiColor.text1,
  },
  nsidCell: {
    alignItems: "baseline",
    columnGap: 8,
    display: "flex",
  },
  verb: {
    borderRadius: 5,
    paddingBlock: 4,
    paddingInline: 6,
    backgroundColor:
      "light-dark(rgba(26, 127, 55, 0.12), rgba(63, 185, 80, 0.16))",
    color: "light-dark(#1a7f37, #3fb950)",
    flexShrink: 0,
    fontFamily: fontFamily.mono,
    fontSize: 10,
    fontWeight: fontWeight.semibold,
    lineHeight: 1,
  },
  values: {
    color: uiColor.text1,
    fontFamily: fontFamily.mono,
    fontSize: 12.5,
    marginTop: 4,
  },
  callout: {
    padding: 22,
    borderColor: uiColor.border1,
    borderRadius: 18,
    borderStyle: "solid",
    borderWidth: 1,
    alignItems: "center",
    backgroundColor: uiColor.bg,
    columnGap: 16,
    display: "flex",
  },
  calloutIcon: {
    color: "light-dark(#1c4ef5, #7b97ff)",
    flexShrink: 0,
  },
  calloutTitle: {
    color: uiColor.text2,
    fontWeight: fontWeight.semibold,
  },
  calloutBody: {
    color: uiColor.text1,
    fontSize: 14,
    lineHeight: 1.55,
    marginBottom: 0,
    marginTop: 4,
  },
  link: {
    textDecoration: "underline",
    color: uiColor.text2,
    textDecorationColor: {
      default: uiColor.border2,
      ":hover": "currentColor",
    },
    textUnderlineOffset: 3,
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

function DocLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} {...stylex.props(styles.link)}>
      {children}
    </a>
  );
}

const subscribeNoop = () => () => {};

/** The page's own origin on the client; the production origin during SSR. */
function useOrigin() {
  return useSyncExternalStore(
    subscribeNoop,
    () => globalThis.location.origin,
    () => DEFAULT_ORIGIN,
  );
}

function DevelopersAtprotoPage() {
  const origin = useOrigin();
  const searchUrl = `${origin}/xrpc/${ATSTORE_XRPC_METHOD.directorySearchListings}?tag=social&data=app.bsky&limit=1`;

  return (
    <div {...stylex.props(styles.layout)}>
      <nav aria-label="On this page" {...stylex.props(styles.toc)}>
        <Eyebrow style={styles.tocEyebrow}>On this page</Eyebrow>
        {TOC.map((item) => (
          <a
            key={item.id}
            href={`#${item.id}`}
            {...stylex.props(styles.tocLink)}
          >
            {item.label}
          </a>
        ))}
      </nav>

      <div {...stylex.props(styles.doc)}>
        <PageHero
          eyebrow="Developer API"
          title="at-store on the AT Protocol"
          description={
            <>
              Public GET endpoints under <Mono>/xrpc/&lt;nsid&gt;</Mono>.
              Lexicons live in <Mono>lexicons/fyi/atstore/</Mono>.
            </>
          }
        />

        <h2 id="base-url" {...stylex.props(styles.h2, styles.h2First)}>
          Base URL
        </h2>
        <CodeBlock label="Base URL">{`${origin}/xrpc/`}</CodeBlock>

        <h2 id="methods" {...stylex.props(styles.h2)}>
          Methods
        </h2>
        <div {...stylex.props(styles.tableWrap)}>
          <table
            aria-label="AT Store XRPC methods"
            {...stylex.props(styles.table)}
          >
            <thead {...stylex.props(styles.stackHead)}>
              <tr>
                <th scope="col" {...stylex.props(styles.th)}>
                  NSID
                </th>
                <th scope="col" {...stylex.props(styles.th)}>
                  Summary
                </th>
              </tr>
            </thead>
            <tbody>
              {METHOD_ROWS.map((row) => (
                <tr key={row.nsid} {...stylex.props(styles.stackRow)}>
                  <td
                    {...stylex.props(
                      styles.td,
                      styles.tdMono,
                      styles.stackCell,
                      styles.stackFirst,
                    )}
                  >
                    <span {...stylex.props(styles.nsidCell)}>
                      <span {...stylex.props(styles.verb)}>{row.method}</span>
                      {row.nsid}
                    </span>
                  </td>
                  <td {...stylex.props(styles.td, styles.stackCell)}>
                    {row.summary}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <h2 id="search-listings" {...stylex.props(styles.h2)}>
          searchListings
        </h2>
        <p {...stylex.props(styles.p)}>
          {searchListingsLexicon.defs.main.description}
        </p>
        <div {...stylex.props(styles.tableWrap)}>
          <table
            aria-label="searchListings parameters"
            {...stylex.props(styles.table)}
          >
            <thead>
              <tr>
                <th scope="col" {...stylex.props(styles.th)}>
                  Param
                </th>
                <th scope="col" {...stylex.props(styles.th)}>
                  Type
                </th>
                <th scope="col" {...stylex.props(styles.th)}>
                  Values
                </th>
              </tr>
            </thead>
            <tbody>
              {SEARCH_PARAMS.map((param) => (
                <tr key={param.name}>
                  <td {...stylex.props(styles.td, styles.tdMono)}>
                    {param.name}
                  </td>
                  <td {...stylex.props(styles.td, styles.tdMono, styles.tdDim)}>
                    {param.type}
                  </td>
                  <td {...stylex.props(styles.td)}>
                    {param.description}
                    {param.values.length > 0 ||
                    param.range != null ||
                    param.defaultValue != null ? (
                      <div {...stylex.props(styles.values)}>
                        {[
                          param.values.length > 0
                            ? param.values.join(" · ")
                            : null,
                          param.range,
                          param.defaultValue == null
                            ? null
                            : `default ${param.defaultValue}`,
                        ]
                          .filter(Boolean)
                          .join("  ·  ")}
                      </div>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <CodeBlock
          label="Example searchListings request"
          comment="Social apps that work with Bluesky data"
        >
          {`curl "${searchUrl}"`}
        </CodeBlock>
        <CodeBlock label="Example searchListings response">
          {SAMPLE_RESPONSE}
        </CodeBlock>

        <h2 id="listing-reviews" {...stylex.props(styles.h2)}>
          Writing reviews
        </h2>
        <p {...stylex.props(styles.p)}>
          Reviews are records written with{" "}
          <Mono>com.atproto.repo.createRecord</Mono> on the author&apos;s PDS (
          <DocLink href="https://atproto.com/specs/repository">
            repository
          </DocLink>
          ). Look the listing up with{" "}
          <Mono>{ATSTORE_XRPC_METHOD.directoryGetListing}</Mono> using{" "}
          <Mono>uri</Mono> (the listing.detail AT URI) or{" "}
          <Mono>externalUrl</Mono> (unique storefront URL); don&apos;t pass
          both. Use the response&apos;s <Mono>listing.uri</Mono> as the{" "}
          <Mono>subject</Mono> of a new <Mono>{NSID.listingReview}</Mono>{" "}
          record.
        </p>
        <p {...stylex.props(styles.p)}>
          The author&apos;s repo must include <Mono>{NSID.profile}</Mono> at
          record key <Mono>self</Mono>. Directory ingestion doesn&apos;t pick up{" "}
          <Mono>{NSID.listingReview}</Mono> records until that profile exists.
          Omit <Mono>text</Mono> for a stars-only review.
        </p>
        <CodeBlock label="Example review record">{SAMPLE_REVIEW}</CodeBlock>

        <aside {...stylex.props(styles.callout)}>
          <ShieldCheck
            size={20}
            aria-hidden
            {...stylex.props(styles.calloutIcon)}
          />
          <div>
            <div {...stylex.props(styles.calloutTitle)}>Permission set</div>
            <p {...stylex.props(styles.calloutBody)}>
              <Mono>{NSID.authThirdPartyReviews}</Mono> bundles{" "}
              <Mono>repo:create</Mono> on <Mono>{NSID.profile}</Mono> and{" "}
              <Mono>{NSID.listingReview}</Mono>: the repo permissions a
              third-party app needs to write profiles and reviews (
              <DocLink href="https://atproto.com/specs/permission">
                permissions
              </DocLink>
              ).
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
