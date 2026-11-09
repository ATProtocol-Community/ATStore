import type { WeeklyDigestStatus } from "#/integrations/tanstack-query/api-user.functions";

import * as stylex from "@stylexjs/stylex";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "@tanstack/react-router";
import { user } from "#/integrations/tanstack-query/api-user.functions";
import { useEnableWeeklyDigest } from "#/lib/useEnableWeeklyDigest";
import { Mail } from "lucide-react";

import { Alert } from "../design-system/alert";
import { Button } from "../design-system/button";
import { verticalSpace } from "../design-system/theme/semantic-spacing.stylex";

const styles = stylex.create({
  banner: {
    marginBottom: verticalSpace["3xl"],
  },
});

/**
 * One-time banner offering the weekly digest to signed-in users. Closing it (or
 * subscribing) is recorded server-side so it never shows again; after that the
 * digest lives in Settings.
 */
export function WeeklyDigestBanner() {
  const queryClient = useQueryClient();
  const location = useLocation();
  const { data: session } = useQuery(user.getSessionQueryOptions);
  const { data: status } = useQuery({
    ...user.getWeeklyDigestStatusQueryOptions,
    enabled: session?.user != null,
  });
  const enable = useEnableWeeklyDigest();
  const dismiss = useMutation({
    mutationFn: () => user.dismissWeeklyDigestPrompt(),
    onMutate: () => {
      queryClient.setQueryData<WeeklyDigestStatus>(
        user.getWeeklyDigestStatusQueryOptions.queryKey,
        (current) => (current ? { ...current, showPrompt: false } : current),
      );
    },
  });

  if (
    !session?.user ||
    !status?.showPrompt ||
    location.pathname.startsWith("/settings")
  ) {
    return null;
  }

  return (
    <Alert
      icon={<Mail />}
      title="Get new & trending apps in your inbox"
      action={
        <Button
          size="sm"
          variant="primary"
          isPending={enable.isPending}
          onPress={() => enable.mutate()}
        >
          Subscribe
        </Button>
      }
      onDismiss={() => dismiss.mutate()}
      style={styles.banner}
    >
      A short weekly email of the apps that joined AT Store and what’s trending.
      Your PDS will ask to share your account email. You can turn it off any
      time in Settings.
    </Alert>
  );
}
