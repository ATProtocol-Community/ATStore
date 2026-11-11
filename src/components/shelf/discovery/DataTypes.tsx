import * as stylex from "@stylexjs/stylex";
import { useQuery } from "@tanstack/react-query";
import { Link as RouterLink } from "@tanstack/react-router";
import { ArrowRight, ChevronDown } from "lucide-react";
import { Fragment, useState } from "react";

import type { DirectoryOAuthLexiconClusterSummary } from "../../../lib/oauth-lexicon-hub.types";
import type { DataProducer } from "./data-hub";

import { animationDuration } from "../../../design-system/theme/animations.stylex";
import { uiColor } from "../../../design-system/theme/color.stylex";
import { breakpoints } from "../../../design-system/theme/media-queries.stylex";
import { shadow } from "../../../design-system/theme/shadow.stylex";
import {
  fontFamily,
  fontWeight,
} from "../../../design-system/theme/typography.stylex";
import { directoryListingApi } from "../../../integrations/tanstack-query/api-directory-listings.functions";
import { stringifyLexiconClusterSearchParam } from "../../../lib/oauth-scope-lexicon-keys";
import { IconStack } from "../IconStack";
import { MoreLink } from "../Section";
import {
  DATA_TYPES_PER_SECTION,
  formatAppCount,
  formatDataTypeCount,
  formatDataTypeTitle,
  getDataKeyNsid,
  getDataTypeDescription,
  isOtherDataProducer,
} from "./data-hub";

/** Mono keys listed on a card before "+N more". */
const KEYS_PER_CARD = 4;

const styles = stylex.create({
  section: {
    paddingBlock: { default: 32, [breakpoints.md]: 40 },
    borderTopColor: uiColor.border1,
    borderTopStyle: "solid",
    borderTopWidth: 1,
  },
  head: {
    alignItems: "flex-end",
    columnGap: 20,
    display: "flex",
    flexWrap: { default: "wrap", [breakpoints.md]: "nowrap" },
    rowGap: 12,
    marginBottom: 20,
  },
  headText: {
    flexGrow: 1,
    minWidth: 0,
  },
  eyebrow: {
    color: uiColor.text1,
    fontSize: 12,
    fontWeight: fontWeight.semibold,
    letterSpacing: "0.12em",
    textTransform: "uppercase",
  },
  eyebrowLink: {
    textDecoration: "none",
    color: { default: "inherit", ":hover": uiColor.text2 },
    transitionDuration: animationDuration.default,
    transitionProperty: "color",
  },
  heading: {
    margin: 0,
    color: uiColor.text2,
    fontFamily: fontFamily.mono,
    fontSize: { default: 24, [breakpoints.md]: 30 },
    fontWeight: fontWeight.bold,
    letterSpacing: "-0.03em",
    lineHeight: 1.15,
    overflowWrap: "anywhere",
    marginTop: 8,
  },
  headingLink: {
    textDecoration: "none",
    color: "inherit",
    textDecorationColor: { default: "transparent", ":hover": uiColor.border3 },
    textDecorationLine: "underline",
    textDecorationThickness: 2,
    textUnderlineOffset: 5,
  },
  stack: {
    display: { default: "none", [breakpoints.md]: "inline-flex" },
  },
  grid: {
    columnGap: 12,
    display: "grid",
    gridTemplateColumns: {
      default: "minmax(0, 1fr)",
      [breakpoints.md]: "repeat(2, minmax(0, 1fr))",
      [breakpoints.lg]: "repeat(3, minmax(0, 1fr))",
    },
    rowGap: 12,
  },
  card: {
    padding: 18,
    borderColor: { default: uiColor.border1, ":hover": uiColor.border2 },
    borderRadius: 16,
    borderStyle: "solid",
    borderWidth: 1,
    textDecoration: "none",
    backgroundColor: uiColor.bg,
    boxShadow: { default: shadow.none, ":hover": shadow.sm },
    color: "inherit",
    display: "flex",
    flexDirection: "column",
    outlineColor: uiColor.text2,
    outlineOffset: 2,
    outlineStyle: { default: "none", ":focus-visible": "solid" },
    outlineWidth: 2,
    rowGap: 8,
    transitionDuration: animationDuration.default,
    transitionProperty: "border-color, box-shadow",
    minWidth: 0,
  },
  cardTop: {
    alignItems: "baseline",
    columnGap: 12,
    display: "flex",
    justifyContent: "space-between",
  },
  cardTitle: {
    color: uiColor.text2,
    fontSize: 16,
    fontWeight: fontWeight.semibold,
    minWidth: 0,
  },
  cardCount: {
    color: uiColor.text1,
    flexShrink: 0,
    fontSize: 13,
    fontVariantNumeric: "tabular-nums",
    whiteSpace: "nowrap",
  },
  keys: {
    color: uiColor.text1,
    fontFamily: fontFamily.mono,
    fontSize: 12,
    lineHeight: 1.5,
    overflowWrap: "anywhere",
  },
  cardDescription: {
    margin: 0,
    overflow: "hidden",
    WebkitBoxOrient: "vertical",
    WebkitLineClamp: 2,
    color: uiColor.text1,
    display: "-webkit-box",
    fontSize: 13,
    lineHeight: 1.5,
  },
  expand: {
    padding: 0,
    borderWidth: 0,
    alignItems: "center",
    backgroundColor: "transparent",
    color: { default: uiColor.text1, ":hover": uiColor.text2 },
    columnGap: 4,
    cursor: "pointer",
    display: "inline-flex",
    fontFamily: "inherit",
    fontSize: 15,
    transitionDuration: animationDuration.default,
    transitionProperty: "color",
    marginTop: 16,
  },
  listTitle: {
    margin: 0,
    color: uiColor.text2,
    fontFamily: fontFamily.title,
    fontSize: 26,
    fontWeight: fontWeight.bold,
    letterSpacing: "-0.035em",
    marginBottom: 12,
  },
  list: {
    columnGap: 48,
    display: "grid",
    gridTemplateColumns: {
      default: "minmax(0, 1fr)",
      [breakpoints.md]: "repeat(2, minmax(0, 1fr))",
    },
  },
  row: {
    paddingBlock: 14,
    alignItems: "baseline",
    columnGap: 16,
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) auto",
    borderTopColor: uiColor.border1,
    borderTopStyle: "solid",
    borderTopWidth: 1,
  },
  rowName: {
    textDecoration: "none",
    color: { default: uiColor.text2, ":hover": uiColor.text1 },
    fontFamily: fontFamily.mono,
    fontSize: 14,
    fontWeight: fontWeight.medium,
    transitionDuration: animationDuration.default,
    transitionProperty: "color",
  },
  rowTypes: {
    color: uiColor.text1,
    fontSize: 13,
    lineHeight: 1.6,
    marginTop: 2,
  },
  rowType: {
    textDecoration: "none",
    color: "inherit",
    textDecorationColor: { default: uiColor.border2, ":hover": uiColor.text1 },
    textDecorationLine: "underline",
    textUnderlineOffset: 3,
  },
  rowCount: {
    textDecoration: "none",
    alignItems: "center",
    color: { default: uiColor.text1, ":hover": uiColor.text2 },
    columnGap: 4,
    display: "inline-flex",
    fontSize: 14,
    fontVariantNumeric: "tabular-nums",
    transitionDuration: animationDuration.default,
    transitionProperty: "color",
    whiteSpace: "nowrap",
  },
});

