import * as stylex from "@stylexjs/stylex";
import { useState } from "react";

import type {
  BrowseFacet,
  BrowseFacetOption,
  BrowseFacets,
  BrowseFilters,
} from "../lib/browse-listings";

import { Avatar } from "../design-system/avatar";
import { Button } from "../design-system/button";
import { Checkbox } from "../design-system/checkbox";
import {
  Disclosure,
  DisclosurePanel,
  DisclosureTitle,
} from "../design-system/disclosure";
import { Flex } from "../design-system/flex";
import { SearchField } from "../design-system/search-field";
import { uiColor } from "../design-system/theme/color.stylex";
import {
  gap,
  horizontalSpace,
} from "../design-system/theme/semantic-spacing.stylex";
import { fontSize } from "../design-system/theme/typography.stylex";
import { SmallBody } from "../design-system/typography";
import { getAppTagEmoji } from "../lib/app-tag-visuals";
import { getInitials } from "../lib/get-initials";

const COLLAPSED_OPTION_COUNT = 8;
const COLLAPSED_ECOSYSTEM_COUNT = 3;

const styles = stylex.create({
  optionLabel: {
    alignItems: "center",
    columnGap: gap["md"],
    display: "flex",
  },
  optionCount: {
    color: uiColor.text1,
    fontSize: fontSize["xs"],
    fontVariantNumeric: "tabular-nums",
  },
  childOption: {
    paddingLeft: horizontalSpace["4xl"],
  },
  emoji: {
    fontSize: fontSize["sm"],
    lineHeight: 1,
  },
  ecosystemIcon: {
    height: "1.25rem",
    width: "1.25rem",
  },
  facetHint: {
    color: uiColor.text1,
  },
});

interface BrowseFilterPanelProps {
  facets: BrowseFacets;
  filters: BrowseFilters;
  onToggle: (facet: BrowseFacet, value: string) => void;
}

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
    <Flex direction="column" gap="md">
      <SearchableFacetSection
        title="Tags"
        facet="tags"
        options={facets.tags}
        isSelected={isSelected}
        onToggle={onToggle}
        selectedCount={filters.tags.length}
        defaultExpanded
        renderIcon={(option) => (
          <span aria-hidden {...stylex.props(styles.emoji)}>
            {getAppTagEmoji(option.label.toLowerCase())}
          </span>
        )}
      />

      {facets.data.length > 0 ? (
        <SearchableFacetSection
          title="Works with data from"
          hint="Apps that read or write the same records, so your data carries across them."
          facet="data"
          options={facets.data}
          isSelected={isSelected}
          onToggle={onToggle}
          selectedCount={filters.data.length}
        />
      ) : null}

      <FacetSection
        title="Rating"
        selectedCount={filters.minRating == null ? 0 : 1}
        defaultExpanded
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
    </Flex>
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
        <Flex key={option.id} direction="column" gap="md">
          <FacetOption
            option={option}
            isSelected={isSelected(option.id)}
            onToggle={() => onToggle(option.id)}
            icon={
              option.iconUrl === undefined ? undefined : (
                <Avatar
                  alt=""
                  fallback={getInitials(option.label)}
                  size="sm"
                  src={option.iconUrl ?? undefined}
                  style={styles.ecosystemIcon}
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
        </Flex>
      ))}
      {ecosystems.length > COLLAPSED_ECOSYSTEM_COUNT ? (
        <div>
          <Button
            size="sm"
            variant="tertiary"
            onPress={() => setShowAll((value) => !value)}
          >
            {showAll
              ? "Show fewer ecosystems"
              : `Show all ${ecosystems.length} ecosystems`}
          </Button>
        </div>
      ) : null}
    </FacetSection>
  );
}

/** Collapsed by default unless it has a selection; pass `defaultExpanded` to override. */
function FacetSection({
  title,
  selectedCount,
  defaultExpanded = selectedCount > 0,
  hint,
  children,
}: {
  title: string;
  selectedCount: number;
  defaultExpanded?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <Disclosure defaultExpanded={defaultExpanded}>
      <DisclosureTitle>
        {selectedCount > 0 ? `${title} (${selectedCount})` : title}
      </DisclosureTitle>
      <DisclosurePanel>
        <Flex direction="column" gap="md">
          {hint ? <SmallBody style={styles.facetHint}>{hint}</SmallBody> : null}
          {children}
        </Flex>
      </DisclosurePanel>
    </Disclosure>
  );
}

/** Long facets (tags, data) get an inline filter box and a "show all" toggle. */
function SearchableFacetSection({
  title,
  hint,
  facet,
  options,
  selectedCount,
  defaultExpanded,
  isSelected,
  onToggle,
  renderIcon,
}: {
  title: string;
  hint?: string;
  defaultExpanded?: boolean;
  facet: BrowseFacet;
  options: Array<BrowseFacetOption>;
  selectedCount: number;
  isSelected: (facet: BrowseFacet, value: string) => boolean;
  onToggle: (facet: BrowseFacet, value: string) => void;
  renderIcon?: (option: BrowseFacetOption) => React.ReactNode;
}) {
  const [query, setQuery] = useState("");
  const [showAll, setShowAll] = useState(false);
  const normalizedQuery = query.trim().toLowerCase();

  const available = options.filter(
    (option) => option.count > 0 || isSelected(facet, option.id),
  );
  const matching = normalizedQuery
    ? available.filter((option) =>
        option.label.toLowerCase().includes(normalizedQuery),
      )
    : available;
  const selectedFirst = matching.toSorted(
    (a, b) => Number(isSelected(facet, b.id)) - Number(isSelected(facet, a.id)),
  );
  const visible =
    showAll || normalizedQuery
      ? selectedFirst
      : selectedFirst.slice(0, COLLAPSED_OPTION_COUNT);

  if (available.length === 0) {
    return null;
  }

  return (
    <FacetSection
      title={title}
      selectedCount={selectedCount}
      defaultExpanded={defaultExpanded}
      hint={hint}
    >
      {available.length > COLLAPSED_OPTION_COUNT ? (
        <SearchField
          aria-label={`Filter ${title.toLowerCase()}`}
          placeholder={`Find (${available.length})`}
          value={query}
          onChange={setQuery}
          size="sm"
          variant="secondary"
        />
      ) : null}
      {visible.map((option) => (
        <FacetOption
          key={option.id}
          option={option}
          isSelected={isSelected(facet, option.id)}
          onToggle={() => onToggle(facet, option.id)}
          icon={renderIcon?.(option)}
        />
      ))}
      {!normalizedQuery && available.length > COLLAPSED_OPTION_COUNT ? (
        <div>
          <Button
            size="sm"
            variant="tertiary"
            onPress={() => setShowAll((value) => !value)}
          >
            {showAll ? "Show fewer" : `Show all ${available.length}`}
          </Button>
        </div>
      ) : null}
    </FacetSection>
  );
}

function FacetOption({
  option,
  isSelected,
  onToggle,
  icon,
  style,
}: {
  option: BrowseFacetOption;
  isSelected: boolean;
  onToggle: () => void;
  icon?: React.ReactNode;
  style?: stylex.StyleXStyles;
}) {
  return (
    <Checkbox
      isSelected={isSelected}
      isDisabled={option.count === 0 && !isSelected}
      onChange={onToggle}
      style={style}
    >
      <span {...stylex.props(styles.optionLabel)}>
        {icon}
        <span>{option.label}</span>
        <span {...stylex.props(styles.optionCount)}>{option.count}</span>
      </span>
    </Checkbox>
  );
}
