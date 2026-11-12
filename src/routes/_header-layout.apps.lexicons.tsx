import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Database } from "lucide-react";
import { useMemo } from "react";

import {
  DATA_PRODUCER_SECTION_MIN_APPS,
  groupClustersByProducer,
} from "../components/shelf/discovery/data-hub";
import {
  DataProducerList,
  DataProducerSection,
} from "../components/shelf/discovery/DataTypes";
import { PageHero } from "../components/shelf/Section";
import {
  EmptyState,
  EmptyStateDescription,
  EmptyStateImage,
  EmptyStateTitle,
} from "../design-system/empty-state";
import { directoryListingApi } from "../integrations/tanstack-query/api-directory-listings.functions";
import { buildRouteOgMeta } from "../lib/og-meta";

export const Route = createFileRoute("/_header-layout/apps/lexicons")({
  loader: ({ context }) =>
    context.queryClient.ensureQueryData(
      directoryListingApi.getAppsOAuthLexiconSummariesQueryOptions,
    ),
  head: () =>
    buildRouteOgMeta({
      title: "Lexicons | at-store",
      description:
        "Browse verified apps that share repo record collection lexicons from OAuth scopes.",
    }),
  component: AppsLexiconsHubPage,
});

function AppsLexiconsHubPage() {
  const { data: hub } = useSuspenseQuery(
    directoryListingApi.getAppsOAuthLexiconSummariesQueryOptions,
  );

  const producers = useMemo(
    () => groupClustersByProducer(hub.clusters),
    [hub.clusters],
  );
  const major = producers.filter(
    (producer) => producer.appCount >= DATA_PRODUCER_SECTION_MIN_APPS,
  );
  const minor = producers.filter(
    (producer) => producer.appCount < DATA_PRODUCER_SECTION_MIN_APPS,
  );

  return (
    <>
      <PageHero
        eyebrow="Shared data"
        title="Data types"
        description="On the AT Protocol, your posts, follows, photos and playlists live in your own repo, and any app can use them. These are the data types apps share, so you can switch apps without leaving anything behind."
      />

      {producers.length > 0 ? (
        <>
          {major.map((producer) => (
            <DataProducerSection
              key={producer.groupKey}
              producer={producer}
              descriptionsByRepoNsid={hub.descriptionsByRepoNsid}
            />
          ))}
          {minor.length > 0 ? <DataProducerList producers={minor} /> : null}
        </>
      ) : (
        <EmptyState size="lg">
          <EmptyStateImage>
            <Database size={48} strokeWidth={1.75} />
          </EmptyStateImage>
          <EmptyStateTitle>No shared data yet</EmptyStateTitle>
          <EmptyStateDescription>
            When two or more apps read or write the same kind of data, like
            posts, follows or playlists, it shows up here so you can find apps
            that work together.
          </EmptyStateDescription>
        </EmptyState>
      )}
    </>
  );
}
