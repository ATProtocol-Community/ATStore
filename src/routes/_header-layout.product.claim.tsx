import * as stylex from "@stylexjs/stylex";
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";

import { Button } from "../design-system/button";
import { Card, CardBody, CardImage } from "../design-system/card";
import { Flex } from "../design-system/flex";
import { HeaderLayout } from "../design-system/header-layout";
import { Page } from "../design-system/page";
import {
  gap,
  horizontalSpace,
  verticalSpace,
} from "../design-system/theme/semantic-spacing.stylex";
import { shadow } from "../design-system/theme/shadow.stylex";
import { Heading1 } from "../design-system/typography";
import { Text } from "../design-system/typography/text";
import { directoryListingApi } from "../integrations/tanstack-query/api-directory-listings.functions";
import { user } from "../integrations/tanstack-query/api-user.functions";
import { SKIP_PRODUCT_CLAIM_COOKIE } from "../lib/product-claim-eligibility";

const styles = stylex.create({
  page: {
    boxSizing: "border-box",
    marginLeft: "auto",
    marginRight: "auto",
    paddingBottom: verticalSpace["8xl"],
    paddingTop: verticalSpace["4xl"],
    width: "100%",
  },
  section: {
    paddingLeft: horizontalSpace.xl,
    paddingRight: horizontalSpace.xl,
    paddingTop: verticalSpace["5xl"],
    paddingBottom: verticalSpace["5xl"],
  },
  card: {
    boxShadow: shadow.sm,
    maxWidth: "36rem",
    width: "100%",
  },
  preview: {
    gap: gap.xl,
  },
  previewIcon: {
    borderRadius: "12px",
    flexShrink: 0,
    height: "64px",
    objectFit: "cover",
    width: "64px",
  },
  description: {
    maxWidth: "40rem",
    textAlign: "center",
  },
});

export const Route = createFileRoute("/_header-layout/product/claim")({
  loader: async ({ context }) => {
    const session = await context.queryClient.ensureQueryData(
      user.getSessionQueryOptions,
    );
    if (!session?.user?.did) {
      throw redirect({
        to: "/login",
        search: { redirect: "/product/claim" },
      });
    }
    await context.queryClient.ensureQueryData(
      directoryListingApi.getProductClaimEligibilityQueryOptions(),
    );
  },
  component: ProductClaimPage,
});

function ProductClaimPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: eligibility } = useSuspenseQuery(
    directoryListingApi.getProductClaimEligibilityQueryOptions(),
  );
  const claimMutation = useMutation({
    mutationFn: async (listingId: string) => {
      return directoryListingApi.claimProductListingToPds({
        data: { listingId },
      });
    },
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({
        queryKey: ["storeListings"],
      });
      await queryClient.invalidateQueries({
        queryKey: ["userProfileReviews"],
      });
      void navigate({
        to: "/products/$productId",
        params: { productId: result.slug },
      });
    },
  });

  function dismissClaimPrompt() {
    const maxAge = 60 * 60 * 24 * 365;
    document.cookie = `${SKIP_PRODUCT_CLAIM_COOKIE}=1; Path=/; Max-Age=${maxAge}; SameSite=Lax`;
    void navigate({ to: "/" });
  }

  if (!eligibility?.eligible || eligibility.listings.length === 0) {
    return (
      <HeaderLayout.Page>
        <Page.Root variant="small" style={styles.page}>
          <Flex direction="column" style={styles.section}>
            <Heading1>Nothing to claim</Heading1>
            <Text size="base" variant="secondary">
              You do not have any store listings to move to your PDS right now.
            </Text>
            <Button
              variant="secondary"
              onPress={() => void navigate({ to: "/" })}
            >
              Home
            </Button>
          </Flex>
        </Page.Root>
      </HeaderLayout.Page>
    );
  }

  return (
    <HeaderLayout.Page>
      <Page.Root variant="small" style={styles.page}>
        <Flex
          direction="column"
          align="center"
          gap="6xl"
          style={styles.section}
        >
          <Heading1>Claim your listing</Heading1>
          <Text
            size="lg"
            leading="base"
            variant="secondary"
            style={styles.description}
          >
            It looks like you own a product listing in the store.
            <br />
            You can claim it and gain the ability to update it!
          </Text>

          {eligibility.listings.map((listing) => (
            <>
              <Card key={listing.id} style={styles.card} size="lg">
                {listing.heroImageUrl && (
                  <CardImage
                    aspectRatio={16 / 9}
                    src={listing.heroImageUrl}
                    alt=""
                  />
                )}
                <CardBody>
                  <Flex direction="column" style={styles.preview}>
                    <Flex gap="xl" align="start">
                      {listing.iconUrl ? (
                        <img
                          src={listing.iconUrl}
                          alt=""
                          {...stylex.props(styles.previewIcon)}
                        />
                      ) : null}
                      <Flex direction="column" gap="xl">
                        <Text size="2xl" weight="bold">
                          {listing.name}
                        </Text>
                        {listing.tagline ? (
                          <Text size="base" variant="secondary">
                            {listing.tagline}
                          </Text>
                        ) : null}
                      </Flex>
                    </Flex>
                    {claimMutation.isError ? (
                      <Text size="sm" variant="critical">
                        {claimMutation.error instanceof Error
                          ? claimMutation.error.message
                          : "Something went wrong."}
                      </Text>
                    ) : null}
                  </Flex>
                </CardBody>
              </Card>
              <Flex gap="md" wrap>
                <Button
                  variant="secondary"
                  isDisabled={claimMutation.isPending}
                  onPress={dismissClaimPrompt}
                  size="lg"
                >
                  Not now
                </Button>
                <Button
                  variant="primary"
                  isPending={claimMutation.isPending}
                  onPress={() => claimMutation.mutate(listing.id)}
                  size="lg"
                >
                  Accept
                </Button>
              </Flex>
            </>
          ))}
        </Flex>
      </Page.Root>
    </HeaderLayout.Page>
  );
}
