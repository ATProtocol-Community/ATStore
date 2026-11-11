import type { ReactNode } from "react";

import * as stylex from "@stylexjs/stylex";
import { Check } from "lucide-react";
import { useState } from "react";

import type {
  BrowseFacet,
  BrowseFacetOption,
  BrowseFacets,
  BrowseFilters,
} from "../lib/browse-listings";

import { SearchField } from "../design-system/search-field";
import { animationDuration } from "../design-system/theme/animations.stylex";
import { uiColor } from "../design-system/theme/color.stylex";
import {
  fontFamily,
  fontWeight,
} from "../design-system/theme/typography.stylex";
import { ListingIcon } from "./shelf/ListingIcon";

const COLLAPSED_OPTION_COUNT = 8;
const COLLAPSED_DATA_COUNT = 6;
const COLLAPSED_ECOSYSTEM_COUNT = 3;

const ACCENT = "light-dark(#1c4ef5, #7b97ff)";

const styles = stylex.create({
  panel: {
    display: "flex",
    flexDirection: "column",
  },
  group: {
    borderTopColor: {
      default: uiColor.border1,
      ":first-child": "transparent",
    },
    borderTopStyle: "solid",
    borderTopWidth: { default: 1, ":first-child": 0 },
    paddingBottom: 20,
    paddingTop: { default: 18, ":first-child": 4 },
  },
  title: {
    alignItems: "baseline",
    color: uiColor.text2,
    columnGap: 8,
    display: "flex",
    fontSize: 13,
    fontWeight: fontWeight.semibold,
    rowGap: 8,
    marginBottom: 10,
    marginTop: 0,
  },
  selected: {
    color: ACCENT,
    fontSize: 12,
    fontWeight: fontWeight.medium,
  },
  hint: {
    color: uiColor.text1,
    fontSize: 12,
    lineHeight: 1.45,
    marginBottom: 10,
    marginTop: -4,
  },
  find: {
    marginBottom: 8,
  },
  option: {
    borderRadius: 8,
    marginInline: -8,
    paddingBlock: 6,
    paddingInline: 8,
    alignItems: "center",
    backgroundColor: {
      default: "transparent",
      ":hover": uiColor.component1,
    },
    color: uiColor.text2,
    columnGap: 10,
    cursor: "pointer",
    display: "flex",
    fontSize: 14,
    position: "relative",
    rowGap: 10,
    transitionDuration: animationDuration.fast,
    transitionProperty: "background-color",
  },
  optionDisabled: {
    backgroundColor: { default: "transparent", ":hover": "transparent" },
    cursor: "default",
    opacity: 0.45,
  },
  // Visually hidden; the label row draws the box and the focus ring.
  input: {
    margin: 0,
    overflow: "hidden",
    clip: "rect(0 0 0 0)",
    clipPath: "inset(50%)",
    position: "absolute",
    whiteSpace: "nowrap",
    height: 1,
    width: 1,
  },
  optionSelected: {
    fontWeight: fontWeight.medium,
  },
  childOption: {
    paddingLeft: 22,
  },
  box: {
    borderColor: uiColor.border2,
    borderRadius: 5,
    borderStyle: "solid",
    borderWidth: 1.5,
    placeItems: "center",
    color: uiColor.bg,
    display: "grid",
    flexShrink: 0,
    outlineColor: uiColor.text2,
    outlineOffset: 2,
    outlineStyle: {
      default: "none",
      [stylex.when.siblingBefore(":focus-visible")]: "solid",
    },
    outlineWidth: 2,
    transitionDuration: animationDuration.fast,
    transitionProperty: "background-color, border-color",
    height: 16,
    width: 16,
  },
  boxChecked: {
    borderColor: uiColor.text2,
    backgroundColor: uiColor.text2,
  },
  label: {
    overflow: "hidden",
    flexGrow: 1,
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    minWidth: 0,
  },
  detail: {
    color: uiColor.text1,
    fontFamily: fontFamily.mono,
    fontSize: 11,
    fontWeight: fontWeight.normal,
    marginLeft: 6,
  },
  count: {
    color: uiColor.text1,
    fontSize: 12,
    fontVariantNumeric: "tabular-nums",
    fontWeight: fontWeight.normal,
  },
  showAll: {
    padding: 0,
    borderWidth: 0,
    backgroundColor: "transparent",
    color: {
      default: uiColor.text1,
      ":hover": uiColor.text2,
    },
    cursor: "pointer",
    fontFamily: "inherit",
    fontSize: 13,
    outlineColor: uiColor.text2,
    outlineOffset: 2,
    outlineStyle: { default: "none", ":focus-visible": "solid" },
    outlineWidth: 2,
    textDecorationColor: {
      default: uiColor.border2,
      ":hover": "currentColor",
    },
    textDecorationLine: "underline",
    textUnderlineOffset: 3,
    marginTop: 6,
  },
});

