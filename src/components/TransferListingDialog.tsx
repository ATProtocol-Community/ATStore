import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { Button } from "../design-system/button";
import {
  Dialog,
  DialogBody,
  DialogDescription,
  DialogFooter,
  DialogHeader,
} from "../design-system/dialog";
import { SmallBody } from "../design-system/typography";
import { directoryListingApi } from "../integrations/tanstack-query/api-directory-listings.functions";
import { UserHandleAutocomplete } from "./user-handle-autocomplete";

/**
 * Owner offers a listing to another account (usually the product's own Bluesky account). Nothing
 * moves until that account signs in and accepts on `/product/claim`; until then the owner can
 * cancel. Opened only via `isOpen` (from the manage page's row menu).
 */
export function TransferListingDialog({
  listing,
  onOpenChange,
}: {
  listing: {
    id: string;
    name: string;
    pendingTransfer: { did: string; handle: string | null } | null;
  } | null;
  onOpenChange: (open: boolean) => void;
}) {
  const [handle, setHandle] = useState("");
  const queryClient = useQueryClient();

  const invalidate = async () => {
    await queryClient.invalidateQueries({
      queryKey: directoryListingApi.getMyProductListingsQueryOptions().queryKey,
    });
  };

  const offerMutation = useMutation({
    mutationFn: async (input: { listingId: string; handle: string }) =>
      directoryListingApi.offerProductListingTransfer({ data: input }),
    onSuccess: invalidate,
  });

  const cancelMutation = useMutation({
    mutationFn: async (listingId: string) =>
      directoryListingApi.cancelProductListingTransfer({
        data: { listingId },
      }),
    onSuccess: async () => {
      await invalidate();
      onOpenChange(false);
    },
  });

  const pending = listing?.pendingTransfer ?? null;
  const pendingActor = pending
    ? pending.handle
      ? `@${pending.handle}`
      : pending.did
    : null;
  const error = offerMutation.error ?? cancelMutation.error;
  const trimmedHandle = handle.replace(/^@+/, "").trim();

  return (
    <Dialog
      isOpen={listing != null}
      onOpenChange={(open) => {
        if (!open) {
          setHandle("");
          offerMutation.reset();
          cancelMutation.reset();
        }
        onOpenChange(open);
      }}
      trigger={<span />}
    >
      <DialogHeader>Transfer {listing?.name ?? "listing"}</DialogHeader>
      {pendingActor ? (
        <DialogDescription>
          Waiting for <strong>{pendingActor}</strong> to accept. Ask them to
          sign in to at-store with that account and accept the transfer at
          atstore.fyi/product/claim. Their account will then host the listing
          record, and the copy in your repo will be removed.
        </DialogDescription>
      ) : (
        <DialogDescription>
          Move this listing&rsquo;s record to another account, such as the
          product&rsquo;s own Bluesky account. That account will own the listing
          and its updates. Reviews, favorites, and the listing URL stay the
          same.
        </DialogDescription>
      )}
      <DialogBody>
        {pendingActor ? null : (
          <UserHandleAutocomplete
            label="New owner"
            value={handle}
            onValueChange={(v) => {
              offerMutation.reset();
              setHandle(v);
            }}
            placeholder="product.handle.com"
            size="lg"
          />
        )}
        {error ? (
          <SmallBody variant="critical">
            {error instanceof Error ? error.message : "Something went wrong."}
          </SmallBody>
        ) : null}
      </DialogBody>
      <DialogFooter>
        {pendingActor ? (
          <>
            <Button
              variant="secondary"
              isPending={cancelMutation.isPending}
              onPress={() => {
                if (listing) cancelMutation.mutate(listing.id);
              }}
            >
              Cancel transfer
            </Button>
            <Button slot="close" variant="primary">
              Done
            </Button>
          </>
        ) : (
          <>
            <Button slot="close" variant="secondary">
              Cancel
            </Button>
            <Button
              variant="primary"
              isPending={offerMutation.isPending}
              isDisabled={trimmedHandle.length === 0}
              onPress={() => {
                if (!listing) return;
                offerMutation.mutate({
                  listingId: listing.id,
                  handle: trimmedHandle,
                });
              }}
            >
              Offer transfer
            </Button>
          </>
        )}
      </DialogFooter>
    </Dialog>
  );
}
