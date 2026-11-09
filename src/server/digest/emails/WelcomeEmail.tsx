import {
  Body,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from "@react-email/components";

import { EmailFooter, EmailHead, EmailHeader, EmailShell } from "./shared";
import { c, sans } from "./theme";

export interface WelcomeEmailProps {
  baseUrl: string;
  displayName?: string | null;
  unsubscribeUrl?: string;
}

const paragraph = {
  fontFamily: sans,
  fontSize: "15px",
  lineHeight: "23px",
  color: c.ink,
  margin: "0 0 14px",
};

export function WelcomeEmail({
  baseUrl,
  displayName,
  unsubscribeUrl,
}: WelcomeEmailProps) {
  const name = displayName?.trim();
  return (
    <Html lang="en">
      <EmailHead />
      <Preview>You’re in — here’s what to expect each week.</Preview>
      <Body className="d-bg" style={{ margin: 0 }}>
        <EmailShell>
          <EmailHeader baseUrl={baseUrl} />
          <Section
            className="d-card"
            style={{
              background: c.card,
              border: `1px solid ${c.line}`,
              borderRadius: "16px",
              padding: "24px",
            }}
          >
            <Text
              className="d-ink"
              style={{ ...paragraph, fontSize: "20px", fontWeight: 700 }}
            >
              {name ? `Welcome, ${name}!` : "Welcome!"}
            </Text>
            <Text className="d-ink" style={paragraph}>
              You’re subscribed to the AT Store weekly digest. Once a week we’ll
              send you a short email with:
            </Text>
            <Text className="d-ink" style={paragraph}>
              • <strong>New apps</strong> that joined the store that week
              <br />• <strong>Trending apps</strong> people are favoriting,
              reviewing, and talking about
            </Text>
            <Text className="d-ink" style={{ ...paragraph, margin: 0 }}>
              In the meantime,{" "}
              <Link
                href={`${baseUrl}/apps/all`}
                className="d-accent"
                style={{ color: c.accent, fontWeight: 600 }}
              >
                browse the store
              </Link>
              .
            </Text>
          </Section>
          <EmailFooter baseUrl={baseUrl} unsubscribeUrl={unsubscribeUrl} />
        </EmailShell>
      </Body>
    </Html>
  );
}
