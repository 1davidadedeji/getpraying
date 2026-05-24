import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import React, { useState } from "react";
import {
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  View,
  useWindowDimensions,
  type ImageStyle,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Reanimated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  runOnJS,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CapsuleAudioPlayer } from "@/components/CapsuleAudioPlayer";
import { CapsuleVideoPlayer } from "@/components/CapsuleVideoPlayer";
import colors from "@/constants/colors";
import { useResponsiveLayout } from "@/hooks/useResponsiveLayout";
import { resolveMediaUrl } from "@/lib/mediaUrl";
import { clamp } from "@/lib/responsiveMetrics";

type MediaType = "image" | "video" | "audio" | string | null | undefined;

function AudioAttachment({
  uri,
  feedMediaFocused,
}: {
  uri: string;
  compact?: boolean;
  feedMediaFocused?: boolean;
}) {
  return (
    <CapsuleAudioPlayer
      audioUrl={uri}
      accentColor={colors.primary}
      backgroundColor={colors.cream}
      feedMediaFocused={feedMediaFocused}
    />
  );
}

/** Full-screen image viewer with pinch-to-zoom, pan, double-tap-to-zoom, and swipe-down-to-dismiss. */
function ZoomableImageViewer({
  uri,
  onClose,
}: {
  uri: string;
  onClose: () => void;
}) {
  const { width: winW, height: winH } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);

  const pinch = Gesture.Pinch()
    .onUpdate((e) => {
      scale.value = Math.max(1, savedScale.value * e.scale);
    })
    .onEnd(() => {
      if (scale.value < 1.05) {
        scale.value = withSpring(1);
        translateX.value = withSpring(0);
        translateY.value = withSpring(0);
        savedScale.value = 1;
        savedTranslateX.value = 0;
        savedTranslateY.value = 0;
      } else {
        savedScale.value = scale.value;
      }
    });

  const pan = Gesture.Pan()
    .onUpdate((e) => {
      if (savedScale.value > 1.05) {
        translateX.value = savedTranslateX.value + e.translationX;
        translateY.value = savedTranslateY.value + e.translationY;
      } else {
        // Swipe down to dismiss when not zoomed in
        if (e.translationY > 0) translateY.value = e.translationY;
      }
    })
    .onEnd((e) => {
      if (savedScale.value <= 1.05 && e.translationY > 80) {
        runOnJS(onClose)();
      } else if (savedScale.value > 1.05) {
        savedTranslateX.value = translateX.value;
        savedTranslateY.value = translateY.value;
      } else {
        translateY.value = withSpring(0);
      }
    });

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd((_e, success) => {
      if (!success) return;
      if (savedScale.value > 1.05) {
        scale.value = withSpring(1);
        translateX.value = withSpring(0);
        translateY.value = withSpring(0);
        savedScale.value = 1;
        savedTranslateX.value = 0;
        savedTranslateY.value = 0;
      } else {
        scale.value = withSpring(2.5);
        savedScale.value = 2.5;
      }
    });

  const composed = Gesture.Simultaneous(pinch, Gesture.Race(doubleTap, pan));

  const animStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  return (
    <View style={[styles.fullscreenModalRoot, { width: winW, height: winH }]}>
      <GestureDetector gesture={composed}>
        <Reanimated.View style={[StyleSheet.absoluteFillObject, animStyle]}>
          <Image
            source={{ uri }}
            style={StyleSheet.absoluteFillObject as StyleProp<ImageStyle>}
            contentFit="contain"
            transition={200}
          />
        </Reanimated.View>
      </GestureDetector>
      <Pressable
        onPress={onClose}
        style={[
          styles.fullscreenCloseBtn,
          { top: insets.top + 8, left: insets.left + 10, padding: 10 },
        ]}
        accessibilityRole="button"
        accessibilityLabel="Close image"
      >
        <Ionicons name="close" size={28} color={colors.surface} />
      </Pressable>
    </View>
  );
}