/** One data type (a cluster of record keys shared by the same apps) as a text card. */
function DataTypeCard({
  cluster,
  descriptionsByRepoNsid,
}: {
  cluster: DirectoryOAuthLexiconClusterSummary;
  descriptionsByRepoNsid: Record<string, string>;
}) {
  const description = getDataTypeDescription(
    cluster.keys,
    descriptionsByRepoNsid,
  );
  const shownKeys = cluster.keys.slice(0, KEYS_PER_CARD);
  const hiddenKeys = cluster.keys.length - shownKeys.length;

  return (
    <RouterLink
      to="/apps/lexicon-set"
      search={{
        c: stringifyLexiconClusterSearchParam(cluster.keys),
        sort: "popular",
      }}
      {...stylex.props(styles.card)}
    >
      <span {...stylex.props(styles.cardTop)}>
        <span {...stylex.props(styles.cardTitle)}>
          {formatDataTypeTitle(cluster.keys)}
        </span>
        <span {...stylex.props(styles.cardCount)}>
          {formatAppCount(cluster.appCount)}
        </span>
      </span>
      <span {...stylex.props(styles.keys)}>
        {shownKeys.map((key) => (
          <Fragment key={key}>
            {getDataKeyNsid(key)}
            <br />
          </Fragment>
        ))}
        {hiddenKeys > 0 ? `+${hiddenKeys} more` : null}
      </span>
      {description ? (
        <p {...stylex.props(styles.cardDescription)}>{description}</p>
      ) : null}
    </RouterLink>
  );
}

