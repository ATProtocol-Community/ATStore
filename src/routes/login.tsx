import type { SavedHandle } from "#/utils/saved-handles";

import * as stylex from "@stylexjs/stylex";
import { useMutation } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { auth } from "#/integrations/tanstack-query/api-auth.functions";
import { buildRouteOgMeta } from "#/lib/og-meta";
import { unauthMiddleware } from "#/middleware/auth";
import { getSavedHandles, saveHandle } from "#/utils/saved-handles";
import { ChevronRight, Minus, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import {
  Button as AriaButton,
  Disclosure as AriaDisclosure,
  DisclosurePanel as AriaDisclosurePanel,
  Link as AriaLink,
} from "react-aria-components";
import { z } from "zod";

import { AtStoreLogo } from "../components/AtStoreLogo";
import { SiteFooter } from "../components/SiteFooter";
import { SiteHeader } from "../components/SiteHeader";
import { UserHandleAutocomplete } from "../components/user-handle-autocomplete";
import { Avatar } from "../design-system/avatar";
import { Button } from "../design-system/button";
import { Form } from "../design-system/form";
import { HeaderLayout } from "../design-system/header-layout";
import { animationDuration } from "../design-system/theme/animations.stylex";
import { criticalColor, uiColor } from "../design-system/theme/color.stylex";
import { breakpoints } from "../design-system/theme/media-queries.stylex";
import {
  fontFamily,
  fontWeight,
} from "../design-system/theme/typography.stylex";

const searchSchema = z.object({
  redirect: z.string().optional(),
  loginSuccess: z.union([z.string(), z.boolean()]).optional(),
  handle: z.string().optional(),
  avatar: z.string().optional(),
  error: z.string().optional(),
});

const styles = stylex.create({
  page: {
    paddingBlock: { default: 32, [breakpoints.md]: 48 },
    alignItems: "center",
    boxSizing: "border-box",
    display: "flex",
    flexDirection: "column",
    fontFamily: fontFamily.sans,
    justifyContent: "center",
    rowGap: 24,
    minHeight: "calc(100vh - 160px)",
  },
  logo: {
    color: uiColor.text2,
    fontSize: 26,
  },
  card: {
    padding: { default: 20, [breakpoints.md]: 28 },
    borderColor: uiColor.border1,
    borderRadius: 20,
    borderStyle: "solid",
    borderWidth: 1,
    backgroundColor: uiColor.bg,
    boxSizing: "border-box",
    display: "block",
    width: "min(420px, 100%)",
  },
  title: {
    color: uiColor.text2,
    fontFamily: fontFamily.title,
    fontSize: 32,
    fontWeight: 750,
    letterSpacing: "-0.025em",
    lineHeight: 1.1,
    marginBottom: 8,
    marginTop: 0,
  },
  intro: {
    color: uiColor.text1,
    lineHeight: 1.45,
    marginBottom: 22,
    marginTop: 0,
  },
  error: {
    borderColor: criticalColor.border1,
    borderRadius: 12,
    borderStyle: "solid",
    borderWidth: 1,
    paddingBlock: 10,
    paddingInline: 14,
    backgroundColor: criticalColor.bgSubtle,
    color: criticalColor.text2,
    fontSize: 14,
    marginBottom: 18,
    marginTop: 0,
  },
  savedList: {
    display: "flex",
    flexDirection: "column",
    rowGap: 8,
  },
  saved: {
    padding: 12,
    borderColor: {
      default: uiColor.border2,
      ":hover": uiColor.text2,
    },
    borderRadius: 14,
    borderStyle: "solid",
    borderWidth: 1,
    textDecoration: "none",
    alignItems: "center",
    backgroundColor: uiColor.bgSubtle,
    boxSizing: "border-box",
    color: uiColor.text2,
    columnGap: 12,
    display: "flex",
    outlineOffset: 2,
    transitionDuration: animationDuration.default,
    transitionProperty: "border-color",
    width: "100%",
  },
  savedText: {
    display: "flex",
    flexDirection: "column",
    flexGrow: 1,
    fontSize: 14,
    minWidth: 0,
  },
  savedHandle: {
    overflow: "hidden",
    fontWeight: fontWeight.semibold,
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  savedHint: {
    color: uiColor.text1,
  },
  savedChevron: {
    color: uiColor.text1,
    flexShrink: 0,
  },
  or: {
    marginBlock: 20,
    alignItems: "center",
    color: uiColor.text1,
    columnGap: 12,
    display: "flex",
    fontSize: 13,
    "::after": {
      backgroundColor: uiColor.border1,
      content: "''",
      flexGrow: 1,
      height: 1,
    },
    "::before": {
      backgroundColor: uiColor.border1,
      content: "''",
      flexGrow: 1,
      height: 1,
    },
  },
  submit: {
    marginTop: 18,
    width: "100%",
  },
  guide: {
    color: uiColor.text1,
    fontSize: 13,
    marginTop: 20,
  },
  guideTrigger: {
    padding: 0,
    borderRadius: 6,
    borderWidth: 0,
    alignItems: "center",
    backgroundColor: "transparent",
    color: {
      default: uiColor.text1,
      ":hover": uiColor.text2,
    },
    columnGap: 6,
    cursor: "pointer",
    display: "inline-flex",
    fontFamily: "inherit",
    fontSize: 13,
  },
  guideList: {
    color: uiColor.text1,
    lineHeight: 1.6,
    marginBottom: 0,
    marginTop: 10,
    paddingLeft: 18,
  },
  guideItem: {
    marginBottom: 6,
  },
  guideStrong: {
    color: uiColor.text2,
    fontWeight: fontWeight.semibold,
  },
  code: {
    fontFamily: fontFamily.mono,
    fontSize: "0.92em",
  },
  inlineLink: {
    textDecoration: "underline",
    color: uiColor.text2,
    textDecorationColor: {
      default: uiColor.border2,
      ":hover": "currentColor",
    },
    textUnderlineOffset: 3,
  },
  signup: {
    margin: 0,
    color: uiColor.text1,
    textAlign: "center",
  },
  signupButton: {
    padding: 0,
    borderWidth: 0,
    textDecoration: "underline",
    backgroundColor: "transparent",
    color: {
      default: uiColor.text2,
      ":disabled": uiColor.text1,
    },
    cursor: "pointer",
    fontFamily: "inherit",
    fontSize: "inherit",
    textDecorationColor: {
      default: uiColor.border2,
      ":hover": "currentColor",
    },
    textUnderlineOffset: 3,
  },
});

export const Route = createFileRoute("/login")({
  validateSearch: searchSchema,
  server: {
    middleware: [unauthMiddleware],
  },
  loader: async ({ context, location }) => {
    const savedHandles = await context.queryClient.ensureQueryData(
      auth.getSavedHandlesQueryOptions,
    );
    return {
      savedHandles,
      redirects: await Promise.all(
        savedHandles.map((h) =>
          auth.authorize({
            data: {
              handle: h.handle,
              redirect: (location.search as Record<string, string>)["redirect"],
            },
          }),
        ),
      ),
    };
  },
  component: AuthPage,
  head: () =>
    buildRouteOgMeta({
      title: "Sign in | at-store",
      description:
        "Sign in to at-store with your AT Protocol identity to review apps, claim listings, and manage your store.",
    }),
});

function AuthPage() {
  const {
    redirect: redirectTo,
    loginSuccess,
    handle: handleParam,
    avatar: avatarParam,
    error,
  } = Route.useSearch();
  const { savedHandles: initialSavedHandles, redirects } =
    Route.useLoaderData();
  const navigate = useNavigate();

  const [handle, setHandle] = useState("");
  const [inputValue, setInputValue] = useState("");
  const [savedHandles, setSavedHandles] =
    useState<Array<SavedHandle>>(initialSavedHandles);

  useEffect(() => {
    if ((loginSuccess === "true" || loginSuccess === true) && handleParam) {
      const avatar =
        avatarParam && avatarParam.trim() !== "" ? avatarParam : null;

      saveHandle(handleParam, avatar);

      void navigate({
        to: "/login",
        search: { redirect: redirectTo },
        replace: true,
      }).then(() => {
        setSavedHandles(getSavedHandles());
      });
    }
  }, [loginSuccess, handleParam, avatarParam, navigate, redirectTo]);

  const loginMutation = useMutation({
    mutationFn: async (selectedHandle: string) => {
      await navigate({
        to: "/api/auth/atproto/authorize",
        search: {
          handle: selectedHandle,
          redirect: redirectTo,
        },
      });
    },
  });

  const handleSignup = useMutation({
    mutationFn: async () => {
      await navigate({
        to: "/api/auth/atproto/signup",
        search: {
          redirect: redirectTo,
        },
      });
    },
  });

  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const hasSavedHandles = savedHandles.length > 0;

  return (
    <HeaderLayout.Root>
      <HeaderLayout.Header>
        <SiteHeader />
      </HeaderLayout.Header>

      <HeaderLayout.Page>
        <div {...stylex.props(styles.page)}>
          <span {...stylex.props(styles.logo)}>
            <AtStoreLogo variant="hero" />
          </span>

          <Form style={styles.card}>
            <h1 {...stylex.props(styles.title)}>Log in</h1>
            <p {...stylex.props(styles.intro)}>
              Use your Atmosphere account, the same one you use for Bluesky.
            </p>

            {error === "oauth_failed" ? (
              <p role="alert" {...stylex.props(styles.error)}>
                Sign-in failed. Try again.
              </p>
            ) : null}

            {hasSavedHandles ? (
              <>
                <div {...stylex.props(styles.savedList)}>
                  {savedHandles.map((saved, index) => (
                    <AriaLink
                      key={saved.handle}
                      href={redirects[index]?.authorizationUrl ?? "#"}
                      aria-label={`Log in as @${saved.handle}`}
                      {...stylex.props(styles.saved)}
                    >
                      <Avatar
                        src={saved.avatar ?? undefined}
                        alt={saved.handle}
                        fallback={saved.handle[0]?.toUpperCase() ?? "?"}
                      />
                      <span {...stylex.props(styles.savedText)}>
                        <span {...stylex.props(styles.savedHandle)}>
                          @{saved.handle}
                        </span>
                        <span {...stylex.props(styles.savedHint)}>
                          Continue with this account
                        </span>
                      </span>
                      <ChevronRight
                        size={16}
                        aria-hidden
                        {...stylex.props(styles.savedChevron)}
                      />
                    </AriaLink>
                  ))}
                </div>
                <div {...stylex.props(styles.or)}>
                  <span>or another account</span>
                </div>
              </>
            ) : null}

            <UserHandleAutocomplete
              size="lg"
              placeholder="your.handle.com"
              label="Atmosphere account"
              value={inputValue}
              onValueChange={(value) => {
                setInputValue(value);
                setHandle(value);
              }}
              onSelect={(selectedHandle) => {
                const trimmed = selectedHandle.trim().replace(/^@/, "");
                if (trimmed === "") return;
                setInputValue(trimmed);
                setHandle(trimmed);
                loginMutation.mutate(trimmed);
              }}
            />

            <Button
              size="lg"
              type="button"
              isDisabled={!handle.trim() || loginMutation.isPending}
              isPending={loginMutation.isPending}
              onPress={() => {
                const trimmed = handle.trim().replace(/^@/, "");
                if (trimmed === "") return;
                loginMutation.mutate(trimmed);
              }}
              style={styles.submit}
            >
              Log in
            </Button>

            <AriaDisclosure
              isExpanded={isGuideOpen}
              onExpandedChange={setIsGuideOpen}
              {...stylex.props(styles.guide)}
            >
              <AriaButton slot="trigger" {...stylex.props(styles.guideTrigger)}>
                {isGuideOpen ? (
                  <Minus size={14} aria-hidden />
                ) : (
                  <Plus size={14} aria-hidden />
                )}
                How login works
              </AriaButton>
              <AriaDisclosurePanel>
                <ul {...stylex.props(styles.guideList)}>
                  <li {...stylex.props(styles.guideItem)}>
                    <strong {...stylex.props(styles.guideStrong)}>
                      Handle.
                    </strong>{" "}
                    Your unique identifier on the Atmosphere network (e.g.{" "}
                    <code {...stylex.props(styles.code)}>user.bsky.social</code>
                    ). It is how others find and mention you.
                  </li>
                  <li {...stylex.props(styles.guideItem)}>
                    <strong {...stylex.props(styles.guideStrong)}>
                      Authentication.
                    </strong>{" "}
                    You sign in with your Personal Data Server (PDS). at-store
                    does not store your password; authorization happens with
                    your PDS host.
                  </li>
                  <li {...stylex.props(styles.guideItem)}>
                    <strong {...stylex.props(styles.guideStrong)}>
                      Privacy.
                    </strong>{" "}
                    Your handle can be saved in this browser for convenience.
                    at-store does not have access to your account credentials
                    beyond what you authorize via OAuth.
                  </li>
                  <li {...stylex.props(styles.guideItem)}>
                    <strong {...stylex.props(styles.guideStrong)}>
                      Need an account?
                    </strong>{" "}
                    Use &quot;Create an account&quot; below to sign up on a PDS
                    host (e.g.{" "}
                    <a
                      href="https://selfhosted.social/"
                      target="_blank"
                      rel="noopener noreferrer"
                      {...stylex.props(styles.inlineLink)}
                    >
                      selfhosted.social
                    </a>
                    ).
                  </li>
                </ul>
              </AriaDisclosurePanel>
            </AriaDisclosure>
          </Form>

          <p {...stylex.props(styles.signup)}>
            New to the Atmosphere?{" "}
            <AriaButton
              onPress={() => handleSignup.mutate()}
              isDisabled={handleSignup.isPending || loginMutation.isPending}
              {...stylex.props(styles.signupButton)}
            >
              {handleSignup.isPending
                ? "Opening sign-up…"
                : "Create an account"}
            </AriaButton>
          </p>
        </div>
      </HeaderLayout.Page>

      <HeaderLayout.Footer>
        <SiteFooter />
      </HeaderLayout.Footer>
    </HeaderLayout.Root>
  );
}