export function PostMediaBlock({
  mediaUrl,
  mediaType,
  style,
  compact,
  thumbnail,
  feedMediaFocused,
  onOpenPostDetail,
  mediaLayout = "feed",
}: {
  mediaUrl?: string | null;
  mediaType?: MediaType;
  style?: StyleProp<ViewStyle>;
  compact?: boolean;
  thumbnail?: boolean;
  feedMediaFocused?: boolean;
  onOpenPostDetail?: () => void;
  mediaLayout?: "feed" | "detail";
}) {
  const uri = resolveMediaUrl(mediaUrl);
  const { uiScale } = useResponsiveLayout();
  const mediaRad = Math.round(clamp(16 * uiScale, 12, 22));
  const thumbH = Math.round(clamp(100 * uiScale, 88, 120));
  const radiusStyle = { borderRadius: mediaRad };
  const thumbStyle = thumbnail ? { height: thumbH } : undefined;
  const [imgNaturalAspect, setImgNaturalAspect] = useState<number | null>(null);
  const [imgLightboxOpen, setImgLightboxOpen] = useState(false);
  const { width: winW, height: winH } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  if (!uri) return null;

  const feed = !!feedMediaFocused;

  if (mediaType === "video") {
    return (
      <CapsuleVideoPlayer
        videoUrl={uri}
        accentColor={colors.primary}
        backgroundColor={colors.cream}
        feedMediaFocused={feed}
        onOpenDetail={feed ? onOpenPostDetail : undefined}
        fixedHeight={thumbnail ? thumbH : undefined}
        maxHeight={mediaLayout === "detail" && !thumbnail ? 520 : undefined}
        borderRadius={mediaRad}
        style={style}
      />
    );
  }

  if (mediaType === "audio") {
    return <AudioAttachment uri={uri} compact={compact} feedMediaFocused={feed} />;
  }

  // Thumbnail path: fixed height, no lightbox
  if (thumbnail) {
    return (
      <Image
        source={{ uri }}
        style={[styles.image, radiusStyle, thumbStyle, style].filter(Boolean) as StyleProp<ImageStyle>[]}
        contentFit="contain"
        transition={200}
      />
    );
  }

  // Feed / detail path: preserve natural aspect ratio (clamped to sensible extremes)
  const clampedImgAspect =
    imgNaturalAspect != null
      ? imgNaturalAspect < 1
        ? Math.max(9 / 16, imgNaturalAspect)
        : Math.min(16 / 9, imgNaturalAspect)
      : 4 / 3;

  return (
    <>
      <Pressable
        onPress={() => setImgLightboxOpen(true)}
        style={style}
        accessibilityRole="button"
        accessibilityLabel="View full image"
      >
        <Image
          source={{ uri }}
          style={[styles.image, radiusStyle, { aspectRatio: clampedImgAspect }] as StyleProp<ImageStyle>[]}
          contentFit="contain"
          transition={200}
          onLoad={(e) => {
            const { width, height } = e.source;
            if (width > 0 && height > 0) setImgNaturalAspect(width / height);
          }}
        />
      </Pressable>
      <Modal
        visible={imgLightboxOpen}
        animationType="fade"
        presentationStyle="fullScreen"
        supportedOrientations={["portrait", "portrait-upside-down", "landscape", "landscape-left", "landscape-right"]}
        onRequestClose={() => setImgLightboxOpen(false)}
        statusBarTranslucent={Platform.OS === "android"}
      >
        <ZoomableImageViewer uri={uri} onClose={() => setImgLightboxOpen(false)} />
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  image: {
    width: "100%",
    backgroundColor: colors.cream,
  },
  fullscreenModalRoot: {
    flex: 1,
    backgroundColor: "#000",
    position: "relative",
  },
  fullscreenCloseBtn: {
    position: "absolute",
    zIndex: 6,
    minWidth: 44,
    alignItems: "center",
    justifyContent: "center",
  },
});
