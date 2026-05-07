import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import * as Haptics from "expo-haptics";
import { Feather, Ionicons } from "@expo/vector-icons";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AudioLibraryPickerModal } from "@/components/AudioLibraryPickerModal";
import { showAppAlert } from "@/components/AppAlert";
import { LAYOUT } from "@/constants/layout";
import colors from "@/constants/colors";
import type { ApiLibraryCategory } from "@/constants/libraryFallbackPaths";
import type { OfficialPrayerRow } from "@/lib/officialPrayer";
import { useAuth } from "@/context/auth";
import { apiUrl, authHeaders } from "@/lib/api";
import { AUDIO_DOCUMENT_PICKER_TYPES } from "@/lib/audioDocumentTypes";
import { normalizeAudioMime } from "@/lib/audioMime";
import {
  OFFICIAL_GUIDE_CONTENT_MAX,
  OFFICIAL_GUIDE_SCRIPTURE_MAX,
  OFFICIAL_GUIDE_TITLE_MAX,
} from "@/lib/officialGuideFieldLimits";
import { parseApiJson } from "@/lib/parseUploadResponse";
import { useResponsiveLayout } from "@/hooks/useResponsiveLayout";
import { clamp } from "@/lib/responsiveMetrics";

const MAX_GUIDE_AUDIO_BYTES = 15 * 1024 * 1024;

type PathPick = ApiLibraryCategory & { pathId: number; category?: string };

async function uploadAudioFile(
  localUri: string,
  token: string,
  _fileName: string,
  mimeType: string,
): Promise<string> {
  const result = await FileSystem.uploadAsync(
    apiUrl("/uploads/post-audio"),
    localUri,
    {
      httpMethod: "POST",
      uploadType: FileSystem.FileSystemUploadType.MULTIPART,
      fieldName: "file",
      mimeType,
      headers: authHeaders(token),
    },
  );
  let data: { error?: string; url?: string } = {};
  try { data = JSON.parse(result.body); } catch { /* non-JSON body */ }
  if (result.status < 200 || result.status >= 300) {
    const msg =
      typeof data?.error === "string" && data.error.trim()
        ? data.error
        : result.status === 413
          ? "Audio file is too large. Choose a shorter recording."
          : "Upload failed. Please try again.";
    throw new Error(msg);
  }
  if (typeof data?.url !== "string") {
    throw new Error("Something went wrong with the upload. Please try again.");
  }
  return data.url;
}

