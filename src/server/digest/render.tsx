import { render } from "@react-email/render";

import type { DigestData } from "./builder";

import { WeeklyDigestEmail } from "./emails/WeeklyDigestEmail";
import { WelcomeEmail } from "./emails/WelcomeEmail";

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const WEEK_LABEL_FMT = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

function digestWeekLabel(now: Date): string {
  return `Week of ${WEEK_LABEL_FMT.format(new Date(now.getTime() - WEEK_MS))}`;
}

async function renderBoth(element: React.ReactElement) {
  const [html, text] = await Promise.all([
    render(element),
    render(element, { plainText: true }),
  ]);
  return { html, text };
}

export async function renderDigestEmail(
  digest: DigestData,
  options: { baseUrl: string; unsubscribeUrl?: string; now?: Date },
): Promise<RenderedEmail> {
  const weekLabel = digestWeekLabel(options.now ?? new Date());
  const { html, text } = await renderBoth(
    <WeeklyDigestEmail
      baseUrl={options.baseUrl}
      weekLabel={weekLabel}
      newApps={digest.newApps}
      trendingApps={digest.trendingApps}
      unsubscribeUrl={options.unsubscribeUrl}
    />,
  );
  return { subject: `New & trending on AT Store · ${weekLabel}`, html, text };
}

export async function renderWelcomeEmail(options: {
  baseUrl: string;
  displayName?: string | null;
  unsubscribeUrl?: string;
}): Promise<RenderedEmail> {
  const { html, text } = await renderBoth(<WelcomeEmail {...options} />);
  return {
    subject: "You’re subscribed to the AT Store weekly digest",
    html,
    text,
  };
}
