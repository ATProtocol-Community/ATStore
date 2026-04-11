import * as stylex from "@stylexjs/stylex";
import { useMutation } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ChevronRight, InfoIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { Link as AriaLink } from "react-aria-components";
import { z } from "zod";

import type { SavedHandle } from "#/utils/saved-handles";

import { AtStoreLogo } from "../components/AtStoreLogo";
import { UserHandleAutocomplete } from "../components/user-handle-autocomplete";
import { Avatar } from "../design-system/avatar";
import { Button } from "../design-system/button";
import {
  Dialog,
  DialogBody,
  DialogDescription,
  DialogHeader,
} from "../design-system/dialog";
import { Flex } from "../design-system/flex";
import { Form } from "../design-system/form";
import { IconButton } from "../design-system/icon-button";
import { Link } from "../design-system/link";
import { LinkContext } from "../design-system/link/link-context";
import { Separator } from "../design-system/separator";
import { primaryColor, uiColor } from "../design-system/theme/color.stylex";
import { breakpoints } from "../design-system/theme/media-queries.stylex";
import { radius } from "../design-system/theme/radius.stylex";
import { primary } from "../design-system/theme/semantic-color.stylex";
import {
  gap as gapSpace,
  size as sizeSpace,
  verticalSpace,
} from "../design-system/theme/semantic-spacing.stylex";
import { Body, InlineCode } from "../design-system/typography";
import { Text } from "../design-system/typography/text";
import { auth } from "#/integrations/tanstack-query/api-auth.functions";
import { unauthMiddleware } from "#/middleware/auth";
import { getSavedHandles, saveHandle } from "#/utils/saved-handles";

const searchSchema = z.object({
  redirect: z.string().optional(),
  loginSuccess: z.union([z.string(), z.boolean()]).optional(),
  handle: z.string().optional(),
  avatar: z.string().optional(),
});