export default function AdminOfficialGuidesScreen() {
  const insets = useSafeAreaInsets();
  const { token } = useAuth();
  const [paths, setPaths] = useState<PathPick[]>([]);
  const [pathsLoading, setPathsLoading] = useState(true);
  const [pathPickerOpen, setPathPickerOpen] = useState(false);

  const [selectedPath, setSelectedPath] = useState<PathPick | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [scripture, setScripture] = useState("");
  const [durationMinutes, setDurationMinutes] = useState("");
  const [scheduleSlot, setScheduleSlot] = useState<"morning" | "evening">("morning");
  const [publishKind, setPublishKind] = useState<"sanctuary" | "lecture">("sanctuary");
  const [audioName, setAudioName] = useState<string | null>(null);
  const [audioUri, setAudioUri] = useState<string | null>(null);
  const [audioMime, setAudioMime] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [picking, setPicking] = useState(false);
  const [existingPrayers, setExistingPrayers] = useState<OfficialPrayerRow[]>([]);
  const [loadingExisting, setLoadingExisting] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [audioLibraryOpen, setAudioLibraryOpen] = useState(false);
  const [editingOfficialId, setEditingOfficialId] = useState<number | null>(null);
  const [editKeepAudioUrl, setEditKeepAudioUrl] = useState<string | null>(null);
  const [editCategoryBaseline, setEditCategoryBaseline] = useState("general");
  const [existingFilter, setExistingFilter] = useState<"all" | "morning" | "evening" | "lectures">("all");

  const loadExistingPrayers = useCallback(async () => {
    if (!token) return;
    setLoadingExisting(true);
    try {
      const res = await fetch(apiUrl("/library/official?limit=100"), { headers: authHeaders(token) });
      if (!res.ok) return;
      const data = await res.json();
      setExistingPrayers((data as { prayers?: OfficialPrayerRow[] }).prayers ?? []);
    } catch {
      /* silent */
    } finally {
      setLoadingExisting(false);
    }
  }, [token]);

  const deleteOfficialPrayer = (prayer: OfficialPrayerRow) => {
    showAppAlert({
      title: "Delete this guide?",
      message: `"${prayer.title}" will be permanently removed from the library.`,
      buttons: [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            setDeletingId(prayer.id);
            try {
              const res = await fetch(apiUrl(`/admin/official-prayers/${prayer.id}`), {
                method: "DELETE",
                headers: authHeaders(token),
              });
              if (res.ok) {
                setExistingPrayers((prev) => prev.filter((p) => p.id !== prayer.id));
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              } else {
                const err = await res.json().catch(() => ({}));
                showAppAlert({ title: "Could not delete", message: (err as any).error ?? "Try again." });
              }
            } catch {
              showAppAlert({ title: "Could not delete", message: "Network error." });
            } finally {
              setDeletingId(null);
            }
          },
        },
      ],
    });
  };

  const cancelEditMode = useCallback(() => {
    setEditingOfficialId(null);
    setEditKeepAudioUrl(null);
    setEditCategoryBaseline("general");
    setTitle("");
    setContent("");
    setScripture("");
    setDurationMinutes("");
    setAudioUri(null);
    setAudioMime(null);
    setAudioName(null);
    setPublishKind("sanctuary");
    setScheduleSlot("morning");
  }, []);

  const beginEdit = useCallback(
    (prayer: OfficialPrayerRow) => {
      setEditingOfficialId(prayer.id);
      setEditKeepAudioUrl(prayer.audioUrl ?? null);
      setEditCategoryBaseline(prayer.category);
      setTitle(prayer.title);
      setContent(prayer.content);
      setScripture(prayer.scripture ?? "");
      setDurationMinutes(prayer.durationMinutes != null ? String(prayer.durationMinutes) : "");
      const isLecture = prayer.category === "lectures" && !prayer.scheduleSlot;
      setPublishKind(isLecture ? "lecture" : "sanctuary");
      if (prayer.scheduleSlot === "morning" || prayer.scheduleSlot === "evening") {
        setScheduleSlot(prayer.scheduleSlot);
      }
      setSelectedPath(prayer.pathId != null ? paths.find((x) => x.pathId === prayer.pathId) ?? null : null);
      setAudioUri(null);
      setAudioMime(null);
      setAudioName(null);
      Haptics.selectionAsync();
    },
    [paths],
  );

  const filteredOfficial = useMemo(() => {
    if (existingFilter === "morning") return existingPrayers.filter((p) => p.scheduleSlot === "morning");
    if (existingFilter === "evening") return existingPrayers.filter((p) => p.scheduleSlot === "evening");
    if (existingFilter === "lectures")
      return existingPrayers.filter((p) => p.category === "lectures" && !p.scheduleSlot);
    return existingPrayers;
  }, [existingPrayers, existingFilter]);

  const loadPaths = useCallback(async () => {
    setPathsLoading(true);
    try {
      const res = await fetch(apiUrl("/library/categories"), { headers: authHeaders(token) });
      if (!res.ok) {
        setPaths([]);
        return;
      }
      const data = (await res.json()) as ApiLibraryCategory[];
      const withIds = (Array.isArray(data) ? data : [])
        .filter((p): p is PathPick => typeof p.pathId === "number" && p.pathId > 0)
        .map((p) => ({ ...p, pathId: p.pathId! }));
      setPaths(withIds);
      setSelectedPath((prev) => (prev != null ? prev : null));
    } catch {
      setPaths([]);
    } finally {
      setPathsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (publishKind !== "sanctuary" || paths.length === 0) return;
    setSelectedPath((p) => p ?? paths[0] ?? null);
  }, [publishKind, paths]);

  useEffect(() => {
    void loadPaths();
    void loadExistingPrayers();
  }, [loadPaths, loadExistingPrayers]);

  const pickAudioFromDocuments = async () => {
    setPicking(true);
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: AUDIO_DOCUMENT_PICKER_TYPES,
        copyToCacheDirectory: true,
      });
      if (res.canceled || !res.assets?.[0]) return;
      const a = res.assets[0];
      const name = a.name ?? "audio";
      const pickerReported =
        "size" in a && typeof (a as { size?: number }).size === "number"
          ? (a as { size: number }).size
          : 0;
      const info = await FileSystem.getInfoAsync(a.uri);
      const infoSize =
        info.exists && "size" in info && typeof info.size === "number" ? info.size : 0;
      const sz = pickerReported > 0 ? pickerReported : infoSize;
      if (sz > MAX_GUIDE_AUDIO_BYTES) {
        showAppAlert({
          title: "Audio too large",
          message: "Choose a file under 15MB.",
        });
        return;
      }
      setAudioUri(a.uri);
      setAudioMime(normalizeAudioMime(a.mimeType ?? "audio/mpeg", name));
      setAudioName(name);
    } catch {
      showAppAlert({ title: "Picker failed", message: "Could not open file picker." });
    } finally {
      setPicking(false);
    }
  };

  const pickAudio = () => {
    if (Platform.OS === "web") {
      void pickAudioFromDocuments();
      return;
    }
    setAudioLibraryOpen(true);
  };

  const submit = async () => {
    if (!token || !title.trim() || !content.trim()) {
      showAppAlert({ title: "Missing fields", message: "Add a title and description." });
      return;
    }
    const t = title.trim();
    const c = content.trim();
    const scr = scripture.trim();
    if (t.length > OFFICIAL_GUIDE_TITLE_MAX || c.length > OFFICIAL_GUIDE_CONTENT_MAX) {
      showAppAlert({
        title: "Text too long",
        message: `Title max ${OFFICIAL_GUIDE_TITLE_MAX} characters; description max ${OFFICIAL_GUIDE_CONTENT_MAX}.`,
      });
      return;
    }
    if (scr.length > OFFICIAL_GUIDE_SCRIPTURE_MAX) {
      showAppAlert({
        title: "Scripture too long",
        message: `Scripture max ${OFFICIAL_GUIDE_SCRIPTURE_MAX} characters.`,
      });
      return;
    }
    const dm = durationMinutes.trim() ? parseInt(durationMinutes.trim(), 10) : null;
    const durationPayload =
      dm != null && !Number.isNaN(dm) && dm > 0 ? dm : undefined;

    if (editingOfficialId != null) {
      setBusy(true);
      try {
        let audioUrlFinal = editKeepAudioUrl;
        if (audioUri && audioMime) {
          try {
            const fileInfo = await FileSystem.getInfoAsync(audioUri);
            if (!fileInfo.exists) {
              showAppAlert({
                title: "File not accessible",
                message: "The audio file could not be read. Please re-select it and try again.",
              });
              setAudioUri(null);
              setAudioMime(null);
              setAudioName(null);
              return;
            }
            audioUrlFinal = await uploadAudioFile(audioUri, token, audioName ?? "guide.m4a", audioMime);
          } catch (e) {
            showAppAlert({
              title: "Upload failed",
              message: e instanceof Error ? e.message : "Could not upload audio.",
            });
            return;
          }
        }
        if (!audioUrlFinal || !String(audioUrlFinal).trim()) {
          showAppAlert({
            title: "Audio required",
            message: "This guide needs audio. Choose a file to replace it, or keep the existing track without picking a new one.",
          });
          return;
        }
        const categoryPut = publishKind === "lecture" ? "lectures" : editCategoryBaseline;
        const res = await fetch(apiUrl(`/admin/official-prayers/${editingOfficialId}`), {
          method: "PUT",
          headers: authHeaders(token, { "Content-Type": "application/json" }),
          body: JSON.stringify({
            title: t,
            content: c,
            category: categoryPut,
            scripture: scr || undefined,
            durationMinutes: durationPayload,
            audioUrl: audioUrlFinal,
            pathId: selectedPath?.pathId ?? null,
            label: publishKind === "lecture" ? "Lecture" : undefined,
          }),
        });
        const data = await parseApiJson(res);
        if (!res.ok) {
          const errMsg = typeof data.error === "string" ? data.error : "Try again.";
          showAppAlert({ title: "Could not save", message: errMsg });
          return;
        }
        void loadExistingPrayers();
        cancelEditMode();
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        showAppAlert({ title: "Saved", message: "Library guide updated." });
      } catch {
        showAppAlert({ title: "Could not save", message: "Network error." });
      } finally {
        setBusy(false);
      }
      return;
    }

    if (publishKind === "sanctuary" && !selectedPath) {
      showAppAlert({
        title: "Choose a path",
        message: "Pick where previous guides are archived for this sanctuary slot.",
      });
      return;
    }
    if (!audioUri || !audioMime) {
      showAppAlert({
        title: "Audio required",
        message:
          publishKind === "lecture"
            ? "Upload an audio file for this lecture."
            : "Upload an audio file for this sanctuary guide.",
      });
      return;
    }

    setBusy(true);
    try {
      let audioUrl: string;
      try {
        const fileInfo = await FileSystem.getInfoAsync(audioUri);
        if (!fileInfo.exists) {
          showAppAlert({
            title: "File not accessible",
            message: "The audio file could not be read. Please re-select it and try again.",
          });
          setAudioUri(null);
          setAudioMime(null);
          setAudioName(null);
          return;
        }
        audioUrl = await uploadAudioFile(audioUri, token, audioName ?? "guide.m4a", audioMime);
      } catch (e) {
        showAppAlert({
          title: "Upload failed",
          message: e instanceof Error ? e.message : "Could not upload audio.",
        });
        return;
      }

      if (publishKind === "lecture") {
        const res = await fetch(apiUrl("/admin/official-prayers"), {
          method: "POST",
          headers: authHeaders(token, { "Content-Type": "application/json" }),
          body: JSON.stringify({
            title: t,
            content: c,
            category: "lectures",
            scripture: scr || undefined,
            durationMinutes: durationPayload,
            audioUrl,
            pathId: selectedPath?.pathId ?? null,
            label: "Lecture",
          }),
        });
        const data = await parseApiJson(res);
        if (!res.ok) {
          const errMsg = typeof data.error === "string" ? data.error : "Try again.";
          showAppAlert({ title: "Could not save", message: errMsg });
          return;
        }
        void loadExistingPrayers();
        setTitle("");
        setContent("");
        setScripture("");
        setDurationMinutes("");
        setAudioUri(null);
        setAudioMime(null);
        setAudioName(null);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        showAppAlert({
          title: "Lecture published",
          message: "It appears under Lectures on the Official Prayers Library tab.",
        });
        return;
      }

      const category = (selectedPath!.category ?? "general").trim() || "general";
      const archivePathId = selectedPath!.pathId;

      const res = await fetch(apiUrl("/admin/official-prayers/schedule-slot"), {
        method: "POST",
        headers: authHeaders(token, { "Content-Type": "application/json" }),
        body: JSON.stringify({
          slot: scheduleSlot,
          archivePathId,
          title: t,
          content: c,
          category,
          scripture: scr || undefined,
          durationMinutes: durationPayload,
          audioUrl,
          label: scheduleSlot === "morning" ? "Official Sanctuary" : "Vesper Light",
        }),
      });
      const data = await parseApiJson(res);
      if (!res.ok) {
        const errMsg = typeof data.error === "string" ? data.error : "Try again.";
        showAppAlert({ title: "Could not save", message: errMsg });
        return;
      }
      void loadExistingPrayers();
      setTitle("");
      setContent("");
      setScripture("");
      setDurationMinutes("");
      setAudioUri(null);
      setAudioMime(null);
      setAudioName(null);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showAppAlert({
        title: "Guide published",
        message: "The sanctuary card updates in the Library. The previous session was archived to the path you chose.",
      });
    } catch {
      showAppAlert({ title: "Could not save", message: "Network error." });
    } finally {
      setBusy(false);
    }
  };

  const botPad = Platform.OS === "web" ? 34 : insets.bottom;
  const { gutter, uiScale } = useResponsiveLayout();
  const pad = gutter;
  const scrollBot = Math.round(clamp(32 * uiScale, 24, 40));
  const fsSection = Math.round(clamp(13 * uiScale, 12, 15));
  const sectionMb = Math.round(clamp(8 * uiScale, 6, 10));
  const fsHint = Math.round(clamp(13 * uiScale, 12, 15));
  const lhHint = Math.round(fsHint * 1.35);
  const hintMb = Math.round(clamp(16 * uiScale, 14, 18));
  const fsField = Math.round(clamp(12 * uiScale, 11, 13));
  const fieldMb = Math.round(clamp(6 * uiScale, 5, 8));
  const selectPad = Math.round(clamp(12 * uiScale, 10, 14));
  const selectRad = Math.round(clamp(12 * uiScale, 10, 14));
  const selectMb = Math.round(clamp(14 * uiScale, 12, 16));
  const fsSelect = Math.round(clamp(14 * uiScale, 13, 16));
  const slotGap = Math.round(clamp(8 * uiScale, 6, 10));
  const slotMb = Math.round(clamp(12 * uiScale, 10, 14));
  const slotPadV = Math.round(clamp(10 * uiScale, 8, 12));
  const slotRad = Math.round(clamp(12 * uiScale, 10, 14));
  const fsSlot = Math.round(clamp(14 * uiScale, 13, 16));
  const inputPad = Math.round(clamp(12 * uiScale, 10, 14));
  const inputRad = Math.round(clamp(12 * uiScale, 10, 14));
  const fsInput = Math.round(clamp(14 * uiScale, 13, 16));
  const inputMb = Math.round(clamp(10 * uiScale, 8, 12));
  const multiMinH = Math.round(clamp(100 * uiScale, 88, 120));
  const pickPad = Math.round(clamp(12 * uiScale, 10, 14));
  const pickRad = Math.round(clamp(12 * uiScale, 10, 14));
  const pickMb = Math.round(clamp(12 * uiScale, 10, 14));
  const fsPick = Math.round(clamp(14 * uiScale, 13, 16));
  const pubPadV = Math.round(clamp(14 * uiScale, 12, 16));
  const pubRad = Math.round(clamp(12 * uiScale, 10, 14));
  const fsPub = Math.round(clamp(15 * uiScale, 14, 16));
  const divMv = Math.round(clamp(24 * uiScale, 20, 28));
  const existHeadMb = Math.round(clamp(6 * uiScale, 5, 8));
  const refreshIcn = Math.round(clamp(16 * uiScale, 14, 18));
  const rowPad = Math.round(clamp(12 * uiScale, 10, 14));
  const rowRad = Math.round(clamp(12 * uiScale, 10, 14));
  const rowMb = Math.round(clamp(8 * uiScale, 6, 10));
  const rowGap = Math.round(clamp(10 * uiScale, 8, 12));
  const slotBadgeIcn = Math.round(clamp(12 * uiScale, 11, 13));
  const fsSlotBadge = Math.round(clamp(10 * uiScale, 9, 11));
  const fsExistTitle = Math.round(clamp(14 * uiScale, 13, 16));
  const fsExistCat = Math.round(clamp(12 * uiScale, 11, 13));
  const trashIcn = Math.round(clamp(17 * uiScale, 15, 19));
  const modalSheetPad = Math.round(clamp(20 * uiScale, 18, 24));
  const modalSheetBot = Math.round(clamp(32 * uiScale, 26, 38));
  const modalTopRad = Math.round(clamp(20 * uiScale, 18, 24));
  const fsModalTitle = Math.round(clamp(18 * uiScale, 16, 20));
  const modalTitleMb = Math.round(clamp(6 * uiScale, 5, 8));
  const fsModalHint = Math.round(clamp(13 * uiScale, 12, 14));
  const modalHintMb = Math.round(clamp(12 * uiScale, 10, 14));
  const pathRowPadV = Math.round(clamp(12 * uiScale, 10, 14));
  const pathRowPadH = Math.round(clamp(12 * uiScale, 10, 14));
  const pathRowRad = Math.round(clamp(12 * uiScale, 10, 14));
  const pathRowMb = Math.round(clamp(8 * uiScale, 6, 10));
  const fsPathTitle = Math.round(clamp(15 * uiScale, 14, 16));
  const fsPathMeta = Math.round(clamp(12 * uiScale, 11, 13));
  const modalCloseMt = Math.round(clamp(12 * uiScale, 10, 14));
  const modalClosePadV = Math.round(clamp(12 * uiScale, 10, 14));
  const fsModalClose = Math.round(clamp(15 * uiScale, 14, 16));
  const modalScrollMaxH = Math.round(clamp(320 * uiScale, 260, 360));

  return (
    <>
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: colors.cream, maxWidth: LAYOUT.contentMaxWidth, width: "100%", alignSelf: "center" }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.cream }}
      contentContainerStyle={{ paddingHorizontal: pad, paddingTop: pad, paddingBottom: botPad + scrollBot }}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={[styles.sectionTitle, { fontSize: fsSection, marginBottom: sectionMb }]}>Official guides & lectures</Text>
      <Text style={[styles.hint, { fontSize: fsHint, lineHeight: lhHint, marginBottom: hintMb }]}>
        {publishKind === "sanctuary"
          ? "Morning and evening sanctuary slots archive the replaced recording into the path you pick. Lectures publish into the carousel under Library Official Prayers without taking a slot."
          : "Lectures are longer listens that appear under Lectures in the Library (category “lectures”). Linking a prayer path is optional."}
      </Text>

      <Text style={[styles.fieldLabel, { fontSize: fsField, marginBottom: fieldMb }]}>Publish as</Text>
      <View style={[styles.slotRow, { gap: slotGap, marginBottom: slotMb }]}>
        {(["sanctuary", "lecture"] as const).map((k) => (
          <Pressable
            key={k}
            style={[
              styles.slotBtn,
              { paddingVertical: slotPadV, borderRadius: slotRad },
              publishKind === k && styles.slotBtnOn,
            ]}
            onPress={() => setPublishKind(k)}
          >
            <Text style={[styles.slotBtnText, { fontSize: fsSlot }, publishKind === k && styles.slotBtnTextOn]}>
              {k === "sanctuary" ? "Sanctuary slot" : "Library lecture"}
            </Text>
          </Pressable>
        ))}
      </View>

      <Text style={[styles.fieldLabel, { fontSize: fsField, marginBottom: fieldMb }]}>
        Path {publishKind === "sanctuary" ? "(archive & category)" : "(optional)"}
      </Text>
      <Pressable
        style={[
          styles.selectBtn,
          {
            padding: selectPad,
            borderRadius: selectRad,
            marginBottom: selectMb,
          },
        ]}
        onPress={() => setPathPickerOpen(true)}
        disabled={pathsLoading || (publishKind === "sanctuary" && paths.length === 0)}
      >
        <Text style={[styles.selectBtnText, { fontSize: fsSelect }]} numberOfLines={2}>
          {pathsLoading
            ? "Loading paths…"
            : publishKind === "lecture"
              ? selectedPath
                ? `${selectedPath.name} — tagged for lectures`
                : "No path linked (recommended for carousel-only listens)"
              : selectedPath
                ? `${selectedPath.name} — guides archived here`
                : "No paths — create one in admin first"}
        </Text>
      </Pressable>

      {publishKind === "sanctuary" ? (
        <>
      <Text style={[styles.fieldLabel, { fontSize: fsField, marginBottom: fieldMb }]}>Slot</Text>
      <View style={[styles.slotRow, { gap: slotGap, marginBottom: slotMb }]}>
        {(["morning", "evening"] as const).map((s) => (
          <Pressable
            key={s}
            style={[
              styles.slotBtn,
              { paddingVertical: slotPadV, borderRadius: slotRad },
              scheduleSlot === s && styles.slotBtnOn,
            ]}
            onPress={() => setScheduleSlot(s)}
          >
            <Text style={[styles.slotBtnText, { fontSize: fsSlot }, scheduleSlot === s && styles.slotBtnTextOn]}>
              {s === "morning" ? "Morning" : "Evening"}
            </Text>
          </Pressable>
        ))}
      </View>
        </>
      ) : null}

      <Text style={[styles.charCount, { fontSize: fsField - 1, marginBottom: fieldMb }]}>
        Title · {title.length}/{OFFICIAL_GUIDE_TITLE_MAX}
      </Text>
      <TextInput
        value={title}
        onChangeText={setTitle}
        placeholder="Title"
        placeholderTextColor={colors.muted}
        maxLength={OFFICIAL_GUIDE_TITLE_MAX}
        style={[
          styles.input,
          {
            padding: inputPad,
            borderRadius: inputRad,
            fontSize: fsInput,
            marginBottom: inputMb,
          },
        ]}
      />
      <Text style={[styles.charCount, { fontSize: fsField - 1, marginBottom: fieldMb }]}>
        Description · {content.length}/{OFFICIAL_GUIDE_CONTENT_MAX}
      </Text>
      <TextInput
        value={content}
        onChangeText={setContent}
        placeholder="Description"
        placeholderTextColor={colors.muted}
        maxLength={OFFICIAL_GUIDE_CONTENT_MAX}
        style={[
          styles.input,
          styles.inputMultiline,
          {
            padding: inputPad,
            borderRadius: inputRad,
            fontSize: fsInput,
            marginBottom: inputMb,
            minHeight: multiMinH,
          },
        ]}
        multiline
        textAlignVertical="top"
      />
      <Text style={[styles.charCount, { fontSize: fsField - 1, marginBottom: fieldMb }]}>
        Scripture (optional) · {scripture.length}/{OFFICIAL_GUIDE_SCRIPTURE_MAX}
      </Text>
      <TextInput
        value={scripture}
        onChangeText={setScripture}
        placeholder="Scripture (optional, e.g. Psalm 34:4)"
        placeholderTextColor={colors.muted}
        maxLength={OFFICIAL_GUIDE_SCRIPTURE_MAX}
        style={[
          styles.input,
          {
            padding: inputPad,
            borderRadius: inputRad,
            fontSize: fsInput,
            marginBottom: inputMb,
          },
        ]}
      />
      <TextInput
        value={durationMinutes}
        onChangeText={setDurationMinutes}
        placeholder="Duration in minutes (optional)"
        placeholderTextColor={colors.muted}
        style={[
          styles.input,
          {
            padding: inputPad,
            borderRadius: inputRad,
            fontSize: fsInput,
            marginBottom: inputMb,
          },
        ]}
        keyboardType="number-pad"
      />

      <Pressable
        style={[
          styles.pickBtn,
          { padding: pickPad, borderRadius: pickRad, marginBottom: pickMb },
          picking && { opacity: 0.6 },
        ]}
        onPress={() => void pickAudio()}
        disabled={picking}
      >
        <Text style={[styles.pickBtnText, { fontSize: fsPick }]}>
          {picking
            ? "Opening…"
            : audioName
              ? `Audio: ${audioName}`
              : editingOfficialId != null && editKeepAudioUrl
                ? "Keeping existing audio — tap to replace"
                : "Choose audio file (required)"}
        </Text>
      </Pressable>

      {editingOfficialId != null ? (
        <Pressable
          onPress={cancelEditMode}
          style={[styles.cancelEditBtn, { paddingVertical: pubPadV, borderRadius: pubRad, marginBottom: pickMb }]}
        >
          <Text style={[styles.cancelEditBtnText, { fontSize: fsPub }]}>Cancel editing</Text>
        </Pressable>
      ) : null}

      <Pressable
        style={[
          styles.publishBtn,
          { paddingVertical: pubPadV, borderRadius: pubRad },
          busy && { opacity: 0.6 },
        ]}
        onPress={() => void submit()}
        disabled={busy}
      >
        {busy ? (
          <ActivityIndicator color={colors.surface} />
        ) : (
          <Text style={[styles.publishBtnText, { fontSize: fsPub }]}>
            {editingOfficialId != null
              ? "Save changes"
              : publishKind === "sanctuary"
                ? "Publish sanctuary guide"
                : "Publish lecture"}
          </Text>
        )}
      </Pressable>

      {/* Existing Library Content */}
      <View style={[styles.divider, { marginVertical: divMv }]} />
      <View style={[styles.existingHeader, { marginBottom: existHeadMb }]}>
        <Text style={[styles.sectionTitle, { fontSize: fsSection, marginBottom: 0 }]}>Existing library guides</Text>
        <Pressable onPress={() => void loadExistingPrayers()} hitSlop={8} disabled={loadingExisting}>
          <Feather name="refresh-cw" size={refreshIcn} color={colors.primary} />
        </Pressable>
      </View>
      <Text style={[styles.hint, { fontSize: fsHint, lineHeight: lhHint, marginBottom: hintMb }]}>
        Filter the list. Edit opens the form above; delete removes permanently.
      </Text>

      <View style={[styles.slotRow, { gap: slotGap, marginBottom: slotMb }]}>
        {(["all", "morning", "evening", "lectures"] as const).map((f) => (
          <Pressable
            key={f}
            style={[
              styles.slotBtn,
              { flex: 1, minWidth: 0, paddingVertical: slotPadV, borderRadius: slotRad },
              existingFilter === f && styles.slotBtnOn,
            ]}
            onPress={() => setExistingFilter(f)}
          >
            <Text
              style={[
                styles.slotBtnText,
                { fontSize: Math.round(clamp(fsSlot * 0.92, fsSlot - 1, fsSlot)) },
                existingFilter === f && styles.slotBtnTextOn,
              ]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.75}
            >
              {f === "all"
                ? "All"
                : f === "morning"
                  ? "Morning"
                  : f === "evening"
                    ? "Evening"
                    : "Lectures"}
            </Text>
          </Pressable>
        ))}
      </View>

      {loadingExisting ? (
        <ActivityIndicator color={colors.accent} style={{ marginVertical: Math.round(16 * uiScale) }} />
      ) : existingPrayers.length === 0 ? (
        <Text style={[styles.hint, { textAlign: "center", marginTop: 8, fontSize: fsHint, lineHeight: lhHint }]}>
          No guides in library yet.
        </Text>
      ) : filteredOfficial.length === 0 ? (
        <Text style={[styles.hint, { textAlign: "center", marginTop: 8, fontSize: fsHint, lineHeight: lhHint }]}>
          Nothing in this filter.
        </Text>
      ) : (
        filteredOfficial.map((prayer) => (
          <View
            key={prayer.id}
            style={[
              styles.existingRow,
              {
                padding: rowPad,
                borderRadius: rowRad,
                marginBottom: rowMb,
                gap: rowGap,
              },
            ]}
          >
            <View style={[styles.existingMeta, { gap: 2 }]}>
              {prayer.scheduleSlot ? (
                <View style={[styles.slotBadge, { gap: Math.round(4 * uiScale) }]}>
                  <Ionicons
                    name={prayer.scheduleSlot === "morning" ? "sunny-outline" : "moon-outline"}
                    size={slotBadgeIcn}
                    color={colors.primary}
                  />
                  <Text style={[styles.slotBadgeText, { fontSize: fsSlotBadge }]}>{prayer.scheduleSlot}</Text>
                </View>
              ) : prayer.category === "lectures" ? (
                <View style={[styles.slotBadge, { gap: Math.round(4 * uiScale) }]}>
                  <Feather name="headphones" size={slotBadgeIcn} color={colors.primary} />
                  <Text style={[styles.slotBadgeText, { fontSize: fsSlotBadge }]}>lecture</Text>
                </View>
              ) : null}
              <Text style={[styles.existingTitle, { fontSize: fsExistTitle }]} numberOfLines={1}>
                {prayer.title}
              </Text>
              <Text style={[styles.existingCategory, { fontSize: fsExistCat }]}>
                {prayer.category}
                {prayer.durationMinutes ? ` · ${prayer.durationMinutes}min` : ""}
              </Text>
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Pressable
                onPress={() => beginEdit(prayer)}
                disabled={busy}
                hitSlop={8}
                style={styles.iconActionBtn}
                accessibilityRole="button"
                accessibilityLabel={`Edit ${prayer.title}`}
              >
                <Feather name="edit-2" size={Math.round(trashIcn * 0.94)} color={colors.primary} />
              </Pressable>
              <Pressable
                onPress={() => deleteOfficialPrayer(prayer)}
                disabled={deletingId === prayer.id}
                hitSlop={8}
                style={styles.iconActionBtn}
                accessibilityRole="button"
                accessibilityLabel={`Delete ${prayer.title}`}
              >
                {deletingId === prayer.id ? (
                  <ActivityIndicator color={colors.danger} size="small" />
                ) : (
                  <Feather name="trash-2" size={trashIcn} color={colors.danger} />
                )}
              </Pressable>
            </View>
          </View>
        ))
      )}

      <Modal visible={pathPickerOpen} animationType="slide" transparent>
        <Pressable style={styles.modalBackdrop} onPress={() => setPathPickerOpen(false)}>
          <Pressable
            style={[
              styles.modalSheet,
              {
                padding: modalSheetPad,
                paddingBottom: modalSheetBot,
                borderTopLeftRadius: modalTopRad,
                borderTopRightRadius: modalTopRad,
              },
            ]}
            onPress={(e) => e.stopPropagation()}
          >
            <Text style={[styles.modalTitle, { fontSize: fsModalTitle, marginBottom: modalTitleMb }]}>Choose path</Text>
            <Text style={[styles.modalHint, { fontSize: fsModalHint, marginBottom: modalHintMb }]}>
              {publishKind === "sanctuary"
                ? "Previous sessions for this slot are saved under this path."
                : "Optionally tag this lecture with a path, or leave it unlinked for the carousel only."}
            </Text>
            <ScrollView style={{ maxHeight: modalScrollMaxH }}>
              {publishKind === "lecture" ? (
                <Pressable
                  style={[
                    styles.pathRow,
                    {
                      paddingVertical: pathRowPadV,
                      paddingHorizontal: pathRowPadH,
                      borderRadius: pathRowRad,
                      marginBottom: pathRowMb,
                    },
                    selectedPath == null && styles.pathRowOn,
                  ]}
                  onPress={() => {
                    setSelectedPath(null);
                    setPathPickerOpen(false);
                  }}
                >
                  <Text style={[styles.pathRowText, { fontSize: fsPathTitle }]}>No path</Text>
                  <Text style={[styles.pathRowMeta, { fontSize: fsPathMeta }]}>Lecture appears in Library only</Text>
                </Pressable>
              ) : null}
              {paths.map((p) => (
                <Pressable
                  key={p.pathId}
                  style={[
                    styles.pathRow,
                    {
                      paddingVertical: pathRowPadV,
                      paddingHorizontal: pathRowPadH,
                      borderRadius: pathRowRad,
                      marginBottom: pathRowMb,
                    },
                    selectedPath?.pathId === p.pathId && styles.pathRowOn,
                  ]}
                  onPress={() => {
                    setSelectedPath(p);
                    setPathPickerOpen(false);
                  }}
                >
                  <Text style={[styles.pathRowText, { fontSize: fsPathTitle }]}>{p.name}</Text>
                  <Text style={[styles.pathRowMeta, { fontSize: fsPathMeta }]}>{p.count} archived guides</Text>
                </Pressable>
              ))}
            </ScrollView>
            <Pressable style={[styles.modalClose, { marginTop: modalCloseMt, paddingVertical: modalClosePadV }]} onPress={() => setPathPickerOpen(false)}>
              <Text style={[styles.modalCloseText, { fontSize: fsModalClose }]}>Close</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </ScrollView>
      </KeyboardAvoidingView>
    <AudioLibraryPickerModal
      visible={audioLibraryOpen}
      maxBytes={MAX_GUIDE_AUDIO_BYTES}
      onRequestClose={() => setAudioLibraryOpen(false)}
      onBrowseFiles={() => void pickAudioFromDocuments()}
      onTooLarge={() =>
        showAppAlert({
          title: "Audio too large",
          message: "Choose a file under 15MB.",
        })
      }
      onChosen={(r) => {
        setAudioUri(r.uri);
        setAudioMime(r.mimeType);
        setAudioName(r.name);
      }}
    />
    </>
  );
}

