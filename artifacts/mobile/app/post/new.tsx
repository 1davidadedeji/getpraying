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
import { CreatePostInputMediaType, useCreatePost } from "@workspace/api-client-react";
import { showAppAlert } from "@/components/AppAlert";
import colors from "@/constants/colors";
import { useAuth } from "@/context/auth";
import { CATEGORY_SLUGS } from "@/lib/categories";
import { apiUrl, authHeaders } from "@/lib/api";

const MAX_UPLOAD_BYTES = 1 * 1024 * 1024;
const MAX_VIDEO_BYTES = 12 * 1024 * 1024;
const MAX_VIDEO_DURATION_SEC = 10;
const MAX_AUDIO_BYTES = 15 * 1024 * 1024;

function normalizeAudioMime(mime: string, fileName: string): string {
  const m = mime.trim().toLowerCase();
  if (m && m !== "application/octet-stream") return mime;
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".m4a")) return "audio/mp4";
  if (lower.endsWith(".aac")) return "audio/aac";
  if (lower.endsWith(".wav")) return "audio/wav";
  if (lower.endsWith(".ogg")) return "audio/ogg";
  if (lower.endsWith(".webm")) return "audio/webm";
  if (lower.endsWith(".flac")) return "audio/flac";
  if (lower.endsWith(".caf")) return "audio/x-caf";
  if (lower.endsWith(".mp3")) return "audio/mpeg";
  return "audio/mpeg";
}

type PendingMedia =
  | { kind: "image"; uri: string }
  | { kind: "video"; uri: string; mimeType: string; fileName: string; durationSec: number }
  | { kind: "audio"; uri: string; mimeType: string; name: string };

