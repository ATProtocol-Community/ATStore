import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";

import { Button } from "../design-system/button";
import {
  Dialog,
  DialogBody,
  DialogDescription,
  DialogFooter,
  DialogHeader,
} from "../design-system/dialog";
import { TextArea } from "../design-system/text-area";
import { SmallBody } from "../design-system/typography";
import { adminApi } from "../integrations/tanstack-query/api-admin.functions";

/**
 * Admin-only takedown for a live game listing. Game-only listings have no edit page (their data is
 * the developer's atmosphere.games record), so this is the moderation path once a game has left
 * the pending queue. The game returns to the queue as "resubmitted" when its record changes.
 */
export function RejectGameDialog({
  listingId,
  listingName,
}: {
  listingId: string;
  listingName: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [reason, setReason] = useState("");
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const rejectMutation = useMutation({
    mutationFn: async () =>
      adminApi.setListingVerification({
        data: { listingId, status: "rejected", notes: reason.trim() },
      }),
    onSuccess: async () => {
      setIsOpen(false);
      await queryClient.invalidateQueries({ queryKey: ["storeListings"] });
      await queryClient.invalidateQueries({ queryKey: ["admin"] });
      // The listing is no longer public, so its page would 404.
      await navigate({ to: "/games" });
    },
  });

  return (
    <Dialog
      isOpen={isOpen}
      onOpenChange={setIsOpen}
      trigger={
        <Button variant="critical-outline" size="sm">
          Reject game
        </Button>
      }
    >
      <DialogHeader>Reject {listingName}?</DialogHeader>
      <DialogDescription>
        The game is hidden from AT Store. It comes back to the pending queue if
        the developer updates their atmosphere.games record.
      </DialogDescription>
      <DialogBody>
        <TextArea
          label="Rejection reason"
          placeholder="Explain why — required to reject."
          rows={3}
          value={reason}
          onChange={setReason}
        />
        {rejectMutation.isError ? (
          <SmallBody variant="critical">
            {rejectMutation.error instanceof Error
              ? rejectMutation.error.message
              : "Couldn't reject this game."}
          </SmallBody>
        ) : null}
      </DialogBody>
      <DialogFooter>
        <Button slot="close" variant="secondary">
          Cancel
        </Button>
        <Button
          variant="critical"
          isPending={rejectMutation.isPending}
          isDisabled={reason.trim().length === 0 || rejectMutation.isPending}
          onPress={() => rejectMutation.mutate()}
        >
          Reject
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
