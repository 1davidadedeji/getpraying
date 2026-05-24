import { Feather, Ionicons } from "@expo/vector-icons";
import * as FileSystem from "expo-file-system/legacy";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import * as ImageManipulator from "expo-image-manipulator";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import { ResizeMode, Video } from "expo-av";
import { router, type Href } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  InteractionManager,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  CreatePostInputMediaType,
  getGetPostsQueryKey,
  getGetTrendingPostsQueryKey,
  getGetUserPostsQueryKey,
  useCreatePost,
  type Post,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { AudioLibraryPickerModal } from "@/components/AudioLibraryPickerModal";
import { showAppAlert } from "@/components/AppAlert";
import colors from "@/constants/colors";
import { useAuth } from "@/context/auth";
import { useFeedNotice } from "@/context/feedNotice";
import { useRevenueCat } from "@/context/revenuecat";
import { useStackHeaderBack } from "@/hooks/useStackHeaderBack";
import { useResponsiveLayout } from "@/hooks/useResponsiveLayout";
import { getApiErrorMessage } from "@/lib/apiErrors";
import { CATEGORY_SLUGS } from "@/lib/categories";
import { apiUrl, authHeaders } from "@/lib/api";
import { AUDIO_DOCUMENT_PICKER_TYPES } from "@/lib/audioDocumentTypes";
import { normalizeAudioMime } from "@/lib/audioMime";
import {
  assertMediaWithinLimit,
  MAX_POST_AUDIO_BYTES,
  MAX_POST_IMAGE_BYTES,
  MAX_POST_VIDEO_BYTES,
  uploadPostImage,
  uploadPostMediaFile,
} from "@/lib/mediaUpload";
import { ensurePhotoLibraryPermission } from "@/lib/ensureMediaPermission";
import { clamp } from "@/lib/responsiveMetrics";
import { viewerHasPremiumCapabilities } from "@/lib/subscriptionBoost";
import {
  normalizeVideoMime,
  videoFileNameForMime,
} from "@/lib/videoMime";

const MAX_UPLOAD_BYTES = MAX_POST_IMAGE_BYTES;

type PendingMedia =
  | { kind: "image"; uri: string }
  | { kind: "video"; uri: string; mimeType: string; fileName: string; durationSec: number }
  | { kind: "audio"; uri: string; mimeType: string; name: string };

async function resizeUnderCap(uri: string): Promise<string> {
  let current = uri;
  let quality = 0.88;
  for (let attempt = 0; attempt < 6; attempt++) {
    const manipulated = await ImageManipulator.manipulateAsync(
      current,
      [{ resize: { width: 1400 } }],
      { compress: quality, format: ImageManipulator.SaveFormat.JPEG },
    );
    const info = await FileSystem.getInfoAsync(manipulated.uri);
    const size =
      info.exists && "size" in info && typeof info.size === "number" ? info.size : 0;
    if (size > 0 && size <= MAX_UPLOAD_BYTES) {
      return manipulated.uri;
    }
    current = manipulated.uri;
    quality = Math.max(0.45, quality - 0.1);
  }
  throw new Error("Photo is still too large. Try another image.");
}

