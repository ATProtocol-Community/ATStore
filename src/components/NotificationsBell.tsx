import * as stylex from "@stylexjs/stylex";
import { useQuery } from "@tanstack/react-query";
import { createLink } from "@tanstack/react-router";
import { user } from "#/integrations/tanstack-query/api-user.functions.ts";
import { Bell } from "lucide-react";

import { IconButton } from "../design-system/icon-button";
import { criticalColor } from "../design-system/theme/color.stylex";
import { size } from "../design-system/theme/semantic-spacing.stylex";

const IconButtonLink = createLink(IconButton);

const styles = stylex.create({
  unreadDotWrapper: {
    position: "relative",
  },
  unreadDot: {
    borderColor: "white",
    borderRadius: "999px",
    borderStyle: "solid",
    borderWidth: 2,
    backgroundColor: criticalColor.solid1,
    pointerEvents: "none",
    position: "absolute",
    height: size.xs,
    right: "-2px",
    top: "-2px",
    width: size.xs,
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
      {unreadCount > 0 && <span {...stylex.props(styles.unreadDot)} />}
    </div>
  );
}
