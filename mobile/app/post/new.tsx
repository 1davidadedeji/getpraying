import { Feather, Ionicons } from "@expo/vector-icons";
import * as FileSystem from "expo-file-system/legacy";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import * as ImageManipulator from "expo-image-manipulator";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import { router, type Href } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
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
import { showAppAlert } from "@/components/AppAlert";
import colors from "@/constants/colors";
import { useAuth } from "@/context/auth";
import { useFeedNotice } from "@/context/feedNotice";
import { useResponsiveLayout } from "@/hooks/useResponsiveLayout";
import { getApiErrorMessage } from "@/lib/apiErrors";
import { CATEGORY_SLUGS } from "@/lib/categories";
import { apiUrl, authHeaders } from "@/lib/api";
import { normalizeAudioMime } from "@/lib/audioMime";
import { clamp } from "@/lib/responsiveMetrics";

const MAX_UPLOAD_BYTES = 1 * 1024 * 1024;
const MAX_VIDEO_BYTES = 12 * 1024 * 1024;
const MAX_VIDEO_DURATION_SEC = 10;
const MAX_AUDIO_BYTES = 15 * 1024 * 1024;

type PendingMedia =
  | { kind: "image"; uri: string }
  | { kind: "video"; uri: string; mimeType: string; fileName: string; durationSec: number }
  | { kind: "audio"; uri: string; mimeType: string; name: string };

function messageForUploadFailure(
  res: Response,
  data: { error?: string },
  kind: "image" | "video" | "audio",
): string {
  const fromServer = typeof data?.error === "string" ? data.error.trim() : "";
  if (fromServer) {
    if (res.status === 400 || res.status === 413) {
      return fromServer;
    }
    if (res.status >= 500) {
      return `${fromServer} (${kind === "image" ? "Photo" : kind === "video" ? "Video" : "Audio"} upload)`;
    }
  }
  if (res.status === 413) {
    const proxyHint =
      " If your file is already under the limit, the hosting reverse proxy may be blocking large uploads — raise its max body size (often labeled client_max_body_size).";
    if (kind === "image") {
      return "Photo is too large for the server (max 1MB). The app resizes; try a smaller or simpler image.";
    }
    if (kind === "video") {
      return "Video file is too large (max 12MB). Shorter or lower quality clips work best." + proxyHint;
    }
    return "Audio file is too large (max 15MB)." + proxyHint;
  }
  if (res.status === 408 || res.status === 504) {
    return "Upload timed out. Check your connection and try again.";
  }
  if (res.status === 401) {
    return "Your session may have expired. Sign in again and try uploading the "
      + (kind === "image" ? "photo" : kind === "video" ? "video" : "audio")
      + " again.";
  }
  if (res.status === 0 || res.status < 0) {
    return "No network. Check your connection, then try the "
      + (kind === "image" ? "photo" : kind === "video" ? "video" : "audio")
      + " again.";
  }
  return "Upload failed. Check your connection, file type, and limits (photo ~1MB after resize, video max 10s/12MB, audio max 15MB).";
}

async function uploadMultipart(
  localUri: string,
  token: string,
  route: string,
  _fileName: string,
  mimeType: string,
  opts?: { durationSec?: number },
): Promise<{ url: string; mediaType: string }> {
  const parameters: Record<string, string> = {};
  if (opts?.durationSec != null && Number.isFinite(opts.durationSec)) {
    parameters.durationSec = String(opts.durationSec);
  }
  // FileSystem.uploadAsync streams the file entirely in native code — the bytes
  // never enter the Hermes JS heap, preventing the OOM kills on large media files.
  const result = await FileSystem.uploadAsync(
    apiUrl(`/uploads/${route}`),
    localUri,
    {
      httpMethod: "POST",
      uploadType: FileSystem.FileSystemUploadType.MULTIPART,
      fieldName: "file",
      mimeType,
      headers: authHeaders(token),
      parameters,
    },
  );
  let data: { error?: string; url?: string; mediaType?: string } = {};
  try { data = JSON.parse(result.body); } catch { /* non-JSON body */ }
  if (result.status < 200 || result.status >= 300) {
    const kind = route === "post-image" ? "image" : route === "post-video" ? "video" : "audio";
    throw new Error(messageForUploadFailure({ status: result.status } as Response, data, kind));
  }
  if (typeof data?.url !== "string") {
    throw new Error("Upload failed: server did not return a file URL.");
  }
  return { url: data.url, mediaType: data.mediaType ?? "unknown" };
}

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

