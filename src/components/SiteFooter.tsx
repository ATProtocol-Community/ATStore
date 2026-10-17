import { createLink } from "@tanstack/react-router";

import { Footer } from "../design-system/footer";
import { Link } from "../design-system/link";
import { AtStoreLogo } from "./AtStoreLogo";

const FooterLink = createLink(Link);

const FOOTER_LINK_GROUPS = [
  {
    links: [
      { href: "/about", label: "About" },
      { href: "/", label: "Home" },
      { href: "/developers/atproto", label: "Developer API" },
      { href: "/products/manage", label: "Manage listings" },
    ],
  },
  {
    title: "Apps",
    links: [
      { href: "/apps", label: "Browse apps" },
      { href: "/apps/tags", label: "Tags" },
      { href: "/apps/lexicons", label: "Shared data" },
    ],
  },
] as const;

export function SiteFooter() {
  return (
    <Footer.Root>
      <Footer.Section>
        <Footer.Logo>
          <AtStoreLogo />
        </Footer.Logo>
        <Footer.NavSection>
          {FOOTER_LINK_GROUPS.map((group, index) => (
            <Footer.NavGroup
              key={"title" in group ? group.title : `links-${index}`}
              title={"title" in group ? group.title : undefined}
            >
              {group.links.map((link) => (
                <FooterLink key={link.href} to={link.href as never}>
                  {link.label}
                </FooterLink>
              ))}
            </Footer.NavGroup>
          ))}
        </Footer.NavSection>
      </Footer.Section>

      <Footer.Section>
        <Footer.Copyright>
          {new Date().getFullYear()} at-store Copyright. All rights reserved.
        </Footer.Copyright>
      </Footer.Section>
    </Footer.Root>
  );
}
