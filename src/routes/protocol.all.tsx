import { createFileRoute } from "@tanstack/react-router";

import {
  DirectoryCategoryBranchPage,
  type RootDirectoryCategoryId,
} from "../components/DirectoryCategoryBranchPage";
import { directoryListingApi } from "../integrations/tanstack-query/api-directory-listings.functions";

const rootCategoryId: RootDirectoryCategoryId = "protocol";

export const Route = createFileRoute("/protocol/all")({
  loader: ({ context }) =>
    context.queryClient.ensureQueryData(
      directoryListingApi.getDirectoryCategoryTreeQueryOptions,
    ),
  component: ProtocolAllPage,
});

function ProtocolAllPage() {
  return <DirectoryCategoryBranchPage rootCategoryId={rootCategoryId} />;
}