async function uploadPostImage(localUri: string, token: string): Promise<string> {
  const result = await FileSystem.uploadAsync(
    apiUrl("/uploads/post-image"),
    localUri,
    {
      httpMethod: "POST",
      uploadType: FileSystem.FileSystemUploadType.MULTIPART,
      fieldName: "file",
      mimeType: "image/jpeg",
      headers: authHeaders(token),
    },
  );
  let data: { error?: string; url?: string } = {};
  try { data = JSON.parse(result.body); } catch { /* non-JSON body */ }
  if (result.status < 200 || result.status >= 300) {
    throw new Error(messageForUploadFailure({ status: result.status } as Response, data, "image"));
  }
  if (typeof data?.url !== "string") {
    throw new Error("Upload failed: server did not return a file URL.");
  }
  return data.url;
}

export default function NewPostScreen() {
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { token, user } = useAuth();
  const { showNotice } = useFeedNotice();
  const [content, setContent] = useState("");
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const { mutate: createPost, isPending } = useCreatePost();
  const [aiCategories, setAiCategories] = useState<string[]>([]);
  const [aiLoading, setAiLoading] = useState(false);
  const [pendingMedia, setPendingMedia] = useState<PendingMedia | null>(null);
  const [uploadBusy, setUploadBusy] = useState(false);

  const botPad = Platform.OS === "web" ? 34 : insets.bottom;
  const { gutter, uiScale, cardRadius } = useResponsiveLayout();
  const containerGap = Math.round(clamp(16 * uiScale, 14, 18));
  const scrollPadT = Math.round(clamp(12 * uiScale, 10, 14));
  const scrollPadB = Math.round(clamp(32 * uiScale, 24, 40));
  const fsLead = Math.round(clamp(13 * uiScale, 12, 15));
  const lhLead = Math.round(fsLead * 1.35);
  const cardPad = Math.round(clamp(16 * uiScale, 14, 20));
  const cardRad = Math.round(clamp(cardRadius, 28, 40));
  const cardBorder = Math.max(1, Math.round(1.5 * uiScale));
  const fsPrayer = Math.round(clamp(16 * uiScale, 15, 18));
  const lhPrayer = Math.round(fsPrayer * 1.5);
  const minPrayerH = Math.round(clamp(180 * uiScale, 140, 220));
  const fsChar = Math.round(clamp(12 * uiScale, 11, 13));
  const submitPadV = Math.round(clamp(16 * uiScale, 14, 18));
  const submitRad = Math.round(clamp(32 * uiScale, 28, 36));
  const submitGap = Math.round(clamp(8 * uiScale, 6, 10));
  const sendIcn = Math.round(clamp(18 * uiScale, 16, 20));
  const fsSubmit = Math.round(clamp(16 * uiScale, 15, 18));
  const fsSection = Math.round(clamp(13 * uiScale, 12, 15));
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
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      showAppAlert({
        title: "Permission needed",
        message: "Allow photo library access to attach an image.",
      });
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
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
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      showAppAlert({
        title: "Permission needed",
        message: "Allow library access to attach a video.",
      });
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["videos"],
      allowsEditing: false,
      quality: 1,
    });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];

    // Determine actual file size — picker-reported is often wrong on Android, so fall back to FileSystem
    let sz = asset.fileSize != null && asset.fileSize > 0 ? asset.fileSize : 0;
    if (sz === 0) {
      try {
        const info = await FileSystem.getInfoAsync(asset.uri);
        if (info.exists && "size" in info && typeof info.size === "number") sz = info.size;
      } catch { /* ignore — let the server validate */ }
    }
    if (sz > 0 && sz > MAX_VIDEO_BYTES) {
      showAppAlert({
        title: "Video too large",
        message: "Choose a shorter clip (under 12MB).",
      });
      return;
    }

    const a = asset as ImagePicker.ImagePickerAsset & { durationMillis?: number };
    const rawDur =
      typeof a.duration === "number"
        ? a.duration
        : typeof a.durationMillis === "number"
          ? a.durationMillis
          : null;
    // expo-image-picker: duration is often in seconds on iOS and milliseconds on Android.
    // On many Android devices it is null — the server will handle duration enforcement.
    const durSec =
      rawDur == null ? null : rawDur > 1000 ? rawDur / 1000 : rawDur;

    // Only reject if we can definitively read the duration and it exceeds the limit
    if (durSec != null && Number.isFinite(durSec) && durSec > 0 && durSec > MAX_VIDEO_DURATION_SEC) {
      showAppAlert({
        title: "Video too long",
        message: `Choose a clip of ${MAX_VIDEO_DURATION_SEC} seconds or less.`,
      });
      return;
    }

    const mime =
      "mimeType" in asset && typeof (asset as { mimeType?: string }).mimeType === "string"
        ? (asset as { mimeType: string }).mimeType
        : "video/mp4";
    const fileName = mime.includes("quicktime") ? "clip.mov" : "clip.mp4";
    setPendingMedia({
      kind: "video",
      uri: asset.uri,
      mimeType: mime,
      fileName,
      durationSec: durSec ?? 0,
    });
  };

  const pickAudio = async () => {
    if (Platform.OS === "web") {
      showAppAlert({
        title: "Audio",
        message: "Audio attach works on the iOS or Android app.",
      });
      return;
    }
    const result = await DocumentPicker.getDocumentAsync({
      type: "audio/*",
      copyToCacheDirectory: true,
      multiple: false,
    });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    const pickerReported =
      "size" in asset && typeof (asset as { size?: number }).size === "number"
        ? (asset as { size: number }).size
        : 0;
    const info = await FileSystem.getInfoAsync(asset.uri);
    const infoSize =
      info.exists && "size" in info && typeof info.size === "number" ? info.size : 0;
    const sz = pickerReported > 0 ? pickerReported : infoSize;
    if (sz > MAX_AUDIO_BYTES) {
      showAppAlert({
        title: "Audio too large",
        message: "Choose a file under 15MB.",
      });
      return;
    }
    const rawName =
      asset.name && asset.name.length > 0 ? asset.name.replace(/[^\w.\-]+/g, "_") : "audio.m4a";
    const rawMime =
      asset.mimeType && asset.mimeType.length > 0 ? asset.mimeType : "audio/mpeg";
    const mimeType = normalizeAudioMime(rawMime, rawName);
    setPendingMedia({ kind: "audio", uri: asset.uri, mimeType, name: rawName });
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
          const r = await uploadMultipart(
            pendingMedia.uri,
            token,
            "post-video",
            pendingMedia.fileName,
            pendingMedia.mimeType,
            { durationSec: pendingMedia.durationSec },
          );
          mediaUrl = r.url;
          postMediaType = CreatePostInputMediaType.video;
        } else {
          const r = await uploadMultipart(
            pendingMedia.uri,
            token,
            "post-audio",
            pendingMedia.name,
            pendingMedia.mimeType,
          );
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
          isAnonymous,
          category,
          ...(categories ? { categories } : {}),
          ...(mediaUrl && postMediaType ? { mediaUrl, mediaType: postMediaType } : {}),
        },
      },
      {
        onSuccess: (res: Post) => {
          try {
            void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          } catch {
            /* Haptics unavailable on some devices */
          }
          const isApproved = res?.status === "approved";
          showNotice(
            isApproved
              ? "Posted — you’ll see it at the top of the feed."
              : "Sent for review — it will appear after approval.",
            "success",
          );
          // Reset form state first to free memory before navigation
          setContent("");
          setIsAnonymous(false);
          setSelectedCategories([]);
          setAiCategories([]);
          setPendingMedia(null);
          // Invalidate feed queries so the feed refreshes when it gets focus
          queryClient.invalidateQueries({ queryKey: getGetPostsQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetTrendingPostsQueryKey() });
          if (user?.username) {
            queryClient.invalidateQueries({ queryKey: getGetUserPostsQueryKey(user.username) });
          }
          // Always navigate to the feed tab (top-level replace avoids going to
          // whatever was on the stack before — which could be any screen)
          router.replace("/(tabs)" as Href);
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
        <Text style={[styles.sectionLabel, { fontSize: fsSection }]}>
          Media (optional) — photos max 1MB after resize. Video max {MAX_VIDEO_DURATION_SEC}s / 12MB. Audio max 15MB. Media
          is reviewed before publishing.
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
              <View style={[styles.mediaPlaceholder, { gap: mediaPhGap }]}>
                <Ionicons name="videocam" size={mediaPhIcn} color={colors.primary} />
                <Text style={[styles.mediaPlaceholderText, { fontSize: fsMediaPh }]}>Video selected</Text>
              </View>
            ) : (
              <View style={[styles.mediaPlaceholder, { gap: mediaPhGap }]}>
                <Ionicons name="musical-notes" size={mediaPhIcn} color={colors.primary} />
                <Text style={[styles.mediaPlaceholderText, { fontSize: fsMediaPh }]}>Audio selected</Text>
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
        <View style={[styles.optionLeft, { gap: optLeftGap }]}>
          <Feather name="eye-off" size={optFeather} color={colors.primary} />
          <View>
            <Text style={[styles.optionLabel, { fontSize: fsOptLabel }]}>Post Anonymously</Text>
            <Text style={[styles.optionDesc, { fontSize: fsOptDesc }]}>Your name won&apos;t be shown</Text>
          </View>
        </View>
        <Switch
          value={isAnonymous}
          onValueChange={setIsAnonymous}
          trackColor={{ true: colors.primary, false: colors.border }}
          thumbColor={colors.surface}
          testID="anonymous-toggle"
        />
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
    marginTop: 4,
  },
  submitBtnDisabled: {
    opacity: 0.5,
  },
  submitBtnText: {
    fontFamily: "PlusJakartaSans_700Bold",
    color: colors.surface,
  },
});
