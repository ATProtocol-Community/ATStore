/**
 * One-time "you're subscribed" email, sent from the OAuth callback the first
 * time a user who opted into the digest comes back with an email address.
 * Never throws — a failed welcome must not break sign-in.
 */

import { sendEmail } from "./comail";
import { digestUnsubscribeUrl, getDigestBaseUrl } from "./config";
import { renderWelcomeEmail } from "./render";
import { makeUnsubscribeToken } from "./unsubscribe-token";

export async function sendDigestWelcomeEmail(input: {
  userId: string;
  email: string;
  displayName?: string | null;
}): Promise<boolean> {
  try {
    const baseUrl = getDigestBaseUrl();
    const unsubscribeUrl = digestUnsubscribeUrl(
      baseUrl,
      makeUnsubscribeToken(input.userId),
    );
    const rendered = await renderWelcomeEmail({
      baseUrl,
      displayName: input.displayName,
      unsubscribeUrl,
    });
    const result = await sendEmail({
      to: input.email,
      ...rendered,
      unsubscribeUrl,
    });
    if (!result.ok) {
      console.warn(
        `[digest] welcome send failed for ${input.userId}: ${result.error ?? result.status}`,
      );
    }
    return result.ok;
  } catch (error) {
    console.warn(
      `[digest] welcome send threw for ${input.userId}:`,
      error instanceof Error ? error.message : String(error),
    );
    return false;
  }
}