export default function NewPostScreen() {
  useStackHeaderBack("/(tabs)" as Href);
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { token, user } = useAuth();
  const revenueCat = useRevenueCat();
  const canBoost = viewerHasPremiumCapabilities(user ?? null, revenueCat);
  const { showNotice, requestFeedJumpToTop } = useFeedNotice();
  const [content, setContent] = useState("");
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const { mutate: createPost, isPending } = useCreatePost();
  const [aiCategories, setAiCategories] = useState<string[]>([]);
  const [aiLoading, setAiLoading] = useState(false);
  const [pendingMedia, setPendingMedia] = useState<PendingMedia | null>(null);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [audioLibraryOpen, setAudioLibraryOpen] = useState(false);
  const [applyBoost, setApplyBoost] = useState(false);

  const botPad = Platform.OS === "web" ? 34 : insets.bottom;
  const { gutter, uiScale, cardRadius } = useResponsiveLayout();
  const containerGap = Math.round(clamp(16 * uiScale, 14, 18));
  const scrollPadT = Math.round(clamp(12 * uiScale, 10, 14));
  const scrollPadB = Math.round(clamp(32 * uiScale, 24, 40));
  const fsLead = Math.round(clamp(12 * uiScale, 11, 14));
  const lhLead = Math.round(fsLead * 1.35);
  const cardPad = Math.round(clamp(16 * uiScale, 14, 20));
  const cardRad = Math.round(clamp(cardRadius, 28, 40));
  const cardBorder = Math.max(1, Math.round(1.5 * uiScale));
  const fsPrayer = Math.round(clamp(15 * uiScale, 14, 16));
  const lhPrayer = Math.round(fsPrayer * (22 / 15));
  const minPrayerH = Math.round(clamp(160 * uiScale, 120, 200));
  const fsChar = Math.round(clamp(11 * uiScale, 10, 12));
  const submitPadV = Math.round(clamp(11 * uiScale, 10, 14));
  const submitRad = Math.round(clamp(28 * uiScale, 24, 32));
  const submitMaxW = Math.round(clamp(300 * uiScale, 240, 320));
  const submitGap = Math.round(clamp(8 * uiScale, 6, 10));
  const sendIcn = Math.round(clamp(18 * uiScale, 16, 20));
  const fsSubmit = Math.round(clamp(13 * uiScale, 12, 15));
  const fsSection = Math.round(clamp(12 * uiScale, 11, 14));
  const mediaSectionGap = Math.round(clamp(10 * uiScale, 8, 12));
  const mediaGridGap = Math.round(clamp(10 * uiScale, 8, 12));
  const addMediaPadV = Math.round(clamp(16 * uiScale, 14, 18));
  const addMediaRad = Math.round(clamp(32 * uiScale, 28, 36));
  const addMediaGap = Math.round(clamp(10 * uiScale, 8, 12));
  const mediaBtnIcn = Math.round(clamp(22 * uiScale, 20, 26));
  const fsAddMedia = Math.round(clamp(15 * uiScale, 14, 17));
  const prevRad = Math.round(clamp(24 * uiScale, 20, 28));
  const mediaPhGap = Math.round(clamp(8 * uiScale, 6, 10));
  const mediaPhIcn = Math.round(clamp(36 * uiScale, 32, 42));
  const fsMediaPh = Math.round(clamp(14 * uiScale, 13, 16));
  const removeTop = Math.round(clamp(10 * uiScale, 8, 12));
  const removeSz = Math.round(clamp(36 * uiScale, 32, 40));
  const removeIcn = Math.round(clamp(18 * uiScale, 16, 20));
  const optPad = Math.round(clamp(14 * uiScale, 12, 18));
  const optRad = Math.round(clamp(32 * uiScale, 28, 36));
  const optLeftGap = Math.round(clamp(12 * uiScale, 10, 14));
  const optFeather = Math.round(clamp(18 * uiScale, 16, 20));
  const fsOptLabel = Math.round(clamp(14 * uiScale, 13, 16));
  const fsOptDesc = Math.round(clamp(12 * uiScale, 11, 13));
  const catSectionGap = Math.round(clamp(10 * uiScale, 8, 12));
  const catHeaderGap = Math.round(clamp(10 * uiScale, 8, 12));
  const fsAiHint = Math.round(clamp(12 * uiScale, 11, 13));
  const aiThinkGap = Math.round(clamp(6 * uiScale, 5, 8));
  const aiPillPadH = Math.round(clamp(12 * uiScale, 10, 14));
  const aiPillPadV = Math.round(clamp(6 * uiScale, 5, 8));
  const fsAiPill = Math.round(clamp(12 * uiScale, 11, 13));
  const fsAiDot = Math.round(clamp(10 * uiScale, 9, 11));
  const catGridGap = Math.round(clamp(8 * uiScale, 6, 10));
  const catChipPadH = Math.round(clamp(12 * uiScale, 10, 14));
  const catChipPadV = Math.round(clamp(7 * uiScale, 6, 9));
  const catChipRad = Math.round(50 * uiScale);
  const fsCatChip = Math.round(clamp(13 * uiScale, 12, 15));
  const clearPadH = Math.round(clamp(10 * uiScale, 8, 12));
  const clearPadV = Math.round(clamp(4 * uiScale, 3, 5));
  const fsClear = Math.round(clamp(12 * uiScale, 11, 13));
  const noticeGap = Math.round(clamp(8 * uiScale, 6, 10));
  const noticeIcn = Math.round(clamp(16 * uiScale, 14, 18));
  const fsNotice = Math.round(clamp(12 * uiScale, 11, 13));
  const lhNotice = Math.round(fsNotice * 1.4);

  React.useEffect(() => {
    let cancelled = false;
    const trimmed = content.trim();
    if (trimmed.length < 12) {
      setAiCategories([]);
      setAiLoading(false);
      return;
    }

    const t = setTimeout(async () => {
      try {
        setAiLoading(true);
        const res = await fetch(apiUrl("/posts/suggest-category"), {
          method: "POST",
          headers: authHeaders(token, { "Content-Type": "application/json" }),
          body: JSON.stringify({ content: trimmed }),
        });
        const data = await res.json().catch(() => null);
        if (cancelled) return;
        if (!res.ok) {
          setAiCategories([]);
          return;
        }
        // Support both array (categories) and single (category) formats
        const raw: unknown = data?.categories ?? (data?.category ? [data.category] : []);
        const normalized = (Array.isArray(raw) ? raw : [])
          .filter((c: unknown) => typeof c === "string" && (CATEGORY_SLUGS as readonly string[]).includes(c as string)) as string[];
        setAiCategories(normalized);
        if (normalized.length > 0) {
          setSelectedCategories((prev) => {
            const allowed = CATEGORY_SLUGS as readonly string[];
            if (prev.length === 0) return normalized.filter((c) => allowed.includes(c));
            const merged = [...prev];
            for (const c of normalized) {
              if (allowed.includes(c) && !merged.includes(c)) merged.push(c);
            }
            return merged;
          });
        }
      } catch {
        if (!cancelled) setAiCategories([]);
      } finally {
        if (!cancelled) setAiLoading(false);
      }
    }, 500);

    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [content, token]);

  const pickImage = async () => {
    if (Platform.OS === "web") {
      showAppAlert({
        title: "Photos on mobile",
        message: "Adding a photo works best in the iOS or Android app.",
      });
      return;
    }
    const granted = await ensurePhotoLibraryPermission(
      "Allow photo library access to attach an image.",
    );
    if (!granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 1,
    });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    if (asset.fileSize != null && asset.fileSize > 48 * 1024 * 1024) {
      showAppAlert({
        title: "File too large",
        message: "Choose a photo under about 48MB. It will be resized before upload.",
      });
      return;
    }
    try {
      setUploadBusy(true);
      const resized = await resizeUnderCap(asset.uri);
      setPendingMedia({ kind: "image", uri: resized });
    } catch (e) {
      showAppAlert({
        title: "Could not use photo",
        message: e instanceof Error ? e.message : "Try a different image.",
      });
    } finally {
      setUploadBusy(false);
    }
  };

  const pickVideo = async () => {
    if (Platform.OS === "web") {
      showAppAlert({
        title: "Video",
        message: "Video attach works on the iOS or Android app.",
      });
      return;
    }
    const granted = await ensurePhotoLibraryPermission(
      "Allow library access to attach a video.",
    );
    if (!granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Videos,
      allowsEditing: false,
      quality: 1,
      ...(Platform.OS === "ios"
        ? { videoExportPreset: ImagePicker.VideoExportPreset.MediumQuality }
        : {}),
    });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];

    const a = asset as ImagePicker.ImagePickerAsset & { durationMillis?: number };
    const rawDur =
      typeof a.duration === "number"
        ? a.duration
        : typeof a.durationMillis === "number"
          ? a.durationMillis
          : null;
    // expo-image-picker: duration is often in seconds on iOS and milliseconds on Android.
    const durSec =
      rawDur == null ? null : rawDur > 1000 ? rawDur / 1000 : rawDur;

    const rawMime =
      "mimeType" in asset && typeof (asset as { mimeType?: string }).mimeType === "string"
        ? (asset as { mimeType: string }).mimeType
        : "video/mp4";
    const provisionalName = rawMime.includes("quicktime") ? "clip.mov" : "clip.mp4";
    const mime = normalizeVideoMime(rawMime, provisionalName);
    const fileName = videoFileNameForMime(mime);

    try {
      setUploadBusy(true);
      const prepared = await assertMediaWithinLimit(asset.uri, fileName, MAX_POST_VIDEO_BYTES, "video");
      setPendingMedia({
        kind: "video",
        uri: prepared.uri,
        mimeType: mime,
        fileName: prepared.fileName,
        durationSec: durSec ?? 0,
      });
    } catch (e) {
      showAppAlert({
        title: "Could not use video",
        message: e instanceof Error ? e.message : "Try selecting a different clip.",
      });
    } finally {
      setUploadBusy(false);
    }
  };

  const pickAudioFromDocuments = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: AUDIO_DOCUMENT_PICKER_TYPES,
      copyToCacheDirectory: true,
      multiple: false,
    });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    const rawName =
      asset.name && asset.name.length > 0 ? asset.name.replace(/[^\w.\-]+/g, "_") : "audio.m4a";
    const rawMime =
      asset.mimeType && asset.mimeType.length > 0 ? asset.mimeType : "audio/mpeg";
    const mimeType = normalizeAudioMime(rawMime, rawName);
    try {
      setUploadBusy(true);
      const prepared = await assertMediaWithinLimit(asset.uri, rawName, MAX_POST_AUDIO_BYTES, "audio");
      setPendingMedia({ kind: "audio", uri: prepared.uri, mimeType, name: prepared.fileName });
    } catch (e) {
      showAppAlert({
        title: "Could not use audio",
        message: e instanceof Error ? e.message : "Try a different file.",
      });
    } finally {
      setUploadBusy(false);
    }
  };

  const pickAudio = () => {
    if (Platform.OS === "web") {
      showAppAlert({
        title: "Audio",
        message: "Audio attach works on the iOS or Android app.",
      });
      return;
    }
    setAudioLibraryOpen(true);
  };

  const canSubmit = !!(content.trim() || pendingMedia);
  const busy = isPending || uploadBusy;

  const handleSubmit = async () => {
    if (!canSubmit) {
      showAppAlert({
        title: "Add something",
        message: "Write a prayer or attach a photo (or both).",
      });
      return;
    }
    if (!token) {
      showAppAlert({ title: "Sign in required", message: "Please sign in again." });
      return;
    }

    // Primary = first chip; all selected slugs are sent and stored (server allowlist)
    const category = selectedCategories[0] ?? undefined;
    const categories =
      selectedCategories.length > 0 ? selectedCategories : undefined;

    let mediaUrl: string | undefined;
    let postMediaType: CreatePostInputMediaType | undefined;

    if (pendingMedia) {
      setUploadBusy(true);
      try {
        // Verify the file is still accessible — on Android, cache URIs can become stale
        // after the app returns from background or after a previous failed upload attempt.
        const fileInfo = await FileSystem.getInfoAsync(pendingMedia.uri);
        if (!fileInfo.exists) {
          setPendingMedia(null);
          showAppAlert({
            title: "File not accessible",
            message: "The selected file could not be read. Please re-select it and try again.",
          });
          return;
        }

        if (pendingMedia.kind === "image") {
          mediaUrl = await uploadPostImage(pendingMedia.uri, token);
          postMediaType = CreatePostInputMediaType.image;
        } else if (pendingMedia.kind === "video") {
          const r = await uploadPostMediaFile({
            localUri: pendingMedia.uri,
            token,
            fileName: pendingMedia.fileName,
            mimeType: pendingMedia.mimeType,
            kind: "video",
            maxBytes: MAX_POST_VIDEO_BYTES,
          });
          mediaUrl = r.url;
          postMediaType = CreatePostInputMediaType.video;
        } else {
          const r = await uploadPostMediaFile({
            localUri: pendingMedia.uri,
            token,
            fileName: pendingMedia.name,
            mimeType: pendingMedia.mimeType,
            kind: "audio",
            maxBytes: MAX_POST_AUDIO_BYTES,
          });
          mediaUrl = r.url;
          postMediaType = CreatePostInputMediaType.audio;
        }
      } catch (e) {
        showAppAlert({
          title: "Upload failed",
          message: e instanceof Error ? e.message : "Try again.",
        });
        return;
      } finally {
        setUploadBusy(false);
      }
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    createPost(
      {
        data: {
          content: content.trim(),
          category,
          ...(categories ? { categories } : {}),
          ...(mediaUrl && postMediaType ? { mediaUrl, mediaType: postMediaType } : {}),
          ...(applyBoost && canBoost ? { applyBoost: true } : {}),
        },
      },
      {
        onSuccess: (res: Post) => {
          // Navigate first so the composer screen starts unmounting before
          // we do any state/cache/haptic work.
          if (router.canGoBack()) {
            router.back();
          } else {
            router.replace("/(tabs)" as Href);
          }

          // Defer everything else until the navigation animation has a
          // frame to run — avoids a synchronous spike that can freeze the
          // transition or trigger a process kill on low-RAM devices.
          InteractionManager.runAfterInteractions(() => {
            try {
              void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            } catch {
              /* Haptics unavailable on some devices */
            }

            const isApproved = res?.status === "approved";
            const boostedNow = Boolean(res?.boostedAt);
            let message: string;
            if (isApproved) {
              message = applyBoost && canBoost && boostedNow
                ? "Posted and boosted — it’s prioritized in the feed."
                : "Posted — you’ll see it at the top of the feed.";
            } else {
              message =
                applyBoost && canBoost
                  ? "Sent for review — Boost will be available after approval."
                  : "Sent for review — it will appear after approval.";
            }
            showNotice(message, "success");

            // Composer is already unmounting, but clearing state here is
            // harmless and prevents stale data if the screen is kept alive.
            setContent("");
            setSelectedCategories([]);
            setAiCategories([]);
            setApplyBoost(false);
            setPendingMedia(null);

            queryClient.invalidateQueries({ queryKey: getGetPostsQueryKey() });
            queryClient.invalidateQueries({ queryKey: getGetTrendingPostsQueryKey() });
            if (user?.username) {
              queryClient.invalidateQueries({ queryKey: getGetUserPostsQueryKey(user.username) });
            }

            requestFeedJumpToTop();
          });
        },
        onError: (err: unknown) => {
          showAppAlert({
            title: "Could not submit",
            message: getApiErrorMessage(err, "Please check your connection and try again."),
          });
        },
      },
    );
  };

  return (
    <>
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? Math.round(clamp(64 * uiScale, 56, 72)) : 0}
    >
      <ScrollView
        style={styles.flex}
        contentContainerStyle={[
          styles.container,
          {
            paddingHorizontal: gutter,
            paddingTop: scrollPadT,
            paddingBottom: botPad + scrollPadB,
            gap: containerGap,
          },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
      <Text style={[styles.lead, { fontSize: fsLead, lineHeight: lhLead }]}>Speak your heart. We’ll hold space.</Text>

      <View style={[styles.card, { padding: cardPad, borderRadius: cardRad, borderWidth: cardBorder }]}>
        <TextInput
          style={[
            styles.prayerInput,
            {
              fontSize: fsPrayer,
              lineHeight: lhPrayer,
              minHeight: minPrayerH,
            },
          ]}
          value={content}
          onChangeText={setContent}
          placeholder="Write your prayer request, praise, or devotion..."
          placeholderTextColor={colors.muted}
          multiline
          numberOfLines={8}
          textAlignVertical="top"
          maxLength={2000}
          testID="prayer-content-input"
        />
        <Text style={[styles.charCount, { fontSize: fsChar }]}>{content.length}/2000</Text>
      </View>

      <Pressable
        style={[
          styles.submitBtn,
          {
            paddingVertical: submitPadV,
            borderRadius: submitRad,
            gap: submitGap,
            maxWidth: submitMaxW,
            alignSelf: "center",
            width: "100%",
          },
          (busy || !canSubmit) && styles.submitBtnDisabled,
        ]}
        onPress={() => void handleSubmit()}
        disabled={busy || !canSubmit}
        testID="submit-prayer-btn"
      >
        {busy ? (
          <ActivityIndicator color={colors.surface} />
        ) : (
          <>
            <Ionicons name="send" size={sendIcn} color={colors.surface} />
            <Text style={[styles.submitBtnText, { fontSize: fsSubmit }]}>Submit Prayer</Text>
          </>
        )}
      </Pressable>

      <View style={[styles.imageSection, { gap: mediaSectionGap }]}>
        <Text style={[styles.mediaHint, { fontSize: fsSection }]}>
          Add photos (1 MB), audio (15 MB), or video (50 MB). All uploads are reviewed before posting.
        </Text>
        {pendingMedia ? (
          <View style={[styles.imagePreviewWrap, { borderRadius: prevRad }]}>
            {pendingMedia.kind === "image" ? (
              <Image
                source={{ uri: pendingMedia.uri }}
                style={styles.imagePreview}
                contentFit="cover"
              />
            ) : pendingMedia.kind === "video" ? (
              <View style={styles.videoPreviewContainer}>
                <Video
                  source={{ uri: pendingMedia.uri }}
                  style={styles.imagePreview}
                  resizeMode={ResizeMode.COVER}
                  shouldPlay={false}
                  useNativeControls={false}
                  isMuted
                />
                <View style={styles.videoPreviewOverlay} pointerEvents="none">
                  <View style={styles.videoPlayBadge}>
                    <Ionicons name="play" size={Math.round(mediaPhIcn * 0.7)} color={colors.surface} />
                  </View>
                  <Text style={[styles.videoPreviewLabel, { fontSize: fsMediaPh }]}>
                    {pendingMedia.durationSec > 0
                      ? `Video · ${pendingMedia.durationSec < 60 ? Math.round(pendingMedia.durationSec) + "s" : Math.floor(pendingMedia.durationSec / 60) + "m " + (Math.round(pendingMedia.durationSec) % 60) + "s"}`
                      : "Video selected"}
                  </Text>
                </View>
              </View>
            ) : (
              <View style={[styles.audioPreviewBox, { gap: mediaPhGap }]}>
                <Ionicons name="musical-notes" size={mediaPhIcn} color={colors.primary} />
                <View style={styles.audioWaveRow}>
                  {[18, 30, 46, 26, 40, 22, 42, 32, 36, 20, 44, 28, 38, 24, 34].map((h, i) => (
                    <React.Fragment key={i}>
                      <View style={[styles.audioWaveBar, { height: h }]} />
                    </React.Fragment>
                  ))}
                </View>
                <Text style={[styles.mediaPlaceholderText, { fontSize: fsMediaPh }]} numberOfLines={1}>
                  {pendingMedia.name || "Audio selected"}
                </Text>
              </View>
            )}
            <Pressable
              style={[
                styles.removeImageBtn,
                {
                  top: removeTop,
                  right: removeTop,
                  width: removeSz,
                  height: removeSz,
                  borderRadius: removeSz / 2,
                },
              ]}
              onPress={() => setPendingMedia(null)}
            >
              <Feather name="x" size={removeIcn} color={colors.surface} />
            </Pressable>
          </View>
        ) : (
          <View style={[styles.mediaBtnGrid, { gap: mediaGridGap }]}>
            <Pressable
              style={[
                styles.addPhotoBtn,
                {
                  paddingVertical: addMediaPadV,
                  borderRadius: addMediaRad,
                  gap: addMediaGap,
                },
                uploadBusy && styles.addPhotoBtnDisabled,
              ]}
              onPress={pickImage}
              disabled={uploadBusy}
            >
              {uploadBusy ? (
                <ActivityIndicator color={colors.primary} />
              ) : (
                <>
                  <Ionicons name="image-outline" size={mediaBtnIcn} color={colors.primary} />
                  <Text style={[styles.addPhotoText, { fontSize: fsAddMedia }]}>Photo</Text>
                </>
              )}
            </Pressable>
            <Pressable
              style={[
                styles.addPhotoBtn,
                {
                  paddingVertical: addMediaPadV,
                  borderRadius: addMediaRad,
                  gap: addMediaGap,
                },
                uploadBusy && styles.addPhotoBtnDisabled,
              ]}
              onPress={pickVideo}
              disabled={uploadBusy}
            >
              <Ionicons name="videocam-outline" size={mediaBtnIcn} color={colors.primary} />
              <Text style={[styles.addPhotoText, { fontSize: fsAddMedia }]}>Video</Text>
            </Pressable>
            <Pressable
              style={[
                styles.addPhotoBtn,
                {
                  paddingVertical: addMediaPadV,
                  borderRadius: addMediaRad,
                  gap: addMediaGap,
                },
                uploadBusy && styles.addPhotoBtnDisabled,
              ]}
              onPress={pickAudio}
              disabled={uploadBusy}
            >
              <Ionicons name="mic-outline" size={mediaBtnIcn} color={colors.primary} />
              <Text style={[styles.addPhotoText, { fontSize: fsAddMedia }]}>Audio</Text>
            </Pressable>
          </View>
        )}
      </View>

      <View style={[styles.option, { padding: optPad, borderRadius: optRad }]}>
        <View style={[styles.optionLeft, { gap: optLeftGap, flex: 1 }]}>
          <Ionicons name="megaphone-outline" size={optFeather} color={colors.primary} />
          <View style={styles.optionTextCol}>
            <Text style={[styles.optionLabel, { fontSize: fsOptLabel }]}>Boost in feed</Text>
            <Text style={[styles.optionDesc, { fontSize: fsOptDesc }]}>
              {canBoost
                ? "Subscribers: boost your posts higher in others’ feeds."
                : "Subscribers can boost their own posts toward the top."}
            </Text>
          </View>
        </View>
        {canBoost ? (
          <Switch
            value={applyBoost}
            onValueChange={setApplyBoost}
            trackColor={{ true: colors.primary, false: colors.border }}
            thumbColor={colors.surface}
            testID="boost-toggle"
          />
        ) : (
          <Pressable
            onPress={() =>
              showAppAlert({
                title: "Boost",
                message: "Boost moves your prayer higher in the feed for subscribers.",
                buttons: [{ text: "OK", style: "cancel" }],
              })
            }
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Boost unavailable. Learn about subscribers."
          >
            <Switch
              value={false}
              disabled
              pointerEvents="none"
              trackColor={{ true: colors.primary, false: colors.border }}
              thumbColor={colors.surface}
            />
          </Pressable>
        )}
      </View>

      <View style={[styles.categorySection, { gap: catSectionGap }]}>
        <View style={[styles.categoryHeader, { gap: catHeaderGap }]}>
          <Text style={[styles.sectionLabel, { fontSize: fsSection }]}>Category</Text>
          {aiLoading ? (
            <View style={[styles.aiThinkingRow, { gap: aiThinkGap }]}>
              <ActivityIndicator size="small" color={colors.accent} />
              <Text style={[styles.aiHint, { fontSize: fsAiHint }]}>AI thinking…</Text>
            </View>
          ) : aiCategories.length > 0 ? (
            <View style={[styles.aiPill, styles.aiPillOn, { paddingHorizontal: aiPillPadH, paddingVertical: aiPillPadV }]}>
              <Text style={[styles.aiPillText, styles.aiPillTextOn, { fontSize: fsAiPill }]}>
                AI selected {aiCategories.length > 1 ? `${aiCategories.length} categories` : aiCategories[0]}
              </Text>
            </View>
          ) : (
            <Text style={[styles.aiHint, { fontSize: fsAiHint }]}>Optional — tap to select</Text>
          )}
        </View>
        <View style={[styles.categoryGrid, { gap: catGridGap }]}>
          {CATEGORY_SLUGS.map((cat) => {
            const isSelected = selectedCategories.includes(cat);
            const isAiSuggested = aiCategories.includes(cat);
            return (
              <Pressable
                key={cat}
                onPress={() => {
                  setSelectedCategories((prev) =>
                    prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
                  );
                  // Clear AI suggestions once user manually interacts
                  if (isAiSuggested) setAiCategories([]);
                }}
                style={[
                  styles.categoryChip,
                  {
                    paddingHorizontal: catChipPadH,
                    paddingVertical: catChipPadV,
                    borderRadius: catChipRad,
                  },
                  isSelected && styles.categoryChipSelected,
                  isAiSuggested && !isSelected && styles.categoryChipAi,
                ]}
              >
                {isAiSuggested && <Text style={[styles.aiDot, { fontSize: fsAiDot }]}>✦ </Text>}
                <Text
                  style={[
                    styles.categoryChipText,
                    { fontSize: fsCatChip },
                    isSelected && styles.categoryChipTextSelected,
                    isAiSuggested && !isSelected && styles.categoryChipTextAi,
                  ]}
                >
                  {cat.charAt(0).toUpperCase() + cat.slice(1)}
                </Text>
              </Pressable>
            );
          })}
        </View>
        {selectedCategories.length > 0 && (
          <Pressable
            onPress={() => { setSelectedCategories([]); setAiCategories([]); }}
            style={[styles.clearCats, { paddingHorizontal: clearPadH, paddingVertical: clearPadV }]}
          >
            <Text style={[styles.clearCatsText, { fontSize: fsClear }]}>Clear selection</Text>
          </Pressable>
        )}
      </View>

      <View style={[styles.notice, { gap: noticeGap }]}>
        <Ionicons name="information-circle-outline" size={noticeIcn} color={colors.muted} />
        <Text style={[styles.noticeText, { fontSize: fsNotice, lineHeight: lhNotice }]}>
          Prayers are reviewed before appearing in the feed.
        </Text>
      </View>
      </ScrollView>
    </KeyboardAvoidingView>
    <AudioLibraryPickerModal
      visible={audioLibraryOpen}
      maxBytes={MAX_POST_AUDIO_BYTES}
      onRequestClose={() => setAudioLibraryOpen(false)}
      onBrowseFiles={() => void pickAudioFromDocuments()}
      onTooLarge={() =>
        showAppAlert({
          title: "Audio too large",
          message: "Choose a file under 15MB.",
        })
      }
      onChosen={async (r) => {
        setPendingMedia({ kind: "audio", uri: r.uri, mimeType: r.mimeType, name: r.name });
      }}
    />
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.cream },
  container: {},
  lead: {
    fontFamily: "PlusJakartaSans_400Regular",
    color: colors.muted,
  },
  sectionLabel: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    color: colors.textSecondary,
  },
  mediaHint: {
    fontFamily: "PlusJakartaSans_400Regular",
    color: colors.muted,
  },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
  },
  prayerInput: {
    fontFamily: "PlusJakartaSans_400Regular",
    color: colors.text,
  },
  charCount: {
    fontFamily: "PlusJakartaSans_400Regular",
    color: colors.muted,
    textAlign: "right",
    marginTop: 8,
  },
  imageSection: {},
  mediaBtnGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  addPhotoBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    flex: 1,
    minWidth: 100,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: "dashed",
  },
  addPhotoBtnDisabled: { opacity: 0.6 },
  addPhotoText: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    color: colors.primary,
  },
  imagePreviewWrap: {
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.border,
    position: "relative",
  },
  imagePreview: {
    width: "100%",
    aspectRatio: 4 / 3,
    backgroundColor: colors.cream,
  },
  mediaPlaceholder: {
    width: "100%",
    aspectRatio: 4 / 3,
    backgroundColor: colors.cream,
    alignItems: "center",
    justifyContent: "center",
  },
  mediaPlaceholderText: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    color: colors.primary,
  },
  videoPreviewContainer: {
    width: "100%",
    aspectRatio: 4 / 3,
    backgroundColor: "#000",
    position: "relative",
  },
  videoPreviewOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  videoPlayBadge: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "rgba(26,31,54,0.72)",
    alignItems: "center",
    justifyContent: "center",
  },
  videoPreviewLabel: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    color: colors.surface,
    textShadowColor: "rgba(0,0,0,0.6)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  audioPreviewBox: {
    width: "100%",
    aspectRatio: 4 / 3,
    backgroundColor: colors.cream,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  audioWaveRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    height: 50,
  },
  audioWaveBar: {
    width: 4,
    borderRadius: 2,
    backgroundColor: colors.primary,
    opacity: 0.7,
  },
  removeImageBtn: {
    position: "absolute",
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
  },
  option: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  optionLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  optionLabel: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    color: colors.text,
  },
  optionDesc: {
    fontFamily: "PlusJakartaSans_400Regular",
    color: colors.muted,
    marginTop: 1,
  },
  optionTextCol: {
    flex: 1,
    minWidth: 0,
  },
  categorySection: {},
  categoryHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  aiHint: {
    fontFamily: "PlusJakartaSans_400Regular",
    color: colors.muted,
  },
  aiThinkingRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  aiPill: {
    borderRadius: 999,
    borderWidth: 1,
  },
  aiPillOn: {
    backgroundColor: "#E3F2FD",
    borderColor: "#93CDFC",
  },
  aiPillText: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    color: colors.textSecondary,
  },
  aiPillTextOn: {
    color: "#21638D",
  },
  aiDot: {
    color: "#21638D",
  },
  categoryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  categoryChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  categoryChipSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  categoryChipAi: {
    backgroundColor: "#E3F2FD",
    borderColor: "#93CDFC",
    borderWidth: 1.5,
  },
  categoryChipText: {
    fontFamily: "PlusJakartaSans_400Regular",
    color: colors.text,
  },
  categoryChipTextSelected: {
    color: colors.surface,
    fontFamily: "PlusJakartaSans_600SemiBold",
  },
  categoryChipTextAi: {
    color: "#21638D",
    fontFamily: "PlusJakartaSans_600SemiBold",
  },
  clearCats: {
    alignSelf: "flex-start",
    marginTop: 4,
  },
  clearCatsText: {
    fontFamily: "PlusJakartaSans_400Regular",
    color: colors.muted,
    textDecorationLine: "underline",
  },
  notice: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  noticeText: {
    fontFamily: "PlusJakartaSans_400Regular",
    color: colors.muted,
    flex: 1,
  },
  submitBtn: {
    backgroundColor: colors.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
  },
  submitBtnDisabled: {
    opacity: 0.5,
  },
  submitBtnText: {
    fontFamily: "PlusJakartaSans_700Bold",
    color: colors.surface,
  },
});
