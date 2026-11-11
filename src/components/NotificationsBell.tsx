import * as stylex from "@stylexjs/stylex";
import { useQuery } from "@tanstack/react-query";
import { createLink } from "@tanstack/react-router";
import { user } from "#/integrations/tanstack-query/api-user.functions.ts";
import { Bell } from "lucide-react";

import { IconButton } from "../design-system/icon-button";
import { criticalColor, uiColor } from "../design-system/theme/color.stylex";

const IconButtonLink = createLink(IconButton);

const styles = stylex.create({
  unreadDotWrapper: {
    position: "relative",
  },
  // Shelf: a small dot tucked into the bell's top-right, ringed in the
  // header surface so it reads as a cut-out rather than a sticker.
  unreadDot: {
    borderRadius: "999px",
    backgroundColor: criticalColor.solid1,
    boxShadow: `0 0 0 2px ${uiColor.bg}`,
    pointerEvents: "none",
    position: "absolute",
    height: 8,
    right: 9,
    top: 9,
    width: 8,
  },
});

export interface NotificationsBellProps {
  unreadCount: number;
}

export function NotificationsBell({ unreadCount }: NotificationsBellProps) {
  const { data: session } = useQuery(user.getSessionQueryOptions);

  if (!session?.user?.did) {
    return null;
  }

  return (
    <div {...stylex.props(styles.unreadDotWrapper)}>
      <IconButtonLink
        to="/notifications"
        size="lg"
        label="Notifications"
        variant="tertiary"
      >
        <Bell />
      </IconButtonLink>
      {unreadCount > 0 && (
        <span aria-hidden {...stylex.props(styles.unreadDot)} />
      )}
    </div>
  );
}
