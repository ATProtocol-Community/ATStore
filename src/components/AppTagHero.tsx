import * as stylex from "@stylexjs/stylex";

import { Flex } from "../design-system/flex";
import { ui } from "../design-system/theme/semantic-color.stylex";
import { verticalSpace } from "../design-system/theme/semantic-spacing.stylex";
import { radius } from "../design-system/theme/radius.stylex";
import { Body, SmallBody } from "../design-system/typography";
import { Text } from "../design-system/typography/text";
import { resolveBannerRecordUrl } from "../lib/banner-record-url";
import { breakpoints } from "../design-system/theme/media-queries.stylex";

interface AppTagHeroProps {
  eyebrow?: string;
  title: string;
  description?: string;
  imageSrc?: string | null;
  action?: React.ReactNode;
}

const styles = stylex.create({
  root: {
    width: "100%",
  },
  imageFrame: {
    borderRadius: radius["2xl"],
    cornerShape: "squircle",
    maxHeight: "240px",
    overflow: "hidden",
    width: "100%",
  },
  image: {
    display: "block",
    height: {
      default: "140px",
      [breakpoints.sm]: "240px",
    },
    objectFit: "cover",
    objectPosition: "center",
    width: "100%",
  },
  imageFallback: {
    background:
      "linear-gradient(135deg, rgba(87, 112, 255, 0.18) 0%, rgba(229, 76, 180, 0.16) 50%, rgba(70, 195, 161, 0.16) 100%)",
    height: "240px",
    width: "100%",
  },
  copy: {
    paddingTop: {
      default: verticalSpace["2xl"],
      [breakpoints.sm]: verticalSpace["6xl"],
    },
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 0,
    minWidth: "min(100%, 24rem)",
  },
  eyebrow: {
    letterSpacing: "0.16em",
    textTransform: "uppercase",
  },
  action: {
    flexGrow: {
      default: 1,
      [breakpoints.sm]: 0,
    },
    flexShrink: 0,
  },
});

export function AppTagHero({
  eyebrow,
  title,
  description,
  imageSrc,
  action,
}: AppTagHeroProps) {
  const bannerSrc = resolveBannerRecordUrl(imageSrc);

  return (
    <Flex direction="column" gap="4xl" style={styles.root}>
      <div {...stylex.props(styles.imageFrame, ui.bgSubtle)}>
        {bannerSrc ? (
          <img {...stylex.props(styles.image)} alt="" src={bannerSrc} />
        ) : (
          <div {...stylex.props(styles.imageFallback)} aria-hidden="true" />
        )}
      </div>

      <Flex justify="between" gap="5xl" align="end" wrap>
        <Flex direction="column" gap="5xl" style={styles.copy}>
          {eyebrow ? (
            <SmallBody style={styles.eyebrow}>{eyebrow}</SmallBody>
          ) : null}
          <Text size={{ default: "4xl", sm: "6xl" }} weight="semibold">
            {title}
          </Text>
          {description ? <Body variant="secondary">{description}</Body> : null}
        </Flex>
        {action ? (
          <Flex align="center" justify="end" gap="md" style={styles.action}>
            {action}
          </Flex>
        ) : null}
      </Flex>
    </Flex>
  );
}
