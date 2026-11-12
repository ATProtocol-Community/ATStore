import type { ReactNode } from "react";

import * as stylex from "@stylexjs/stylex";
import { Link as RouterLink } from "@tanstack/react-router";

import { Select, SelectItem } from "../../../design-system/select";
import { animationDuration } from "../../../design-system/theme/animations.stylex";
import { uiColor } from "../../../design-system/theme/color.stylex";
import { breakpoints } from "../../../design-system/theme/media-queries.stylex";
import { fontFamily } from "../../../design-system/theme/typography.stylex";
import { BackLink, PageHero } from "../Section";

export type DataTypeSort = "popular" | "newest" | "alphabetical";

const sortOptions: Array<{ id: DataTypeSort; label: string }> = [
  { id: "popular", label: "Popular" },
  { id: "newest", label: "Newest" },
  { id: "alphabetical", label: "Alphabetical" },
];

const styles = stylex.create({
  sortSelect: {
    flexShrink: 0,
    minWidth: { default: "100%", [breakpoints.md]: "12rem" },
  },
  keys: {
    columnGap: 8,
    display: "flex",
    flexWrap: "wrap",
    rowGap: 8,
    marginBottom: { default: 24, [breakpoints.md]: 32 },
    marginTop: { default: -8, [breakpoints.md]: -16 },
  },
  key: {
    borderColor: { default: uiColor.border1, ":hover": uiColor.border3 },
    borderRadius: 999,
    borderStyle: "solid",
    borderWidth: 1,
    paddingBlock: 6,
    paddingInline: 12,
    textDecoration: "none",
    backgroundColor: uiColor.bg,
    color: uiColor.text2,
    fontFamily: fontFamily.mono,
    fontSize: 13,
    overflowWrap: "anywhere",
    transitionDuration: animationDuration.default,
    transitionProperty: "border-color",
    maxWidth: "100%",
  },
  staticKey: {
    borderColor: uiColor.border1,
  },
});

/** Hero for one data type (or a set of them): kind, name, description and the sort picker. */
export function DataTypeHeader({
  eyebrow,
  title,
  description,
  sort,
  sortLabel,
  onSortChange,
  keys,
}: {
  eyebrow: ReactNode;
  title: ReactNode;
  description: ReactNode;
  sort: DataTypeSort;
  sortLabel: string;
  onSortChange: (sort: DataTypeSort) => void;
  /** Record keys shown as mono NSID pills; `linked` ones go to that key's own page. */
  keys: Array<{ key: string; nsid: string; name: string; linked: boolean }>;
}) {
  return (
    <>
      <PageHero
        back={<BackLink to="/apps/lexicons">All data types</BackLink>}
        eyebrow={eyebrow}
        title={title}
        description={description}
        aside={
          <Select
            aria-label={sortLabel}
            items={sortOptions}
            placeholder="Sort apps"
            size="lg"
            style={styles.sortSelect}
            value={sort}
            variant="secondary"
            onChange={(key) => {
              const next = sortOptions.find((option) => option.id === key);
              if (next) onSortChange(next.id);
            }}
          >
            {(item) => <SelectItem>{item.label}</SelectItem>}
          </Select>
        }
      />
      {keys.length > 0 ? (
        <div {...stylex.props(styles.keys)}>
          {keys.map(({ key, nsid, name, linked }) =>
            linked ? (
              <RouterLink
                key={key}
                to="/apps/lexicon"
                search={{ key, sort: "popular" }}
                aria-label={`Browse apps for ${name}`}
                title={name}
                {...stylex.props(styles.key)}
              >
                {nsid}
              </RouterLink>
            ) : (
              <span
                key={key}
                title={name}
                {...stylex.props(styles.key, styles.staticKey)}
              >
                {nsid}
              </span>
            ),
          )}
        </div>
      ) : null}
    </>
  );
}
