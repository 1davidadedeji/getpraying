import * as DocumentPicker from "expo-document-picker";
import * as Haptics from "expo-haptics";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
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
import { showAppAlert } from "@/components/AppAlert";
import colors from "@/constants/colors";
import type { ApiLibraryCategory } from "@/constants/libraryFallbackPaths";
import { useAuth } from "@/context/auth";
import { apiUrl, authHeaders } from "@/lib/api";

type PathPick = ApiLibraryCategory & { pathId: number; category?: string };

async function uploadAudioFile(
  localUri: string,
  token: string,
  fileName: string,
  mimeType: string,
): Promise<string> {
  const form = new FormData();
  form.append("file", {
    uri: localUri,
    name: fileName,
    type: mimeType,
  } as unknown as Blob);
  const res = await fetch(apiUrl("/uploads/post-audio"), {
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
  const [audioName, setAudioName] = useState<string | null>(null);
  const [audioUri, setAudioUri] = useState<string | null>(null);
  const [audioMime, setAudioMime] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [picking, setPicking] = useState(false);

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
      setSelectedPath((prev) => prev ?? withIds[0] ?? null);
    } catch {
      setPaths([]);
    } finally {
      setPathsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void loadPaths();
  }, [loadPaths]);

  const pickAudio = async () => {
    setPicking(true);
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: ["audio/*", "audio/mpeg", "audio/mp4", "audio/x-m4a", "audio/wav"],
        copyToCacheDirectory: true,
      });
      if (res.canceled || !res.assets?.[0]) return;
      const a = res.assets[0];
      setAudioUri(a.uri);
      setAudioMime(a.mimeType ?? "audio/mpeg");
      setAudioName(a.name ?? "audio");
    } catch {
      showAppAlert({ title: "Picker failed", message: "Could not open file picker." });
    } finally {
      setPicking(false);
    }
  };

  const submit = async () => {
    if (!token || !title.trim() || !content.trim()) {
      showAppAlert({ title: "Missing fields", message: "Add a title and description." });
      return;
    }
    if (!selectedPath) {
      showAppAlert({ title: "Choose a path", message: "Pick where previous guides are archived." });
      return;
    }
    if (!audioUri || !audioMime) {
      showAppAlert({ title: "Audio required", message: "Upload an audio file for this sanctuary guide." });
      return;
    }
    const category = (selectedPath.category ?? "general").trim() || "general";
    const archivePathId = selectedPath.pathId;
    const dm = durationMinutes.trim() ? parseInt(durationMinutes.trim(), 10) : null;
    const durationPayload =
      dm != null && !Number.isNaN(dm) && dm > 0 ? dm : undefined;

    setBusy(true);
    try {
      let audioUrl: string;
      try {
        audioUrl = await uploadAudioFile(audioUri, token, audioName ?? "guide.m4a", audioMime);
      } catch (e) {
        showAppAlert({
          title: "Upload failed",
          message: e instanceof Error ? e.message : "Could not upload audio.",
        });
        return;
      }

      const res = await fetch(apiUrl("/admin/official-prayers/schedule-slot"), {
        method: "POST",
        headers: authHeaders(token, { "Content-Type": "application/json" }),
        body: JSON.stringify({
          slot: scheduleSlot,
          archivePathId,
          title: title.trim(),
          content: content.trim(),
          category,
          scripture: scripture.trim() || undefined,
          durationMinutes: durationPayload,
          audioUrl,
          label: scheduleSlot === "morning" ? "Official Sanctuary" : "Vesper Light",
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showAppAlert({ title: "Could not save", message: (data as { error?: string }).error ?? "Try again." });
        return;
      }
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

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.cream }}
      contentContainerStyle={{ padding: 16, paddingBottom: botPad + 32 }}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.sectionTitle}>Sanctuary guides</Text>
      <Text style={styles.hint}>
        Publish the featured morning or evening prayer. Audio uploads to the server. The previous recording for that
        slot is copied into the path you select so it appears under Explore Paths.
      </Text>

      <Text style={styles.fieldLabel}>Path (archive &amp; category)</Text>
      <Pressable
        style={styles.selectBtn}
        onPress={() => setPathPickerOpen(true)}
        disabled={pathsLoading || paths.length === 0}
      >
        <Text style={styles.selectBtnText} numberOfLines={2}>
          {pathsLoading
            ? "Loading paths…"
            : selectedPath
              ? `${selectedPath.name} — guides archived here`
              : "No paths — create one in admin first"}
        </Text>
      </Pressable>

      <Text style={styles.fieldLabel}>Slot</Text>
      <View style={styles.slotRow}>
        {(["morning", "evening"] as const).map((s) => (
          <Pressable
            key={s}
            style={[styles.slotBtn, scheduleSlot === s && styles.slotBtnOn]}
            onPress={() => setScheduleSlot(s)}
          >
            <Text style={[styles.slotBtnText, scheduleSlot === s && styles.slotBtnTextOn]}>
              {s === "morning" ? "Morning" : "Evening"}
            </Text>
          </Pressable>
        ))}
      </View>

      <TextInput
        value={title}
        onChangeText={setTitle}
        placeholder="Title"
        placeholderTextColor={colors.muted}
        style={styles.input}
      />
      <TextInput
        value={content}
        onChangeText={setContent}
        placeholder="Description"
        placeholderTextColor={colors.muted}
        style={[styles.input, styles.inputMultiline]}
        multiline
        textAlignVertical="top"
      />
      <TextInput
        value={scripture}
        onChangeText={setScripture}
        placeholder="Scripture (optional, e.g. Psalm 34:4)"
        placeholderTextColor={colors.muted}
        style={styles.input}
      />
      <TextInput
        value={durationMinutes}
        onChangeText={setDurationMinutes}
        placeholder="Duration in minutes (optional)"
        placeholderTextColor={colors.muted}
        style={styles.input}
        keyboardType="number-pad"
      />

      <Pressable style={[styles.pickBtn, picking && { opacity: 0.6 }]} onPress={() => void pickAudio()} disabled={picking}>
        <Text style={styles.pickBtnText}>
          {picking ? "Opening…" : audioName ? `Audio: ${audioName}` : "Choose audio file (required)"}
        </Text>
      </Pressable>

      <Pressable style={[styles.publishBtn, busy && { opacity: 0.6 }]} onPress={() => void submit()} disabled={busy}>
        {busy ? (
          <ActivityIndicator color={colors.surface} />
        ) : (
          <Text style={styles.publishBtnText}>Publish sanctuary guide</Text>
        )}
      </Pressable>

      <Modal visible={pathPickerOpen} animationType="slide" transparent>
        <Pressable style={styles.modalBackdrop} onPress={() => setPathPickerOpen(false)}>
          <Pressable style={styles.modalSheet} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitle}>Choose path</Text>
            <Text style={styles.modalHint}>Previous sessions for this slot are saved under this path.</Text>
            <ScrollView style={{ maxHeight: 320 }}>
              {paths.map((p) => (
                <Pressable
                  key={p.pathId}
                  style={[styles.pathRow, selectedPath?.pathId === p.pathId && styles.pathRowOn]}
                  onPress={() => {
                    setSelectedPath(p);
                    setPathPickerOpen(false);
                  }}
                >
                  <Text style={styles.pathRowText}>{p.name}</Text>
                  <Text style={styles.pathRowMeta}>{p.count} archived guides</Text>
                </Pressable>
              ))}
            </ScrollView>
            <Pressable style={styles.modalClose} onPress={() => setPathPickerOpen(false)}>
              <Text style={styles.modalCloseText}>Close</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </ScrollView>
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
});