const styles = stylex.create({
  main: {
    backgroundColor: primaryColor.bgSubtle,
    display: "flex",
    flexDirection: "column",
    position: "relative",
    minHeight: "100vh",
  },
  container: {
    padding: sizeSpace["10xl"],
    alignItems: "center",
    display: "flex",
    flexDirection: "column",
    flexGrow: 1,
    height: "100%",
  },
  content: {
    padding: sizeSpace["3xl"],
    gap: gapSpace["5xl"],
    alignItems: "center",
    display: "flex",
    flexDirection: "column",
  },
  form: {
    width: {
      default: "100%",
      [breakpoints.sm]: "min(80vw, 420px)",
    },
  },
  savedHandlesContainer: {
    width: {
      default: "100%",
      [breakpoints.sm]: "min(80vw, 420px)",
    },
  },
  savedHandleButton: {
    padding: sizeSpace.xxs,
    borderRadius: radius["lg"],
    cornerShape: "squircle",
    gap: gapSpace.xl,
    textDecoration: "none",
    alignItems: "center",
    boxSizing: "border-box",
    cursor: "pointer",
    display: "flex",
    flexDirection: "row",
    justifyContent: "flex-start",
    textAlign: "left",
    width: "100%",
  },
  savedHandleText: {
    flexGrow: 1,
    minWidth: 0,
  },
  savedHandleIcon: {
    color: uiColor.text1,
  },
  loginButton: {
    cursor: "pointer",
  },
  signupButton: {
    cursor: "pointer",
  },
  logoContainer: {
    paddingBottom: verticalSpace["lg"],
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
  head: () => ({ meta: [{ title: "Sign in" }] }),
});

function AuthPage() {
  const {
    redirect: redirectTo,
    loginSuccess,
    handle: handleParam,
    avatar: avatarParam,
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
      const authorizeUrl = new URL(
        "/api/auth/atproto/authorize",
        globalThis.location.origin,
      );
      authorizeUrl.searchParams.set("handle", selectedHandle);
      if (redirectTo) {
        authorizeUrl.searchParams.set("redirect", redirectTo);
      }

      globalThis.location.href = authorizeUrl.toString();
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

  const [view, setView] = useState<"saved-handles" | "login">(
    savedHandles.length > 0 ? "saved-handles" : "login",
  );

  return (
    <main {...stylex.props(styles.main)}>
      <div {...stylex.props(styles.container)}>
        <Form style={styles.content}>
          <Flex direction="column" gap="5xl" style={styles.form}>
            <Flex
              align="center"
              justify="center"
              gap="2xl"
              style={styles.logoContainer}
            >
              <AtStoreLogo variant="hero" />
            </Flex>

            {view === "saved-handles" && (
              <>
                <Flex
                  direction="column"
                  gap="md"
                  style={styles.savedHandlesContainer}
                >
                  {savedHandles.map((saved, index) => (
                    <AriaLink
                      key={saved.handle}
                      href={redirects[index]?.authorizationUrl ?? "#"}
                      {...stylex.props(
                        styles.savedHandleButton,
                        primary.bgUi,
                        primary.borderInteractive,
                        primary.text,
                      )}
                    >
                      <Avatar
                        src={saved.avatar ?? undefined}
                        alt={saved.handle}
                        fallback={saved.handle[0]?.toUpperCase() ?? "?"}
                      />
                      <Text size="base" style={styles.savedHandleText}>
                        {saved.handle}
                      </Text>
                      <ChevronRight {...stylex.props(styles.savedHandleIcon)} />
                    </AriaLink>
                  ))}
                </Flex>

                <Separator />
              </>
            )}

            {view === "login" && (
              <Flex direction="column" gap="md">
                <UserHandleAutocomplete
                  size="lg"
                  placeholder="your.handle.com"
                  label={
                    <Flex
                      direction="row"
                      gap="md"
                      align="center"
                      justify="between"
                    >
                      <Text size="sm">Atmosphere Account</Text>
                      <Dialog
                        trigger={
                          <IconButton
                            label="Info about handles and auth"
                            variant="tertiary"
                            size="sm"
                            onClick={(e) => e.preventDefault()}
                          >
                            <InfoIcon />
                          </IconButton>
                        }
                        size="md"
                      >
                        <DialogHeader>How login works</DialogHeader>
                        <DialogDescription>
                          Sign in with your AT Protocol account.
                        </DialogDescription>
                        <DialogBody>
                          <Flex direction="column" gap="5xl">
                            <Flex direction="column" gap="md">
                              <Text size="sm" weight="semibold">
                                What is a handle?
                              </Text>
                              <Body variant="secondary">
                                A handle is your unique identifier on the
                                ATmosphere network (e.g.{" "}
                                <InlineCode>user.bsky.social</InlineCode>
                                ). It is how others find and mention you.
                              </Body>
                            </Flex>

                            <Flex direction="column" gap="md">
                              <Text size="sm" weight="semibold">
                                Authentication
                              </Text>
                              <Body variant="secondary">
                                You sign in with your Personal Data Server
                                (PDS). at-store does not store your
                                password—authorization happens with your PDS
                                host.
                              </Body>
                            </Flex>

                            <Flex direction="column" gap="md">
                              <Text size="sm" weight="semibold">
                                Privacy
                              </Text>
                              <Body variant="secondary">
                                Your handle can be saved in this browser for
                                convenience. at-store does not have access to
                                your account credentials beyond what you
                                authorize via OAuth.
                              </Body>
                            </Flex>

                            <Flex direction="column" gap="md">
                              <Text size="sm" weight="semibold">
                                Need an account?
                              </Text>
                              <Body variant="secondary">
                                Use &quot;Create Account&quot; to sign up on a
                                PDS host (e.g.{" "}
                                <LinkContext value={{}}>
                                  <Link
                                    href="https://selfhosted.social/"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                  >
                                    selfhosted.social
                                  </Link>
                                </LinkContext>
                                ).
                              </Body>
                            </Flex>
                          </Flex>
                        </DialogBody>
                      </Dialog>
                    </Flex>
                  }
                  value={inputValue}
                  onValueChange={(value) => {
                    setInputValue(value);
                    setHandle(value);
                  }}
                  onSelect={(selectedHandle) => {
                    setInputValue(selectedHandle);
                    setHandle(selectedHandle);
                    loginMutation.mutate(selectedHandle);
                  }}
                />
              </Flex>
            )}

            <Flex direction="column" gap="md">
              {view === "saved-handles" && (
                <Button
                  size="lg"
                  variant="outline"
                  onPress={() => setView("login")}
                  isPending={handleSignup.isPending}
                  style={styles.signupButton}
                >
                  Switch account
                </Button>
              )}
              {view === "login" && (
                <Button
                  size="lg"
                  type="submit"
                  isDisabled={!handle.trim()}
                  isPending={loginMutation.isPending}
                  onPress={() => loginMutation.mutate(handle.trim())}
                  style={styles.loginButton}
                >
                  Log in
                </Button>
              )}
              <Button
                size="lg"
                variant="outline"
                onPress={() => handleSignup.mutate()}
                isPending={handleSignup.isPending}
                style={styles.signupButton}
              >
                Create account
              </Button>
            </Flex>
          </Flex>
        </Form>
      </div>
    </main>
  );
}
