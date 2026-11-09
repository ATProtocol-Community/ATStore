import * as stylex from "@stylexjs/stylex";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { Mail, Settings } from "lucide-react";
import { useState } from "react";

import {
  AlertDialog,
  AlertDialogActionButton,
  AlertDialogCancelButton,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
} from "../design-system/alert-dialog";
import { Button } from "../design-system/button";
import { Dialog, DialogHeader } from "../design-system/dialog";
import { Flex } from "../design-system/flex";
import { Page } from "../design-system/page";
import { Switch } from "../design-system/switch";
import { primaryColor, uiColor } from "../design-system/theme/color.stylex";
import { radius } from "../design-system/theme/radius.stylex";
import {
  gap,
  horizontalSpace,
  size,
  verticalSpace,
} from "../design-system/theme/semantic-spacing.stylex";
import { Text } from "../design-system/typography/text";
import { auth } from "../integrations/tanstack-query/api-auth.functions";
import { user } from "../integrations/tanstack-query/api-user.functions";
import { useEnableWeeklyDigest } from "../lib/useEnableWeeklyDigest";

const styles = stylex.create({
  group: {
    gap: gap["xl"],
    display: "flex",
    flexDirection: "column",
    paddingBottom: verticalSpace["10xl"],
  },
  card: {
    borderColor: uiColor.border1,
    borderRadius: radius.xl,
    borderStyle: "solid",
    borderWidth: 1,
    cornerShape: "squircle",
    gap: gap["3xl"],
    alignItems: "flex-start",
    backgroundColor: uiColor.bg,
    display: "flex",
    paddingBottom: verticalSpace["4xl"],
    paddingLeft: horizontalSpace["4xl"],
    paddingRight: horizontalSpace["4xl"],
    paddingTop: verticalSpace["4xl"],
  },
  icon: {
    borderColor: primaryColor.border1,
    borderRadius: radius.md,
    borderStyle: "solid",
    borderWidth: 1,
    alignItems: "center",
    backgroundColor: primaryColor.component1,
    color: primaryColor.text1,
    display: "flex",
    flexShrink: 0,
    justifyContent: "center",
    height: size["4xl"],
    width: size["4xl"],
  },
  rowText: {
    flexGrow: 1,
    minWidth: 0,
  },
  previewAction: {
    marginTop: verticalSpace["md"],
  },
  hiddenTrigger: {
    display: "none",
  },
  preview: {
    borderWidth: 0,
    display: "block",
    height: "70vh",
    width: "100%",
  },
});

export const Route = createFileRoute("/_header-layout/settings")({
  loader: async ({ context }) => {
    const session = await context.queryClient.ensureQueryData(
      user.getSessionQueryOptions,
    );
    if (!session?.user?.did) {
      throw redirect({
        to: "/login",
        search: { redirect: "/settings" },
      });
    }
    await context.queryClient.ensureQueryData(
      user.getWeeklyDigestStatusQueryOptions,
    );
    return {};
  },
  component: SettingsPage,
  head: () => ({ meta: [{ title: "Settings | at-store" }] }),
});

function SettingsPage() {
  const queryClient = useQueryClient();
  const { data: status } = useQuery(user.getWeeklyDigestStatusQueryOptions);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const enable = useEnableWeeklyDigest();
  const disable = useMutation({
    mutationFn: () => auth.disableWeeklyDigest(),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: user.getWeeklyDigestStatusQueryOptions.queryKey,
      }),
  });

  const enabled = status?.enabled === true;

  return (
    <Page.Root variant="small">
      <Page.Header>
        <Page.Title>
          <Flex align="center" gap="md">
            <Settings size={22} />
            Settings
          </Flex>
        </Page.Title>
      </Page.Header>

      <section {...stylex.props(styles.group)}>
        <Text size="sm" weight="semibold" variant="secondary">
          Email
        </Text>
        <div {...stylex.props(styles.card)}>
          <div {...stylex.props(styles.icon)}>
            <Mail size={18} />
          </div>
          <Flex direction="column" gap="lg" style={styles.rowText}>
            <Text weight="semibold">Weekly digest</Text>
            <Text size="sm" variant="secondary">
              {enabled
                ? `New and trending apps, every Monday to ${status?.email ?? "your account email"}.`
                : "New and trending apps, once a week. Turning this on asks your PDS to share your account email."}
            </Text>
            <Flex style={styles.previewAction}>
              <Button
                size="sm"
                variant="secondary"
                onPress={() => setPreviewOpen(true)}
              >
                Preview this week’s digest
              </Button>
            </Flex>
          </Flex>
          <Switch
            aria-label="Weekly digest email"
            isSelected={enabled}
            isDisabled={enable.isPending || disable.isPending}
            onChange={(next) => {
              if (next) setConfirmOpen(true);
              else disable.mutate();
            }}
          />
        </div>
      </section>

      <AlertDialog
        isOpen={confirmOpen}
        onOpenChange={setConfirmOpen}
        trigger={
          <button
            type="button"
            tabIndex={-1}
            aria-hidden
            {...stylex.props(styles.hiddenTrigger)}
          />
        }
      >
        <AlertDialogHeader>Turn on the weekly digest</AlertDialogHeader>
        <AlertDialogDescription>
          We’ll send you to your PDS to approve sharing your account email with
          AT Store. It’s only used for the weekly digest, and every email has a
          one-click unsubscribe link.
        </AlertDialogDescription>
        <AlertDialogFooter>
          <AlertDialogCancelButton>Not now</AlertDialogCancelButton>
          <AlertDialogActionButton
            closeOnPress={false}
            isPending={enable.isPending}
            onPress={() => enable.mutate()}
          >
            Continue to approve
          </AlertDialogActionButton>
        </AlertDialogFooter>
      </AlertDialog>

      <Dialog
        size="lg"
        isOpen={previewOpen}
        onOpenChange={setPreviewOpen}
        trigger={
          <button
            type="button"
            tabIndex={-1}
            aria-hidden
            {...stylex.props(styles.hiddenTrigger)}
          />
        }
      >
        <DialogHeader>This week’s digest</DialogHeader>
        {previewOpen ? (
          <iframe
            title="Weekly digest preview"
            src="/api/digest/preview"
            {...stylex.props(styles.preview)}
          />
        ) : null}
      </Dialog>
    </Page.Root>
  );
}
