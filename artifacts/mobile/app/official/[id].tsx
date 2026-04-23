import { Feather, Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router, useLocalSearchParams } from "expo-router";
import React, { useCallback, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  getGetOfficialPrayerByIdQueryKey,
  useGetOfficialPrayerById,
} from "@workspace/api-client-react";
import { OfficialGuidePlayCircle, type OfficialGuidePlayHandle } from "@/components/OfficialGuidePlayCircle";
import { showAppAlert } from "@/components/AppAlert";
import colors from "@/constants/colors";
import { useAuth } from "@/context/auth";
import { apiUrl, authHeaders } from "@/lib/api";

export default function OfficialPrayerScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const prayerId = Number(id);
  const insets = useSafeAreaInsets();
  const { token } = useAuth();
  const playRef = useRef<OfficialGuidePlayHandle | null>(null);
  const [saving, setSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(false);

  const { data, isLoading, isError, refetch } = useGetOfficialPrayerById(prayerId, {
    query: {
      queryKey: getGetOfficialPrayerByIdQueryKey(prayerId),
      enabled: Number.isFinite(prayerId) && prayerId > 0,
    },
  });

  const checkSaved = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(apiUrl("/library/saved-official"), { headers: authHeaders(token) });
      if (!res.ok) return;
      const j = (await res.json()) as { prayers?: { id: number }[] };
      setIsSaved(!!(j.prayers ?? []).find((p) => p.id === prayerId));
    } catch {
      /* noop */
    }
  }, [token, prayerId]);

  React.useEffect(() => {
    void checkSaved();
  }, [checkSaved]);

  const toggleSave = async () => {
    if (!token) {
      showAppAlert({ title: "Sign in", message: "Create an account or sign in to save guides." });
      return;
    }
    if (saving) return;
    setSaving(true);
    const was = isSaved;
    setIsSaved(!was);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      const res = await fetch(apiUrl(`/library/saved-official/${prayerId}`), {
        method: was ? "DELETE" : "POST",
        headers: authHeaders(token),
      });
      if (!res.ok) {
        setIsSaved(was);
        showAppAlert({ title: "Couldn’t update", message: "Try again in a moment." });
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch {
      setIsSaved(was);
      showAppAlert({ title: "Network", message: "Check your connection." });
    } finally {
      setSaving(false);
    }
  };

  if (isError) {
    return (
      <View style={styles.centered}>
        <Text style={styles.err}>This guide is unavailable or was removed.</Text>
      </View>
    );
  }
  if (isLoading || !data) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    );
  }

  const d = data;
  const updated =
    d.updatedAt && d.createdAt && d.updatedAt !== d.createdAt
      ? new Date(d.updatedAt)
      : null;

  return (
    <ScrollView
      contentContainerStyle={[styles.container, { paddingBottom: insets.bottom + 32 }]}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.topRow}>
        <OfficialGuidePlayCircle ref={playRef} audioUrl={d.audioUrl ?? null} size={64} />
        <View style={styles.topMeta}>
          <Text style={styles.badge}>
            {(d.label ?? "Official guide").toUpperCase()}
            {d.scheduleSlot ? ` · ${d.scheduleSlot}` : ""}
          </Text>
          {updated ? (
            <Text style={styles.updatedPill} accessibilityLabel="Content was updated by the team">
              Updated {updated.toLocaleDateString()}
            </Text>
          ) : null}
        </View>
        <Pressable
          onPress={() => void toggleSave()}
          disabled={saving}
          style={styles.saveBtn}
          accessibilityLabel={isSaved ? "Remove from saved" : "Save guide"}
        >
          <Ionicons
            name={isSaved ? "bookmark" : "bookmark-outline"}
            size={26}
            color={isSaved ? colors.primary : colors.muted}
          />
        </Pressable>
      </View>

      <Text style={styles.title}>{d.title}</Text>
      {d.subtitle ? <Text style={styles.subtitle}>{d.subtitle}</Text> : null}
      {d.scripture ? (
        <Text style={styles.scripture}>&ldquo;{d.scripture}&rdquo;</Text>
      ) : null}
      <Text style={styles.body}>{d.content}</Text>

      {d.uploadedByUsername ? (
        <Text style={styles.uploader}>
          From @{d.uploadedByUsername}
        </Text>
      ) : null}

      <View style={styles.seeAlso}>
        <Text style={styles.seeAlsoTitle}>See also</Text>
        {d.pathId && d.pathId > 0 ? (
          <Pressable
            style={styles.seeRow}
            onPress={() => router.push(`/path/${d.pathId}` as never)}
          >
            <Feather name="map" size={18} color={colors.primary} />
            <Text style={styles.seeText}>Open related prayer path</Text>
            <Ionicons name="chevron-forward" size={18} color={colors.muted} />
          </Pressable>
        ) : null}
        {d.category ? (
          <Pressable
            style={styles.seeRow}
            onPress={() => router.push(`/category/${encodeURIComponent(d.category)}` as never)}
          >
            <Feather name="grid" size={18} color={colors.primary} />
            <Text style={styles.seeText}>More in &ldquo;{d.category}&rdquo;</Text>
            <Ionicons name="chevron-forward" size={18} color={colors.muted} />
          </Pressable>
        ) : null}
        {!d.pathId && d.scheduleSlot && (
          <Text style={styles.hint}>
            When the team posts a new version of this slot, the featured prayer updates here; older
            versions may be archived to a path for your library.
          </Text>
        )}
      </View>

      <Pressable onPress={() => void refetch()} style={styles.refresh}>
        <Text style={styles.refreshText}>Refresh if something looks out of date</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, backgroundColor: colors.cream, alignItems: "center", justifyContent: "center", padding: 24 },
  err: { fontFamily: "PlusJakartaSans_400Regular", color: colors.muted, textAlign: "center" },
  container: { paddingHorizontal: 20, paddingTop: 8 },
  topRow: { flexDirection: "row", alignItems: "flex-start", gap: 12, marginBottom: 16 },
  topMeta: { flex: 1, gap: 6 },
  badge: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 11,
    color: colors.primary,
    letterSpacing: 0.4,
  },
  updatedPill: {
    alignSelf: "flex-start",
    fontFamily: "PlusJakartaSans_500Medium",
    fontSize: 11,
    color: colors.muted,
    backgroundColor: colors.surface,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    overflow: "hidden",
  },
  saveBtn: { padding: 4 },
  title: {
    fontFamily: "NotoSerif_700Bold",
    fontSize: 24,
    color: colors.primary,
    marginBottom: 8,
  },
  subtitle: { fontFamily: "PlusJakartaSans_400Regular", fontSize: 15, color: colors.textSecondary, marginBottom: 12 },
  scripture: {
    fontFamily: "NotoSerif_600SemiBold",
    fontSize: 15,
    fontStyle: "italic",
    color: colors.text,
    marginBottom: 12,
  },
  body: { fontFamily: "PlusJakartaSans_400Regular", fontSize: 16, lineHeight: 24, color: colors.text },
  uploader: { fontFamily: "PlusJakartaSans_400Regular", fontSize: 12, color: colors.muted, marginTop: 16 },
  seeAlso: { marginTop: 28, gap: 10 },
  seeAlsoTitle: { fontFamily: "NotoSerif_700Bold", fontSize: 16, color: colors.primary },
  seeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  seeText: { flex: 1, fontFamily: "PlusJakartaSans_600SemiBold", fontSize: 14, color: colors.text },
  hint: { fontFamily: "PlusJakartaSans_400Regular", fontSize: 12, color: colors.muted, lineHeight: 18, marginTop: 4 },
  refresh: { marginTop: 20, alignItems: "center" },
  refreshText: { fontFamily: "PlusJakartaSans_500Medium", fontSize: 12, color: colors.primary },
});
