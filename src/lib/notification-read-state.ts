import { useCallback, useEffect, useMemo, useState } from "react";

import type { ProductNotification } from "#/integrations/tanstack-query/api-notification.functions";

const READ_AT_KEY_PREFIX = "at-store:notifications:read-at:";

function getReadAtStorageKey(did: string) {
  return `${READ_AT_KEY_PREFIX}${did}`;
}

function toMillis(value: string | null | undefined) {
  if (!value) {
    return Number.NaN;
  }
  return Date.parse(value);
}

function readLastReadAt(did: string) {
  if (typeof window === "undefined") {
    return null;
  }
  return window.localStorage.getItem(getReadAtStorageKey(did));
}

function writeLastReadAt(did: string, isoDate: string) {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(getReadAtStorageKey(did), isoDate);
}

export function countUnreadNotifications(
  notifications: ProductNotification[],
  lastReadAt: string | null,
) {
  const lastReadMs = toMillis(lastReadAt);
  if (!Number.isFinite(lastReadMs)) {
    return notifications.length;
  }
  return notifications.filter((item) => toMillis(item.createdAt) > lastReadMs).length;
}

export function useNotificationReadState(
  sessionDid: string | null | undefined,
  notifications: ProductNotification[],
) {
  const [lastReadAt, setLastReadAt] = useState<string | null>(null);

  useEffect(() => {
    if (!sessionDid) {
      setLastReadAt(null);
      return;
    }
    setLastReadAt(readLastReadAt(sessionDid));
  }, [sessionDid]);

  const unreadCount = useMemo(() => {
    if (!sessionDid) {
      return 0;
    }
    return countUnreadNotifications(notifications, lastReadAt);
  }, [lastReadAt, notifications, sessionDid]);

  const markAllRead = useCallback(() => {
    if (!sessionDid) {
      return;
    }
    const newestCreatedAt =
      notifications.length > 0
        ? notifications
            .map((item) => item.createdAt)
            .sort((a, b) => Date.parse(b) - Date.parse(a))[0]
        : new Date().toISOString();
    writeLastReadAt(sessionDid, newestCreatedAt);
    setLastReadAt(newestCreatedAt);
  }, [notifications, sessionDid]);

  return {
    lastReadAt,
    unreadCount,
    markAllRead,
  };
}