async function uploadMultipart(
  localUri: string,
  token: string,
  route: string,
  fileName: string,
  mimeType: string,
  opts?: { durationSec?: number },
): Promise<{ url: string; mediaType: string }> {
  const form = new FormData();
  form.append("file", {
    uri: localUri,
    name: fileName,
    type: mimeType,
  } as unknown as Blob);
  if (opts?.durationSec != null && Number.isFinite(opts.durationSec)) {
    form.append("durationSec", String(opts.durationSec));
  }
  const res = await fetch(apiUrl(`/uploads/${route}`), {
    method: "POST",
    headers: authHeaders(token),
    body: form,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(typeof data?.error === "string" ? data.error : "Upload failed");
  }
  if (typeof data?.url !== "string") {
    throw new Error("Upload failed");
  }
  return { url: data.url, mediaType: data.mediaType };
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
  const form = new FormData();
  form.append("file", {
    uri: localUri,
    name: "prayer.jpg",
    type: "image/jpeg",
  } as unknown as Blob);
  const res = await fetch(apiUrl("/uploads/post-image"), {
    method: "POST",
    headers: authHeaders(token),
    body: form,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(typeof data?.error === "string" ? data.error : "Upload failed");
  }
  if (typeof data?.url !== "string") {
    throw new Error("Upload failed");
  }
  return data.url;
}

export default function NewPostScreen() {
  const insets = useSafeAreaInsets();
  const { token } = useAuth();
  const [content, setContent] = useState("");
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const { mutate: createPost, isPending } = useCreatePost();
  const [aiCategories, setAiCategories] = useState<string[]>([]);
  const [aiLoading, setAiLoading] = useState(false);
  const [pendingMedia, setPendingMedia] = useState<PendingMedia | null>(null);
  const [uploadBusy, setUploadBusy] = useState(false);

  const botPad = Platform.OS === "web" ? 34 : insets.bottom;

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
    if (asset.fileSize != null && asset.fileSize > MAX_VIDEO_BYTES) {
      showAppAlert({
        title: "Video too large",
        message: "Choose a shorter clip (under 12MB).",
      });
      return;
    }
    const rawDur =
      "duration" in asset && typeof (asset as { duration?: number }).duration === "number"
        ? (asset as { duration: number }).duration
        : null;
    // expo-image-picker returns duration in milliseconds on many platforms
    const durSec =
      rawDur == null ? null : rawDur > 1000 ? rawDur / 1000 : rawDur;
    if (durSec == null || durSec <= 0 || durSec > MAX_VIDEO_DURATION_SEC) {
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
      durationSec: durSec,
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
    const info = await FileSystem.getInfoAsync(asset.uri);
    const sz =
      info.exists && "size" in info && typeof info.size === "number" ? info.size : 0;
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

    // Use first selected category for DB storage (primary)
    const category = selectedCategories[0] ?? undefined;

    let mediaUrl: string | undefined;
    let postMediaType: CreatePostInputMediaType | undefined;

    if (pendingMedia) {
      setUploadBusy(true);
      try {
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
        setUploadBusy(false);
        showAppAlert({
          title: "Upload failed",
          message: e instanceof Error ? e.message : "Try again.",
        });
        return;
      }
      setUploadBusy(false);
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    createPost(
      {
        data: {
          content: content.trim(),
          isAnonymous,
          category,
          ...(mediaUrl && postMediaType ? { mediaUrl, mediaType: postMediaType } : {}),
        },
      },
      {
        onSuccess: (res: any) => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          setContent("");
          setIsAnonymous(false);
          setSelectedCategories([]);
          setAiCategories([]);
          setPendingMedia(null);
          const isApproved = res?.status === "approved";
          if (router.canGoBack()) {
            router.back();
          } else {
            router.replace("/(tabs)" as Href);
          }
          showAppAlert({
            title: isApproved ? "Posted" : "Submitted",
            message: isApproved
              ? "Your prayer is in the feed."
              : "Thanks — your prayer is in review and will appear after approval.",
            buttons: [{ text: "OK", style: "default" }],
          });
        },
        onError: (err: any) => {
          showAppAlert({
            title: "Could not submit",
            message: err?.data?.error ?? "Please check your connection and try again.",
          });
        },
      },
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? 64 : 0}
    >
      <ScrollView
        style={styles.flex}
        contentContainerStyle={[
          styles.container,
          { paddingTop: 12, paddingBottom: botPad + 32 },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
      <Text style={styles.lead}>Speak your heart. We’ll hold space.</Text>

      <View style={styles.card}>
        <TextInput
          style={styles.prayerInput}
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
        <Text style={styles.charCount}>{content.length}/2000</Text>
      </View>

      <Pressable
        style={[styles.submitBtn, (busy || !canSubmit) && styles.submitBtnDisabled]}
        onPress={() => void handleSubmit()}
        disabled={busy || !canSubmit}
        testID="submit-prayer-btn"
      >
        {busy ? (
          <ActivityIndicator color={colors.surface} />
        ) : (
          <>
            <Ionicons name="send" size={18} color={colors.surface} />
            <Text style={styles.submitBtnText}>Submit Prayer</Text>
          </>
        )}
      </Pressable>

      <View style={styles.imageSection}>
        <Text style={styles.sectionLabel}>
          Media (optional) — photos max 1MB after resize. Video max {MAX_VIDEO_DURATION_SEC}s / 12MB. Audio max 15MB. Media
          is reviewed before publishing.
        </Text>
        {pendingMedia ? (
          <View style={styles.imagePreviewWrap}>
            {pendingMedia.kind === "image" ? (
              <Image
                source={{ uri: pendingMedia.uri }}
                style={styles.imagePreview}
                contentFit="cover"
              />
            ) : pendingMedia.kind === "video" ? (
              <View style={styles.mediaPlaceholder}>
                <Ionicons name="videocam" size={36} color={colors.primary} />
                <Text style={styles.mediaPlaceholderText}>Video selected</Text>
              </View>
            ) : (
              <View style={styles.mediaPlaceholder}>
                <Ionicons name="musical-notes" size={36} color={colors.primary} />
                <Text style={styles.mediaPlaceholderText}>Audio selected</Text>
              </View>
            )}
            <Pressable style={styles.removeImageBtn} onPress={() => setPendingMedia(null)}>
              <Feather name="x" size={18} color={colors.surface} />
            </Pressable>
          </View>
        ) : (
          <View style={styles.mediaBtnGrid}>
            <Pressable
              style={[styles.addPhotoBtn, uploadBusy && styles.addPhotoBtnDisabled]}
              onPress={pickImage}
              disabled={uploadBusy}
            >
              {uploadBusy ? (
                <ActivityIndicator color={colors.primary} />
              ) : (
                <>
                  <Ionicons name="image-outline" size={22} color={colors.primary} />
                  <Text style={styles.addPhotoText}>Photo</Text>
                </>
              )}
            </Pressable>
            <Pressable
              style={[styles.addPhotoBtn, uploadBusy && styles.addPhotoBtnDisabled]}
              onPress={pickVideo}
              disabled={uploadBusy}
            >
              <Ionicons name="videocam-outline" size={22} color={colors.primary} />
              <Text style={styles.addPhotoText}>Video</Text>
            </Pressable>
            <Pressable
              style={[styles.addPhotoBtn, uploadBusy && styles.addPhotoBtnDisabled]}
              onPress={pickAudio}
              disabled={uploadBusy}
            >
              <Ionicons name="mic-outline" size={22} color={colors.primary} />
              <Text style={styles.addPhotoText}>Audio</Text>
            </Pressable>
          </View>
        )}
      </View>

      <View style={styles.option}>
        <View style={styles.optionLeft}>
          <Feather name="eye-off" size={18} color={colors.primary} />
          <View>
            <Text style={styles.optionLabel}>Post Anonymously</Text>
            <Text style={styles.optionDesc}>Your name won&apos;t be shown</Text>
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

      <View style={styles.categorySection}>
        <View style={styles.categoryHeader}>
          <Text style={styles.sectionLabel}>Category</Text>
          {aiLoading ? (
            <View style={styles.aiThinkingRow}>
              <ActivityIndicator size="small" color={colors.accent} />
              <Text style={styles.aiHint}>AI thinking…</Text>
            </View>
          ) : aiCategories.length > 0 ? (
            <View style={[styles.aiPill, styles.aiPillOn]}>
              <Text style={[styles.aiPillText, styles.aiPillTextOn]}>
                AI selected {aiCategories.length > 1 ? `${aiCategories.length} categories` : aiCategories[0]}
              </Text>
            </View>
          ) : (
            <Text style={styles.aiHint}>Optional — tap to select</Text>
          )}
        </View>
        <View style={styles.categoryGrid}>
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
                  isSelected && styles.categoryChipSelected,
                  isAiSuggested && !isSelected && styles.categoryChipAi,
                ]}
              >
                {isAiSuggested && <Text style={styles.aiDot}>✦ </Text>}
                <Text
                  style={[
                    styles.categoryChipText,
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
          <Pressable onPress={() => { setSelectedCategories([]); setAiCategories([]); }} style={styles.clearCats}>
            <Text style={styles.clearCatsText}>Clear selection</Text>
          </Pressable>
        )}
      </View>

      <View style={styles.notice}>
        <Ionicons name="information-circle-outline" size={16} color={colors.muted} />
        <Text style={styles.noticeText}>Prayers are reviewed before appearing in the feed.</Text>
      </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.cream },
  container: {
    paddingHorizontal: 20,
    gap: 16,
  },
  lead: {
    fontFamily: "PlusJakartaSans_400Regular",
    fontSize: 13,
    color: colors.muted,
    lineHeight: 18,
  },
  sectionLabel: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 13,
    color: colors.textSecondary,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 32,
    padding: 16,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  prayerInput: {
    fontFamily: "PlusJakartaSans_400Regular",
    fontSize: 16,
    color: colors.text,
    lineHeight: 24,
    minHeight: 180,
  },
  charCount: {
    fontFamily: "PlusJakartaSans_400Regular",
    fontSize: 12,
    color: colors.muted,
    textAlign: "right",
    marginTop: 8,
  },
  imageSection: {
    gap: 10,
  },
  mediaBtnGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  addPhotoBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    flex: 1,
    minWidth: 100,
    backgroundColor: colors.surface,
    borderRadius: 32,
    paddingVertical: 16,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: "dashed",
  },
  addPhotoBtnDisabled: { opacity: 0.6 },
  addPhotoText: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 15,
    color: colors.primary,
  },
  imagePreviewWrap: {
    borderRadius: 24,
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
    gap: 8,
  },
  mediaPlaceholderText: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 14,
    color: colors.primary,
  },
  removeImageBtn: {
    position: "absolute",
    top: 10,
    right: 10,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
  },
  option: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.surface,
    borderRadius: 32,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  optionLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  optionLabel: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 14,
    color: colors.text,
  },
  optionDesc: {
    fontFamily: "PlusJakartaSans_400Regular",
    fontSize: 12,
    color: colors.muted,
    marginTop: 1,
  },
  categorySection: {
    gap: 10,
  },
  categoryHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  aiHint: {
    fontFamily: "PlusJakartaSans_400Regular",
    fontSize: 12,
    color: colors.muted,
  },
  aiThinkingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  aiPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  aiPillOn: {
    backgroundColor: "#E3F2FD",
    borderColor: "#93CDFC",
  },
  aiPillText: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 12,
    color: colors.textSecondary,
  },
  aiPillTextOn: {
    color: "#21638D",
  },
  aiDot: {
    fontSize: 10,
    color: "#21638D",
  },
  categoryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  categoryChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 50,
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
    fontSize: 13,
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
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  clearCatsText: {
    fontFamily: "PlusJakartaSans_400Regular",
    fontSize: 12,
    color: colors.muted,
    textDecorationLine: "underline",
  },
  notice: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  noticeText: {
    fontFamily: "PlusJakartaSans_400Regular",
    fontSize: 12,
    color: colors.muted,
    flex: 1,
    lineHeight: 17,
  },
  submitBtn: {
    backgroundColor: colors.primary,
    borderRadius: 32,
    paddingVertical: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 4,
  },
  submitBtnDisabled: {
    opacity: 0.5,
  },
  submitBtnText: {
    fontFamily: "PlusJakartaSans_700Bold",
    fontSize: 16,
    color: colors.surface,
  },
});
