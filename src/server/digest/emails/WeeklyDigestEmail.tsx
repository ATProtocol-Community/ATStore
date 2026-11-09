import {
  Body,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import * as React from "react";

import type { DigestApp } from "../builder";

import {
  AppIcon,
  EmailFooter,
  EmailHead,
  EmailHeader,
  EmailShell,
  SectionLabel,
} from "./shared";
import { c, sans } from "./theme";

export interface WeeklyDigestEmailProps {
  baseUrl: string;
  weekLabel: string;
  newApps: Array<DigestApp>;
  trendingApps: Array<DigestApp>;
  unsubscribeUrl?: string;
}

function AppRow({ app, rank }: { app: DigestApp; rank?: number }) {
  const meta =
    app.rating == null
      ? null
      : `★ ${app.rating.toFixed(1)} · ${app.reviewCount} review${app.reviewCount === 1 ? "" : "s"}`;
  return (
    <table
      role="presentation"
      width="100%"
      cellPadding={0}
      cellSpacing={0}
      border={0}
      style={{ marginBottom: "16px" }}
    >
      <tbody>
        <tr>
          {rank == null ? null : (
            <td
              width="28"
              valign="middle"
              className="d-muted"
              style={{
                fontFamily: sans,
                fontWeight: 700,
                fontSize: "15px",
                color: c.muted,
              }}
            >
              {rank}
            </td>
          )}
          <td width="56" valign="middle">
            <Link href={app.url}>
              <AppIcon name={app.name} iconUrl={app.iconUrl} size={44} />
            </Link>
          </td>
          <td valign="middle">
            <Link
              href={app.url}
              className="d-ink"
              style={{
                fontFamily: sans,
                fontWeight: 600,
                fontSize: "16px",
                color: c.ink,
                textDecoration: "none",
              }}
            >
              {app.name}
            </Link>
            {app.tagline ? (
              <Text
                className="d-soft"
                style={{
                  fontFamily: sans,
                  fontSize: "14px",
                  lineHeight: "20px",
                  color: c.soft,
                  margin: "2px 0 0",
                }}
              >
                {app.tagline}
              </Text>
            ) : null}
            {meta ? (
              <Text
                className="d-muted"
                style={{
                  fontFamily: sans,
                  fontSize: "12px",
                  color: c.muted,
                  margin: "2px 0 0",
                }}
              >
                {meta}
              </Text>
            ) : null}
          </td>
          <td width="64" align="right" valign="middle">
            <Link
              href={app.url}
              className="d-accent"
              style={{
                fontFamily: sans,
                fontWeight: 600,
                fontSize: "14px",
                color: c.accent,
                textDecoration: "none",
              }}
            >
              View →
            </Link>
          </td>
        </tr>
      </tbody>
    </table>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <Section
      className="d-card"
      style={{
        background: c.card,
        border: `1px solid ${c.line}`,
        borderRadius: "16px",
        padding: "20px 20px 4px",
        marginBottom: "20px",
      }}
    >
      {children}
    </Section>
  );
}

export function WeeklyDigestEmail({
  baseUrl,
  weekLabel,
  newApps,
  trendingApps,
  unsubscribeUrl,
}: WeeklyDigestEmailProps) {
  return (
    <Html lang="en">
      <EmailHead />
      <Preview>New and trending apps on AT Store this week.</Preview>
      <Body className="d-bg" style={{ margin: 0 }}>
        <EmailShell>
          <EmailHeader baseUrl={baseUrl} label={weekLabel} />

          {newApps.length > 0 ? (
            <Card>
              <SectionLabel>New this week</SectionLabel>
              {newApps.map((app) => (
                <AppRow key={app.id} app={app} />
              ))}
            </Card>
          ) : null}

          {trendingApps.length > 0 ? (
            <Card>
              <SectionLabel>Trending</SectionLabel>
              {trendingApps.map((app, i) => (
                <AppRow key={app.id} app={app} rank={i + 1} />
              ))}
            </Card>
          ) : null}

          <Text style={{ textAlign: "center", margin: "8px 0 0" }}>
            <Link
              href={`${baseUrl}/apps/all`}
              className="d-accent"
              style={{
                fontFamily: sans,
                fontWeight: 600,
                fontSize: "14px",
                color: c.accent,
                textDecoration: "none",
              }}
            >
              Browse all apps →
            </Link>
          </Text>

          <EmailFooter baseUrl={baseUrl} unsubscribeUrl={unsubscribeUrl} />
        </EmailShell>
      </Body>
    </Html>
  );
}
