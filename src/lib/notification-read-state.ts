import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";

import type { ProductNotification } from "#/integrations/tanstack-query/api-notification.functions";
import { notificationApi } from "#/integrations/tanstack-query/api-notification.functions";

export function countUnreadNotifications(
  notifications: ProductNotification[],
  lastReadAt: string | null | undefined,
) {
  const lastReadMs =
    lastReadAt != null ? Date.parse(lastReadAt) : Number.NaN;
  if (!Number.isFinite(lastReadMs)) {
    return notifications.length;
  }
  return notifications.filter((item) => Date.parse(item.createdAt) > lastReadMs).length;
}

/** Read timestamps and unread counts come from Postgres (`user.notifications_read_at`). */
export function useNotificationReadState(
  sessionDid: string | null | undefined,
  notifications: ProductNotification[],
) {
  const queryClient = useQueryClient();
  const { data: readState, isPending: isReadAtPending } = useQuery({
    ...notificationApi.getNotificationsReadAtQueryOptions(),
    enabled: Boolean(sessionDid),
  });

  const lastReadAt = readState?.readAtIso ?? undefined;

  const unreadCount = useMemo(() => {
    if (!sessionDid) {
      return 0;
    }
    if (isReadAtPending) {
      return 0;
    }
    return countUnreadNotifications(notifications, lastReadAt);
  }, [isReadAtPending, lastReadAt, notifications, sessionDid]);

  const markMutation = useMutation({
    mutationFn: async () => {
      if (!sessionDid) {
        return;
      }
      const newestCreatedAt =
        notifications.length > 0
          ? notifications
              .map((item) => item.createdAt)
              .sort((a, b) => Date.parse(b) - Date.parse(a))[0]
          : new Date().toISOString();
      await notificationApi.markNotificationsRead({
        data: { readAtIso: newestCreatedAt },
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  const markAllRead = useCallback(() => {
    markMutation.mutate();
  }, [markMutation]);

  return {
    lastReadAt: lastReadAt ?? null,
    unreadCount,
    markAllRead,
  };
}
