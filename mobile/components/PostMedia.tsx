import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import React, { useEffect, useRef, useState } from "react";
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
import { isPremiumMediaLocked } from "@/lib/premiumContent";
import { PremiumContentLock } from "@/components/PremiumContentLock";
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

/** Lightweight stand-in for a feed video that isn't the in-view cell. Tapping
 *  opens the post detail, where the real player mounts and autoplays. */
function FeedVideoPoster({
  aspectRatio,
  borderRadius,
  style,
  uiScale,
  onPress,
}: {
  aspectRatio: number;
  borderRadius: number;
  style?: StyleProp<ViewStyle>;
  uiScale: number;
  onPress?: () => void;
}) {
  const playSz = Math.round(clamp(56 * uiScale, 46, 66));
  return (
    <View style={[styles.posterWrap, style]}>
      <Pressable
        onPress={onPress}
        disabled={!onPress}
        style={[styles.posterShell, { borderRadius, aspectRatio, maxHeight: 520 }]}
        accessibilityRole="button"
        accessibilityLabel="Play video"
      >
        <View
          style={[
            styles.posterPlay,
            { width: playSz, height: playSz, borderRadius: playSz / 2 },
          ]}
        >
          <Ionicons name="play" size={Math.round(playSz * 0.5)} color={colors.surface} />
        </View>
      </Pressable>
    </View>
  );
}

export function PostMediaBlock({
  postId,
  mediaUrl,
  mediaType,
  isPremium,
  style,
  compact,
  thumbnail,
  feedMediaFocused,
  onOpenPostDetail,
  mediaLayout = "feed",
}: {
  /** Stable list key — helps expo-image on iOS; omitted on Android feed cells. */
  postId?: number;
  mediaUrl?: string | null;
  mediaType?: MediaType;
  isPremium?: boolean;
  style?: StyleProp<ViewStyle>;
  compact?: boolean;
  thumbnail?: boolean;
  feedMediaFocused?: boolean;
  onOpenPostDetail?: () => void;
  mediaLayout?: "feed" | "detail";
}) {
  const uri = resolveMediaUrl(mediaUrl);
  const premiumMediaLocked = isPremiumMediaLocked({ isPremium, mediaType, mediaUrl });
  const { uiScale } = useResponsiveLayout();
  const mediaRad = Math.round(clamp(16 * uiScale, 12, 22));
  const thumbH = Math.round(clamp(100 * uiScale, 88, 120));
  const radiusStyle = { borderRadius: mediaRad };
  const thumbStyle = thumbnail ? { height: thumbH } : undefined;
  const { width: winW } = useWindowDimensions();
  const [imgNaturalAspect, setImgNaturalAspect] = useState<number | null>(null);
  const [imgLightboxOpen, setImgLightboxOpen] = useState(false);
  const [wrapWidth, setWrapWidth] = useState(0);
  // When a feed image's load is cancelled (fast scroll / cell recycle) or fails
  // transiently, expo-image leaves the tile blank until the view is remounted.
  // Bumping reloadKey remounts the <Image/> to force a fresh fetch — capped so a
  // genuinely-broken URL can't loop forever.
  const [imgReloadKey, setImgReloadKey] = useState(0);
  const imgFailsRef = useRef(0);

  useEffect(() => {
    setImgNaturalAspect(null);
    setImgLightboxOpen(false);
    setWrapWidth(0);
    setImgReloadKey(0);
    imgFailsRef.current = 0;
  }, [uri]);

  if (!uri) {
    if (premiumMediaLocked) {
      return <PremiumContentLock mode="media" style={style} />;
    }
    return null;
  }

  const feed = !!feedMediaFocused;

  if (mediaType === "video") {
    // Feed performance + reliability: only the in-view ("focused") cell mounts a
    // real expo-video player. Every other video cell shows a lightweight,
    // tappable poster — otherwise the feed renders blank/black tiles while many
    // players initialize off-screen. `feedMediaFocused === false` means "this is
    // a feed cell that is not currently focused" (it is `undefined` on detail).
    if (feedMediaFocused === false && !thumbnail) {
      return (
        <FeedVideoPoster
          aspectRatio={9 / 16}
          borderRadius={mediaRad}
          style={style}
          uiScale={uiScale}
          onPress={onOpenPostDetail}
        />
      );
    }
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
      : 16 / 10;

  const layoutWidth = wrapWidth > 0 ? wrapWidth : Math.max(0, winW - 32);
  const imgHeight = Math.max(140, Math.round(layoutWidth / clampedImgAspect));
  const imageRecyclingKey =
    Platform.OS === "android" ? undefined : postId != null ? `post-${postId}-${uri}` : uri;

  return (
    <>
      <View
        style={[styles.imageWrap, style, radiusStyle, { minHeight: imgHeight }]}
        collapsable={false}
        renderToHardwareTextureAndroid={false}
        onLayout={(e) => {
          const w = e.nativeEvent.layout.width;
          if (w > 0 && Math.abs(w - wrapWidth) > 0.5) setWrapWidth(w);
        }}
      >
        <Image
          key={imgReloadKey}
          source={{ uri }}
          recyclingKey={imageRecyclingKey}
          style={[styles.image, { width: "100%", height: imgHeight }] as StyleProp<ImageStyle>[]}
          contentFit="cover"
          cachePolicy="memory-disk"
          priority={mediaLayout === "feed" ? "high" : "normal"}
          transition={200}
          onLoad={(e) => {
            imgFailsRef.current = 0;
            const { width, height } = e.source;
            if (width > 0 && height > 0) setImgNaturalAspect(width / height);
          }}
          onError={() => {
            if (imgFailsRef.current >= 2) return;
            imgFailsRef.current += 1;
            setImgReloadKey((k) => k + 1);
          }}
        />
        <Pressable
          onPress={() => setImgLightboxOpen(true)}
          style={[StyleSheet.absoluteFillObject, styles.imageTapOverlay]}
          accessibilityRole="button"
          accessibilityLabel="View full image"
        />
      </View>
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
  posterWrap: {
    width: "100%",
  },
  posterShell: {
    width: "100%",
    overflow: "hidden",
    backgroundColor: "#0E2A3A",
    alignItems: "center",
    justifyContent: "center",
  },
  posterPlay: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.45)",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.7)",
  },
  imageWrap: {
    width: "100%",
    alignSelf: "stretch",
    overflow: "hidden",
    backgroundColor: colors.cream,
    position: "relative",
  },
  imageTapOverlay: {
    zIndex: 1,
  },
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