interface BrowseFilterPanelProps {
  facets: BrowseFacets;
  filters: BrowseFilters;
  onToggle: (facet: BrowseFacet, value: string) => void;
}

/** The Browse filter column (and mobile drawer): checkbox rows with live counts. */
export function BrowseFilterPanel({
  facets,
  filters,
  onToggle,
}: BrowseFilterPanelProps) {
  const isSelected = (facet: BrowseFacet, value: string) => {
    switch (facet) {
      case "minRating": {
        return filters.minRating === Number(value);
      }
      case "extras": {
        return (filters.extras as Array<string>).includes(value);
      }
      default: {
        return filters[facet].includes(value);
      }
    }
  };

  return (
    <div {...stylex.props(styles.panel)}>
      <SearchableFacetSection
        title="Tags"
        facet="tags"
        options={facets.tags}
        isSelected={isSelected}
        onToggle={onToggle}
        selectedCount={filters.tags.length}
        collapsedCount={COLLAPSED_OPTION_COUNT}
      />

      <SearchableFacetSection
        title="Works with data from"
        hint="Apps that read or write the same records, so your data carries across them."
        facet="data"
        options={facets.data}
        isSelected={isSelected}
        onToggle={onToggle}
        selectedCount={filters.data.length}
        collapsedCount={COLLAPSED_DATA_COUNT}
        showDetail
      />

      <FacetSection
        title="Rating"
        selectedCount={filters.minRating == null ? 0 : 1}
      >
        {facets.minRating.map((option) => (
          <FacetOption
            key={option.id}
            option={option}
            isSelected={isSelected("minRating", option.id)}
            onToggle={() => onToggle("minRating", option.id)}
          />
        ))}
      </FacetSection>

      <FacetSection title="Extras" selectedCount={filters.extras.length}>
        {facets.extras.map((option) => (
          <FacetOption
            key={option.id}
            option={option}
            isSelected={isSelected("extras", option.id)}
            onToggle={() => onToggle("extras", option.id)}
          />
        ))}
      </FacetSection>

      <CategoryFacetSection
        options={facets.categories}
        selectedCount={filters.categories.length}
        isSelected={(value) => isSelected("categories", value)}
        onToggle={(value) => onToggle("categories", value)}
      />
    </div>
  );
}

/**
 * Category tree: standalone apps, app ecosystems (largest first, the rest behind "show all"),
 * then protocol tooling. Ecosystems list their tool categories underneath.
 */
function CategoryFacetSection({
  options,
  selectedCount,
  isSelected,
  onToggle,
}: {
  options: Array<BrowseFacetOption>;
  selectedCount: number;
  isSelected: (value: string) => boolean;
  onToggle: (value: string) => void;
}) {
  const [showAll, setShowAll] = useState(false);
  const isOptionActive = (option: BrowseFacetOption) =>
    isSelected(option.id) ||
    Boolean(option.children?.some((child) => isSelected(child.id)));

  const ecosystems = options.filter(
    (option) => option.iconUrl !== undefined && option.children,
  );
  const visibleEcosystems = new Set(
    (showAll
      ? ecosystems
      : ecosystems.filter(
          (option, index) =>
            index < COLLAPSED_ECOSYSTEM_COUNT || isOptionActive(option),
        )
    ).map((option) => option.id),
  );
  const visible = options.filter(
    (option) =>
      !ecosystems.includes(option) || visibleEcosystems.has(option.id),
  );

  return (
    <FacetSection title="Category" selectedCount={selectedCount}>
      {visible.map((option) => (
        <div key={option.id}>
          <FacetOption
            option={option}
            isSelected={isSelected(option.id)}
            onToggle={() => onToggle(option.id)}
            icon={
              option.iconUrl === undefined ? undefined : (
                <ListingIcon
                  name={option.label}
                  src={option.iconUrl}
                  size={18}
                />
              )
            }
          />
          {option.children
            ?.filter((child) => child.count > 0 || isSelected(child.id))
            .map((child) => (
              <FacetOption
                key={child.id}
                option={child}
                isSelected={isSelected(child.id)}
                onToggle={() => onToggle(child.id)}
                style={styles.childOption}
              />
            ))}
        </div>
      ))}
      {ecosystems.length > COLLAPSED_ECOSYSTEM_COUNT ? (
        <ShowAllButton onPress={() => setShowAll((value) => !value)}>
          {showAll
            ? "Show fewer ecosystems"
            : `Show all ${ecosystems.length} ecosystems`}
        </ShowAllButton>
      ) : null}
    </FacetSection>
  );
}

