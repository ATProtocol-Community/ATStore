import * as stylex from "@stylexjs/stylex";
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";

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
import { ui } from "../design-system/theme/semantic-color.stylex";
import {
  Body,
  Heading1,
  Heading3,
  SmallBody,
} from "../design-system/typography";
import { Text } from "../design-system/typography/text";
import { adminHeroArtApi } from "../integrations/tanstack-query/api-admin-hero-art.functions";
import type { GenerateHeroArtResult } from "../integrations/tanstack-query/api-admin-hero-art.functions";
import type { HeroArtItem, HeroArtKind } from "../lib/missing-hero-art";

export const Route = createFileRoute(
  "/_header-layout/_admin-layout/admin/hero-art",
)({
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData(
      adminHeroArtApi.getMissingHeroArtQueryOptions,
    );
  },
  component: AdminHeroArtPage,
});

const styles = stylex.create({
  page: {
    paddingBottom: verticalSpace["10xl"],
    paddingTop: verticalSpace["6xl"],
  },
  section: {
    maxWidth: "76rem",
  },
  sectionCard: {
    boxShadow: shadow.sm,
  },
  itemGrid: {
    display: "grid",
    gap: gap.xl,
    gridTemplateColumns: "repeat(auto-fill, minmax(18rem, 1fr))",
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
  emptyState: {
    paddingBottom: verticalSpace["2xl"],
    paddingLeft: horizontalSpace["2xl"],
    paddingRight: horizontalSpace["2xl"],
    paddingTop: verticalSpace["2xl"],
  },
  filterRow: {
    alignItems: "center",
    flexWrap: "wrap",
    gap: gap.lg,
  },
  pill: {
    backgroundColor: ui.bgGhost,
    borderRadius: "9999px",
    fontSize: "0.75rem",
    paddingBottom: verticalSpace.xs,
    paddingLeft: horizontalSpace.md,
    paddingRight: horizontalSpace.md,
    paddingTop: verticalSpace.xs,
  },
  warningList: {
    gap: gap.xs,
  },
  metaRow: {
    alignItems: "center",
    flexWrap: "wrap",
    gap: gap.md,
    justifyContent: "space-between",
  },
  assetPath: {
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, monospace",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  placeholderPreview: {
    height: "100%",
    width: "100%",
  },
});

interface HeroArtSectionDefinition {
  kind: HeroArtKind;
  title: string;
  description: string;
}

const SECTIONS: readonly HeroArtSectionDefinition[] = [
  {
    kind: "app-tag",
    title: "App tag heroes",
    description:
      "Hero banners shown on `/apps/{tag}` landing pages. Sourced from distinct app tags across published listings.",
  },
  {
    kind: "ecosystem",
    title: "Ecosystem heroes",
    description:
      "Hero banners for app ecosystems like `apps/bluesky/client`. Sourced from distinct app category slugs.",
  },
  {
    kind: "protocol-category",
    title: "Protocol category covers",
    description:
      "Card covers for `protocol/{segment}` directory categories (e.g. `pds`, `appview`).",
  },
] as const;

function AdminHeroArtPage() {
  const { data } = useSuspenseQuery(
    adminHeroArtApi.getMissingHeroArtQueryOptions,
  );
  const [showAll, setShowAll] = useState(false);

  const bundleByKind = useMemo(() => {
    return {
      "app-tag": data.appTags,
      ecosystem: data.ecosystem,
      "protocol-category": data.protocolCategory,
    } satisfies Record<HeroArtKind, HeroArtItem[]>;
  }, [data]);

  const totals = useMemo(() => {
    let missingTotal = 0;
    let presentTotal = 0;
    for (const section of SECTIONS) {
      for (const item of bundleByKind[section.kind]) {
        if (item.hasAsset) {
          presentTotal += 1;
        } else {
          missingTotal += 1;
        }
      }
    }
    return { missingTotal, presentTotal };
  }, [bundleByKind]);

  return (
    <Page.Root variant="large" style={styles.page}>
      <Flex direction="column" gap="6xl" style={styles.section}>
        <Flex direction="column" gap="2xl">
          <Heading1>Hero art</Heading1>
          <SmallBody>
            Categories and tags that are used in live listings but don&rsquo;t
            yet have a hero image on the site. Generating regenerates the image
            via Gemini, uploads it to S3, and updates{" "}
            <code>src/lib/generated-banner-record-urls.ts</code>. Commit the
            diff afterwards to keep the generated map in sync for production.
          </SmallBody>
          <Flex style={styles.filterRow}>
            <Text size="sm" variant="secondary">
              {totals.missingTotal} missing &middot; {totals.presentTotal}{" "}
              already generated
            </Text>
            <Button
              variant="secondary"
              size="sm"
              onPress={() => setShowAll((prev) => !prev)}
            >
              {showAll ? "Hide generated items" : "Show generated items too"}
            </Button>
          </Flex>
        </Flex>

        {SECTIONS.map((section) => (
          <HeroArtSection
            key={section.kind}
            definition={section}
            items={bundleByKind[section.kind]}
            showAll={showAll}
          />
        ))}
      </Flex>
    </Page.Root>
  );
}

interface HeroArtSectionProps {
  definition: HeroArtSectionDefinition;
  items: HeroArtItem[];
  showAll: boolean;
}

function HeroArtSection({ definition, items, showAll }: HeroArtSectionProps) {
  const missing = items.filter((item) => !item.hasAsset);
  const present = items.filter((item) => item.hasAsset);
  const visibleItems = showAll ? items : missing;

  return (
    <Card style={styles.sectionCard}>
      <CardHeader>
        <Flex direction="column" gap="md">
          <CardTitle>{definition.title}</CardTitle>
          <SmallBody>{definition.description}</SmallBody>
          <Text size="sm" variant="secondary">
            {missing.length} missing &middot; {present.length} generated
            &middot; {items.length} total
          </Text>
        </Flex>
      </CardHeader>
      <CardBody>
        {visibleItems.length === 0 ? (
          <Body style={styles.emptyState}>
            {missing.length === 0
              ? "All hero images for this group exist."
              : "Toggle above to include items that already have hero art."}
          </Body>
        ) : (
          <div {...stylex.props(styles.itemGrid)}>
            {visibleItems.map((item) => (
              <HeroArtItemCard key={`${item.kind}:${item.id}`} item={item} />
            ))}
          </div>
        )}
      </CardBody>
    </Card>
  );
}

interface HeroArtItemCardProps {
  item: HeroArtItem;
}

function HeroArtItemCard({ item }: HeroArtItemCardProps) {
  const queryClient = useQueryClient();
  const [justGenerated, setJustGenerated] =
    useState<GenerateHeroArtResult | null>(null);

  const mutation = useMutation({
    mutationFn: async () =>
      adminHeroArtApi.generateMissingHeroArtItem({
        data: { kind: item.kind, id: item.id },
      }),
    onSuccess: async (result) => {
      setJustGenerated(result);
      if (result.persistedBannerMap) {
        await queryClient.invalidateQueries({
          queryKey: ["admin", "hero-art"],
        });
      }
    },
  });

  const previewUrl = justGenerated?.previewDataUrl ?? item.mappedUrl ?? null;
  const isBusy = mutation.isPending;
  const errorMessage =
    mutation.error instanceof Error
      ? mutation.error.message
      : mutation.error
        ? String(mutation.error)
        : null;
  const warnings = justGenerated?.persistedWarnings ?? [];

  return (
    <Card style={styles.itemCard}>
      {previewUrl ? (
        <CardImage aspectRatio={16 / 9} src={previewUrl} alt="" />
      ) : (
        <CardImage aspectRatio={16 / 9}>
          <Flex
            align="center"
            justify="center"
            style={styles.placeholderPreview}
          >
            <Text size="sm" variant="secondary">
              No hero yet
            </Text>
          </Flex>
        </CardImage>
      )}
      <Flex direction="column" style={styles.itemCardBody}>
        <Flex style={styles.metaRow}>
          <Heading3>{item.label}</Heading3>
          <span {...stylex.props(styles.pill)}>
            {item.hasAsset ? "Generated" : "Missing"}
          </span>
        </Flex>
        <Text size="xs" variant="secondary" style={styles.assetPath}>
          {item.assetPath}
        </Text>
        <Text size="xs" variant="secondary">
          id: <code>{item.id}</code>
        </Text>
        {typeof item.listingCount === "number" ? (
          <Text size="xs" variant="secondary">
            {item.listingCount}{" "}
            {item.listingCount === 1 ? "listing" : "listings"} in this branch
          </Text>
        ) : null}
        {errorMessage ? (
          <Text size="sm" variant="critical">
            {errorMessage}
          </Text>
        ) : null}
        {justGenerated ? (
          <Flex direction="column" style={styles.warningList}>
            <Text size="sm" variant="secondary">
              {justGenerated.persistedBannerMap
                ? "Saved to S3 and banner map. Commit the updated generated-banner-record-urls.ts to ship."
                : "Generated and shown below — not persisted in the banner map."}
            </Text>
            {warnings.map((warning, index) => (
              <Text key={index} size="xs" variant="secondary">
                {warning}
              </Text>
            ))}
          </Flex>
        ) : null}
        <Button size="sm" isDisabled={isBusy} onPress={() => mutation.mutate()}>
          {isBusy
            ? "Generating…"
            : item.hasAsset || justGenerated
              ? "Regenerate"
              : "Generate"}
        </Button>
      </Flex>
    </Card>
  );
}
