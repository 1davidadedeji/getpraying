import * as DocumentPicker from "expo-document-picker";
import * as Haptics from "expo-haptics";
import React, { useState } from "react";
import {
  ActivityIndicator,
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
import { useAuth } from "@/context/auth";
import { apiUrl, authHeaders } from "@/lib/api";

export default function AdminOfficialGuidesScreen() {
  const insets = useSafeAreaInsets();
  const { token } = useAuth();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [category, setCategory] = useState("guidance");
  const [audioUrl, setAudioUrl] = useState("");
  const [scheduleSlot, setScheduleSlot] = useState<"" | "morning" | "evening">("");
  const [busy, setBusy] = useState(false);
  const [picking, setPicking] = useState(false);

  const pickAudio = async () => {
    setPicking(true);
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: ["audio/*", "audio/mpeg", "audio/mp4", "audio/x-m4a", "audio/wav"],
        copyToCacheDirectory: true,
      });
      if (res.canceled || !res.assets?.[0]) return;
      const uri = res.assets[0].uri;
      setAudioUrl(uri);
      showAppAlert({
        title: "Audio selected",
        message:
          "Paste a hosted URL in production, or ensure your API accepts uploads for this build. Local file URI is shown for dev.",
      });
    } catch {
      showAppAlert({ title: "Picker failed", message: "Could not open file picker." });
    } finally {
      setPicking(false);
    }
  };

  const submit = async () => {
    if (!token || !title.trim() || !content.trim()) {
      showAppAlert({ title: "Missing fields", message: "Add a title and description for the guide." });
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(apiUrl("/admin/official-prayers"), {
        method: "POST",
        headers: authHeaders(token, { "Content-Type": "application/json" }),
        body: JSON.stringify({
          title: title.trim(),
          content: content.trim(),
          category: category.trim(),
          ...(audioUrl.trim() ? { audioUrl: audioUrl.trim() } : {}),
          scheduleSlot: scheduleSlot || undefined,
          label: "Official Guide",
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showAppAlert({ title: "Could not save", message: (data as { error?: string }).error ?? "Try again." });
        return;
      }
      setTitle("");
      setContent("");
      setAudioUrl("");
      setScheduleSlot("");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showAppAlert({
        title: "Guide added",
        message: "It appears under Official Guides in the Prayer Library.",
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
      <Text style={styles.sectionTitle}>Official guides</Text>
      <Text style={styles.hint}>
        Audio-only curated guides. Set optional morning/evening slot, or leave “Any time” for the paths library.
      </Text>
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
        value={category}
        onChangeText={setCategory}
        placeholder="Category slug (e.g. guidance)"
        placeholderTextColor={colors.muted}
        style={styles.input}
        autoCapitalize="none"
      />
      <TextInput
        value={audioUrl}
        onChangeText={setAudioUrl}
        placeholder="Audio URL (https://…)"
        placeholderTextColor={colors.muted}
        style={styles.input}
        autoCapitalize="none"
      />
      <Pressable style={[styles.pickBtn, picking && { opacity: 0.6 }]} onPress={() => void pickAudio()} disabled={picking}>
        <Text style={styles.pickBtnText}>{picking ? "Opening…" : "Pick audio file (fills URL if supported)"}</Text>
      </Pressable>
      <View style={styles.slotRow}>
        {(["", "morning", "evening"] as const).map((s) => (
          <Pressable
            key={s || "none"}
            style={[styles.slotBtn, scheduleSlot === s && styles.slotBtnOn]}
            onPress={() => setScheduleSlot(s)}
          >
            <Text style={[styles.slotBtnText, scheduleSlot === s && styles.slotBtnTextOn]}>
              {s === "" ? "Any time" : s}
            </Text>
          </Pressable>
        ))}
      </View>
      <Pressable style={[styles.publishBtn, busy && { opacity: 0.6 }]} onPress={() => void submit()} disabled={busy}>
        {busy ? (
          <ActivityIndicator color={colors.surface} />
        ) : (
          <Text style={styles.publishBtnText}>Publish guide</Text>
        )}
      </Pressable>
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
    marginBottom: 12,
    lineHeight: 18,
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
    fontSize: 13,
    color: colors.primary,
  },
  slotRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 16,
  },
  slotBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.cream,
  },
  slotBtnOn: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  slotBtnText: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 12,
    color: colors.primary,
  },
  slotBtnTextOn: {
    color: colors.surface,
  },
  publishBtn: {
    backgroundColor: colors.primary,
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: "center",
  },
  publishBtnText: {
    fontFamily: "PlusJakartaSans_700Bold",
    fontSize: 15,
    color: colors.surface,
  },
});