function FacetSection({
  title,
  selectedCount,
  hint,
  children,
}: {
  title: string;
  selectedCount: number;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <section aria-label={title} {...stylex.props(styles.group)}>
      <h3 {...stylex.props(styles.title)}>
        {title}
        {selectedCount > 0 ? (
          <span {...stylex.props(styles.selected)}>
            {`${selectedCount} selected`}
          </span>
        ) : null}
      </h3>
      {hint ? <p {...stylex.props(styles.hint)}>{hint}</p> : null}
      {children}
    </section>
  );
}

/**
 * Long facets (tags, data) show the top few; "Show all" reveals the rest with
 * an inline filter box. Selected values always stay visible at the top.
 */
function SearchableFacetSection({
  title,
  hint,
  facet,
  options,
  selectedCount,
  collapsedCount,
  showDetail = false,
  isSelected,
  onToggle,
}: {
  title: string;
  hint?: string;
  facet: BrowseFacet;
  options: Array<BrowseFacetOption>;
  selectedCount: number;
  collapsedCount: number;
  /** Show the option id beside its label (data producers: `app.bsky`). */
  showDetail?: boolean;
  isSelected: (facet: BrowseFacet, value: string) => boolean;
  onToggle: (facet: BrowseFacet, value: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [showAll, setShowAll] = useState(false);
  const normalizedQuery = showAll ? query.trim().toLowerCase() : "";

  const available = options.filter(
    (option) => option.count > 0 || isSelected(facet, option.id),
  );
  const matching = normalizedQuery
    ? available.filter(
        (option) =>
          option.label.toLowerCase().includes(normalizedQuery) ||
          option.id.toLowerCase().includes(normalizedQuery),
      )
    : available;
  const selectedFirst = matching.toSorted(
    (a, b) => Number(isSelected(facet, b.id)) - Number(isSelected(facet, a.id)),
  );
  const visible = showAll
    ? selectedFirst
    : selectedFirst.slice(0, collapsedCount);

  if (available.length === 0) {
    return null;
  }

  return (
    <FacetSection title={title} selectedCount={selectedCount} hint={hint}>
      {showAll && available.length > collapsedCount ? (
        <SearchField
          aria-label={`Filter ${title.toLowerCase()}`}
          placeholder={`Find (${available.length})`}
          value={query}
          onChange={setQuery}
          size="sm"
          variant="secondary"
          style={styles.find}
        />
      ) : null}
      {visible.map((option) => (
        <FacetOption
          key={option.id}
          option={option}
          detail={showDetail && option.id !== option.label ? option.id : null}
          isSelected={isSelected(facet, option.id)}
          onToggle={() => onToggle(facet, option.id)}
        />
      ))}
      {available.length > collapsedCount ? (
        <ShowAllButton
          onPress={() => {
            setShowAll((value) => !value);
            setQuery("");
          }}
        >
          {showAll ? "Show fewer" : `Show all ${available.length}`}
        </ShowAllButton>
      ) : null}
    </FacetSection>
  );
}

function ShowAllButton({
  onPress,
  children,
}: {
  onPress: () => void;
  children: ReactNode;
}) {
  return (
    <div>
      <button type="button" onClick={onPress} {...stylex.props(styles.showAll)}>
        {children}
      </button>
    </div>
  );
}

function FacetOption({
  option,
  detail,
  isSelected,
  onToggle,
  icon,
  style,
}: {
  option: BrowseFacetOption;
  detail?: string | null;
  isSelected: boolean;
  onToggle: () => void;
  icon?: ReactNode;
  style?: stylex.StyleXStyles;
}) {
  const isDisabled = option.count === 0 && !isSelected;
  return (
    <label
      {...stylex.props(
        styles.option,
        isDisabled && styles.optionDisabled,
        isSelected && styles.optionSelected,
        style,
      )}
    >
      <input
        type="checkbox"
        checked={isSelected}
        disabled={isDisabled}
        onChange={onToggle}
        {...stylex.props(styles.input, stylex.defaultMarker())}
      />
      <span
        aria-hidden
        {...stylex.props(styles.box, isSelected && styles.boxChecked)}
      >
        {isSelected ? <Check size={12} strokeWidth={3} /> : null}
      </span>
      {icon}
      <span {...stylex.props(styles.label)}>
        {option.label}
        {detail ? <span {...stylex.props(styles.detail)}>{detail}</span> : null}
      </span>
      <span {...stylex.props(styles.count)}>{option.count}</span>
    </label>
  );
}
