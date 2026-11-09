/**
 * Shared chrome for AT Store's digest emails: the dark-mode `<style>` head, the
 * fixed-width shell, header/footer, and the app icon tile. Layout is nested
 * `role="presentation"` tables with inline styles so it survives Gmail/Outlook.
 */

import {
  Container,
  Head,
  Hr,
  Img,
  Link,
  Section,
  Text,
} from "@react-email/components";
import * as React from "react";

import { c, iconTone, sans } from "./theme";

export function AppIcon({
  name,
  iconUrl,
  size,
}: {
  name: string;
  iconUrl: string | null;
  size: number;
}) {
  const radius = `${Math.round(size * 0.22)}px`;
  if (iconUrl) {
    return (
      <Img
        src={iconUrl}
        width={size}
        height={size}
        alt={`${name} icon`}
        style={{
          width: size,
          height: size,
          borderRadius: radius,
          display: "block",
        }}
      />
    );
  }
  return (
    <table
      role="presentation"
      width={String(size)}
      cellPadding={0}
      cellSpacing={0}
      border={0}
      style={{
        width: size,
        height: size,
        background: iconTone(name),
        borderRadius: radius,
      }}
    >
      <tbody>
        <tr>
          <td
            align="center"
            valign="middle"
            style={{
              height: size,
              fontFamily: sans,
              fontWeight: 700,
              fontSize: Math.round(size * 0.42),
              color: c.white,
            }}
          >
            {name.trim().charAt(0).toUpperCase() || "?"}
          </td>
        </tr>
      </tbody>
    </table>
  );
}

export function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <Text
      className="d-muted"
      style={{
        fontFamily: sans,
        fontWeight: 700,
        fontSize: "11px",
        letterSpacing: "0.14em",
        textTransform: "uppercase",
        color: c.muted,
        margin: "0 0 12px",
      }}
    >
      {children}
    </Text>
  );
}

export function EmailHead() {
  return (
    <Head>
      <meta name="color-scheme" content="light dark" />
      <meta name="supported-color-schemes" content="light dark" />
      <style>{`
        @media (prefers-color-scheme: dark) {
          .d-bg      { background:#111113 !important; }
          .d-card    { background:#18191b !important; border-color:#2e3135 !important; }
          .d-ink     { color:#edeef0 !important; }
          .d-soft    { color:#b0b4ba !important; }
          .d-muted   { color:#777b84 !important; }
          .d-accent  { color:#70b8ff !important; }
          .d-divider { border-color:#2e3135 !important; }
        }
        [data-ogsc] .d-bg      { background:#111113 !important; }
        [data-ogsc] .d-card    { background:#18191b !important; border-color:#2e3135 !important; }
        [data-ogsc] .d-ink     { color:#edeef0 !important; }
        [data-ogsc] .d-soft    { color:#b0b4ba !important; }
        [data-ogsc] .d-muted   { color:#777b84 !important; }
        [data-ogsc] .d-accent  { color:#70b8ff !important; }
        [data-ogsc] .d-divider { border-color:#2e3135 !important; }
        @media (max-width:620px) { .container { width:100% !important; } }
      `}</style>
    </Head>
  );
}

/**
 * Page background lives on this wrapper rather than `<Body>`: React Email moves
 * Body's inline style onto an inner cell but leaves `className` on `<body>`, so
 * the dark-mode class would never reach the painted background.
 */
export function EmailShell({ children }: { children: React.ReactNode }) {
  return (
    <table
      role="presentation"
      width="100%"
      cellPadding={0}
      cellSpacing={0}
      border={0}
      className="d-bg"
      style={{ background: c.page }}
    >
      <tbody>
        <tr>
          <td>
            <Container
              className="container"
              style={{
                width: "600px",
                maxWidth: "600px",
                margin: "0 auto",
                padding: "32px 20px",
              }}
            >
              {children}
            </Container>
          </td>
        </tr>
      </tbody>
    </table>
  );
}

export function EmailHeader({
  baseUrl,
  label,
}: {
  baseUrl: string;
  label?: string;
}) {
  return (
    <Section style={{ marginBottom: "24px" }}>
      <table
        role="presentation"
        width="100%"
        cellPadding={0}
        cellSpacing={0}
        border={0}
      >
        <tbody>
          <tr>
            <td align="left">
              <Link
                href={baseUrl}
                className="d-ink"
                style={{
                  fontFamily: sans,
                  fontWeight: 800,
                  fontSize: "20px",
                  color: c.ink,
                  textDecoration: "none",
                }}
              >
                AT Store
              </Link>
            </td>
            {label ? (
              <td
                align="right"
                className="d-muted"
                style={{ fontFamily: sans, fontSize: "13px", color: c.muted }}
              >
                {label}
              </td>
            ) : null}
          </tr>
        </tbody>
      </table>
    </Section>
  );
}

export function EmailFooter({
  baseUrl,
  unsubscribeUrl,
}: {
  baseUrl: string;
  unsubscribeUrl?: string;
}) {
  return (
    <Section style={{ marginTop: "32px" }}>
      <Hr
        className="d-divider"
        style={{ borderColor: c.line, margin: "0 0 16px" }}
      />
      <Text
        className="d-muted"
        style={{
          fontFamily: sans,
          fontSize: "12px",
          lineHeight: "18px",
          color: c.muted,
          margin: 0,
        }}
      >
        You’re getting this because you turned on the AT Store weekly digest.{" "}
        <Link
          href={`${baseUrl}/settings`}
          className="d-muted"
          style={{ color: c.muted }}
        >
          Manage settings
        </Link>
        {unsubscribeUrl ? (
          <>
            {" · "}
            <Link
              href={unsubscribeUrl}
              className="d-muted"
              style={{ color: c.muted }}
            >
              Unsubscribe
            </Link>
          </>
        ) : null}
      </Text>
    </Section>
  );
}
