import { useMutation } from "@tanstack/react-query";
import { useLocation } from "@tanstack/react-router";
import { auth } from "#/integrations/tanstack-query/api-auth.functions";

/**
 * Opt into the weekly digest: the server sets the flag, then we hand off to the
 * PDS consent screen to share the account email. The OAuth callback returns the
 * user to the current page.
 */
export function useEnableWeeklyDigest() {
  const location = useLocation();
  return useMutation({
    mutationFn: async () => {
      const result = await auth.upgradeToWeeklyDigest({
        data: { redirect: location.href },
      });
      globalThis.location.href = result.authorizationUrl;
    },
  });
}