/** Icons of the most popular apps using a producer's data (loaded after first paint). */
function ProducerIcons({ groupKey }: { groupKey: string }) {
  const { data } = useQuery({
    ...directoryListingApi.getBrowsePageQueryOptions({ data: groupKey }),
    staleTime: 5 * 60 * 1000,
  });
  if (!data) return null;
  return (
    <span {...stylex.props(styles.stack)}>
      <IconStack listings={data.results} size={30} />
    </span>
  );
}

/** A producer with enough apps for its own band: header plus a grid of data-type cards. */
export function DataProducerSection({
  producer,
  descriptionsByRepoNsid,
}: {
  producer: DataProducer;
  descriptionsByRepoNsid: Record<string, string>;
}) {
  const [expanded, setExpanded] = useState(false);
  const other = isOtherDataProducer(producer);
  const visible = expanded
    ? producer.clusters
    : producer.clusters.slice(0, DATA_TYPES_PER_SECTION);
  const hidden = producer.clusters.length - visible.length;

  return (
    <section
      aria-label={other ? "Other data types" : producer.groupKey}
      {...stylex.props(styles.section)}
    >
      <div {...stylex.props(styles.head)}>
        <div {...stylex.props(styles.headText)}>
          <div {...stylex.props(styles.eyebrow)}>
            {producer.siteOrigin ? (
              <a
                href={producer.siteOrigin}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`${producer.siteLabel} (opens in new tab)`}
                {...stylex.props(styles.eyebrowLink)}
              >
                {producer.siteLabel}
              </a>
            ) : (
              "Other"
            )}
          </div>
          <h2 {...stylex.props(styles.heading)}>
            {other ? (
              "Other data"
            ) : (
              <RouterLink
                to="/apps"
                search={{ data: producer.groupKey }}
                {...stylex.props(styles.headingLink)}
              >
                {producer.groupKey}
              </RouterLink>
            )}
          </h2>
        </div>
        {other ? null : (
          <>
            <ProducerIcons groupKey={producer.groupKey} />
            <MoreLink to="/apps" search={{ data: producer.groupKey }}>
              {formatAppCount(producer.appCount)}
            </MoreLink>
          </>
        )}
      </div>
      <div {...stylex.props(styles.grid)}>
        {visible.map((cluster) => (
          <DataTypeCard
            key={cluster.keys.join("\u001F")}
            cluster={cluster}
            descriptionsByRepoNsid={descriptionsByRepoNsid}
          />
        ))}
      </div>
      {hidden > 0 ? (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          {...stylex.props(styles.expand)}
        >
          {formatDataTypeCount(hidden)} more
          <ChevronDown size={15} aria-hidden />
        </button>
      ) : null}
    </section>
  );
}

/** Smaller producers as a two-column list: name, its data types, and how many apps use them. */
export function DataProducerList({
  producers,
}: {
  producers: Array<DataProducer>;
}) {
  return (
    <section
      aria-labelledby="more-shared-data"
      {...stylex.props(styles.section)}
    >
      <h2 id="more-shared-data" {...stylex.props(styles.listTitle)}>
        More shared data
      </h2>
      <div {...stylex.props(styles.list)}>
        {producers.map((producer) => (
          <div key={producer.groupKey} {...stylex.props(styles.row)}>
            <div>
              {isOtherDataProducer(producer) ? (
                <span {...stylex.props(styles.rowName)}>Other</span>
              ) : (
                <RouterLink
                  to="/apps"
                  search={{ data: producer.groupKey }}
                  {...stylex.props(styles.rowName)}
                >
                  {producer.groupKey}
                </RouterLink>
              )}
              <div {...stylex.props(styles.rowTypes)}>
                {producer.clusters.map((cluster, index) => (
                  <Fragment key={cluster.keys.join("\u001F")}>
                    {index > 0 ? " · " : null}
                    <RouterLink
                      to="/apps/lexicon-set"
                      search={{
                        c: stringifyLexiconClusterSearchParam(cluster.keys),
                        sort: "popular",
                      }}
                      {...stylex.props(styles.rowType)}
                    >
                      {formatDataTypeTitle(cluster.keys)}
                    </RouterLink>
                  </Fragment>
                ))}
              </div>
            </div>
            {isOtherDataProducer(producer) ? (
              <span {...stylex.props(styles.rowCount)}>
                {formatAppCount(producer.appCount)}
              </span>
            ) : (
              <RouterLink
                to="/apps"
                search={{ data: producer.groupKey }}
                aria-label={`${formatAppCount(producer.appCount)} using ${producer.groupKey}`}
                {...stylex.props(styles.rowCount)}
              >
                {formatAppCount(producer.appCount)}
                <ArrowRight size={14} aria-hidden />
              </RouterLink>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
