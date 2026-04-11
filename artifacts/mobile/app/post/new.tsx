import { Feather, Ionicons } from "@expo/vector-icons";
import * as FileSystem from "expo-file-system";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import * as ImageManipulator from "expo-image-manipulator";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
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
import { getApiBaseUrl } from "@/lib/apiBase";

const CATEGORIES = [
  "anxiety",
  "gratitude",
  "healing",
  "guidance",
  "relationships",
  "protection",
  "provision",
  "grief",
  "hope",
  "praise",
  "wisdom",
  "peace",
];

const MAX_UPLOAD_BYTES = 2 * 1024 * 1024;
const MAX_VIDEO_BYTES = 40 * 1024 * 1024;
const MAX_AUDIO_BYTES = 15 * 1024 * 1024;

type PendingMedia =
  | { kind: "image"; uri: string }
  | { kind: "video"; uri: string; mimeType: string; fileName: string }
  | { kind: "audio"; uri: string; mimeType: string; name: string };

async function uploadMultipart(
  localUri: string,
  token: string,
  route: string,
  fileName: string,
  mimeType: string,
): Promise<{ url: string; mediaType: string }> {
  const form = new FormData();
  form.append("file", {
    uri: localUri,
    name: fileName,
    type: mimeType,
  } as unknown as Blob);
  const res = await fetch(`${getApiBaseUrl()}/api/uploads/${route}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
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
  const res = await fetch(`${getApiBaseUrl()}/api/uploads/post-image`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
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
  const { token, user } = useAuth();
  const staff = user?.role === "admin" || user?.role === "moderator";
  const [content, setContent] = useState("");
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const { mutate: createPost, isPending } = useCreatePost();
  const [aiCategory, setAiCategory] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiMode, setAiMode] = useState(true);
  const [pendingMedia, setPendingMedia] = useState<PendingMedia | null>(null);
  const [uploadBusy, setUploadBusy] = useState(false);

  const botPad = Platform.OS === "web" ? 34 : insets.bottom;

  React.useEffect(() => {
    let cancelled = false;
    const trimmed = content.trim();
    if (!aiMode) return;
    if (trimmed.length < 12) {
      setAiCategory(null);
      return;
    }

    const t = setTimeout(async () => {
      try {
        setAiLoading(true);
        const base = getApiBaseUrl();
        const res = await fetch(`${base}/api/posts/suggest-category`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ content: trimmed }),
        });
        const data = await res.json().catch(() => null);
        if (cancelled) return;
        if (!res.ok) {
          setAiCategory(null);
          return;
        }
        const raw = data?.category;
        const normalized =
          typeof raw === "string" && CATEGORIES.includes(raw) ? raw : null;
        setAiCategory(normalized);
        if (normalized) {
          setSelectedCategory(normalized);
        }
      } catch {
        if (!cancelled) setAiCategory(null);
      } finally {
        if (!cancelled) setAiLoading(false);
      }
    }, 400);

    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [content, token, aiMode]);

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
    if (!staff || Platform.OS === "web") {
      showAppAlert({
        title: "Video",
        message: staff
          ? "Video attach works on the mobile app."
          : "Only moderators and admins can attach video.",
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
        message: "Choose a clip under 40MB.",
      });
      return;
    }
    const mime =
      "mimeType" in asset && typeof (asset as { mimeType?: string }).mimeType === "string"
        ? (asset as { mimeType: string }).mimeType
        : "video/mp4";
    const fileName = mime.includes("quicktime") ? "clip.mov" : "clip.mp4";
    setPendingMedia({ kind: "video", uri: asset.uri, mimeType: mime, fileName });
  };

  const pickAudio = async () => {
    if (!staff || Platform.OS === "web") {
      showAppAlert({
        title: "Audio",
        message: staff
          ? "Audio attach works on the mobile app."
          : "Only moderators and admins can attach audio.",
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
    const mimeType =
      asset.mimeType && asset.mimeType.length > 0 ? asset.mimeType : "audio/mpeg";
    const name =
      asset.name && asset.name.length > 0 ? asset.name.replace(/[^\w.\-]+/g, "_") : "audio.m4a";
    setPendingMedia({ kind: "audio", uri: asset.uri, mimeType, name });
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

    const category =
      (aiMode ? aiCategory ?? selectedCategory : selectedCategory) ?? undefined;

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
        onSuccess: () => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          showAppAlert({
            title: "Prayer submitted",
            message: "Your prayer is in review and will appear in the feed once approved.",
            buttons: [
              {
                text: "OK",
                onPress: () => {
                  setContent("");
                  setIsAnonymous(false);
                  setSelectedCategory(null);
                  setAiCategory(null);
                  setPendingMedia(null);
                  router.replace("/(tabs)");
                },
              },
            ],
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
    <ScrollView
      style={styles.flex}
      contentContainerStyle={[
        styles.container,
        { paddingTop: 12, paddingBottom: botPad + 40 },
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

      <View style={styles.imageSection}>
        <Text style={styles.sectionLabel}>
          Media (optional) — photos max ~2MB after resize
          {staff ? ". Mods: video max 40MB, audio max 15MB." : ""}
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
            {staff ? (
              <>
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
              </>
            ) : null}
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
            <Text style={styles.aiHint}>AI thinking…</Text>
          ) : aiCategory ? (
            <Pressable
              onPress={() => setAiMode((v) => !v)}
              style={[styles.aiPill, aiMode ? styles.aiPillOn : styles.aiPillOff]}
              testID="ai-toggle"
            >
              <Text style={[styles.aiPillText, aiMode && styles.aiPillTextOn]}>
                AI suggestion: {aiCategory}
              </Text>
            </Pressable>
          ) : (
            <Text style={styles.aiHint}>Optional</Text>
          )}
        </View>
        <View style={styles.categoryGrid}>
          {CATEGORIES.map((cat) => (
            <Pressable
              key={cat}
              onPress={() => {
                setAiMode(false);
                setSelectedCategory(selectedCategory === cat ? null : cat);
              }}
              style={[
                styles.categoryChip,
                (aiMode ? aiCategory : selectedCategory) === cat && styles.categoryChipSelected,
              ]}
            >
              <Text
                style={[
                  styles.categoryChipText,
                  (aiMode ? aiCategory : selectedCategory) === cat && styles.categoryChipTextSelected,
                ]}
              >
                {cat.charAt(0).toUpperCase() + cat.slice(1)}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={styles.notice}>
        <Ionicons name="information-circle-outline" size={16} color={colors.muted} />
        <Text style={styles.noticeText}>Prayers are reviewed before appearing in the feed.</Text>
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
    </ScrollView>
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
  aiPillOff: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
  },
  aiPillText: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 12,
    color: colors.textSecondary,
  },
  aiPillTextOn: {
    color: "#21638D",
  },
  categoryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  categoryChip: {
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
  categoryChipText: {
    fontFamily: "PlusJakartaSans_400Regular",
    fontSize: 13,
    color: colors.text,
  },
  categoryChipTextSelected: {
    color: colors.surface,
    fontFamily: "PlusJakartaSans_600SemiBold",
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