const styles = StyleSheet.create({
  sectionTitle: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 13,
    color: colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  hint: {
    fontFamily: "PlusJakartaSans_400Regular",
    fontSize: 13,
    color: colors.muted,
    marginBottom: 16,
    lineHeight: 18,
  },
  fieldLabel: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: 6,
  },
  charCount: {
    fontFamily: "PlusJakartaSans_400Regular",
    color: colors.muted,
    alignSelf: "flex-end",
  },
  selectBtn: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 12,
    backgroundColor: colors.surface,
    marginBottom: 14,
  },
  selectBtnText: {
    fontFamily: "PlusJakartaSans_500Medium",
    fontSize: 14,
    color: colors.text,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 12,
    fontFamily: "PlusJakartaSans_400Regular",
    fontSize: 14,
    color: colors.text,
    backgroundColor: colors.surface,
    marginBottom: 10,
  },
  inputMultiline: {
    minHeight: 100,
  },
  slotRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 12,
  },
  slotBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    backgroundColor: colors.surface,
  },
  slotBtnOn: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  slotBtnText: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 14,
    color: colors.primary,
  },
  slotBtnTextOn: {
    color: colors.surface,
  },
  pickBtn: {
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.primary,
    marginBottom: 12,
    alignItems: "center",
  },
  pickBtnText: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 14,
    color: colors.primary,
  },
  publishBtn: {
    backgroundColor: colors.primary,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  publishBtnText: {
    fontFamily: "PlusJakartaSans_700Bold",
    fontSize: 15,
    color: colors.surface,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
  },
  modalSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 32,
  },
  modalTitle: {
    fontFamily: "NotoSerif_700Bold",
    fontSize: 18,
    color: colors.primary,
    marginBottom: 6,
  },
  modalHint: {
    fontFamily: "PlusJakartaSans_400Regular",
    fontSize: 13,
    color: colors.muted,
    marginBottom: 12,
  },
  pathRow: {
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 8,
  },
  pathRowOn: {
    borderColor: colors.primary,
    backgroundColor: colors.cream,
  },
  pathRowText: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 15,
    color: colors.text,
  },
  pathRowMeta: {
    fontFamily: "PlusJakartaSans_400Regular",
    fontSize: 12,
    color: colors.muted,
    marginTop: 2,
  },
  modalClose: {
    marginTop: 12,
    alignItems: "center",
    paddingVertical: 12,
  },
  modalCloseText: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 15,
    color: colors.primary,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 24,
  },
  existingHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  existingRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    marginBottom: 8,
    gap: 10,
  },
  existingMeta: {
    flex: 1,
    gap: 2,
  },
  slotBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 2,
  },
  slotBadgeText: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 10,
    color: colors.primary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  existingTitle: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 14,
    color: colors.text,
  },
  existingCategory: {
    fontFamily: "PlusJakartaSans_400Regular",
    fontSize: 12,
    color: colors.muted,
  },
  cancelEditBtn: {
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    backgroundColor: colors.surface,
  },
  cancelEditBtnText: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    color: colors.primary,
  },
  iconActionBtn: {
    padding: 6,
  },
});
