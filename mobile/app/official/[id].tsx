import { Feather, Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Href, router, useLocalSearchParams } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
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
import { CapsuleAudioPlayer } from "@/components/CapsuleAudioPlayer";
import { showAppAlert } from "@/components/AppAlert";
import colors from "@/constants/colors";
import { useAuth } from "@/context/auth";
import { useResponsiveLayout } from "@/hooks/useResponsiveLayout";
import { apiUrl, authHeaders } from "@/lib/api";
import { clamp } from "@/lib/responsiveMetrics";
import { useStackHeaderBack } from "@/hooks/useStackHeaderBack";

function scheduleSlotBadge(s: string | null | undefined): string {
  if (!s) return "";
  const t = s.toLowerCase();
  if (t === "morning") return "MORNING";
  if (t === "evening") return "EVENING";
  return s.trim().toUpperCase();
}

export default function OfficialPrayerScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const prayerId = Number(id);
  useStackHeaderBack("/(tabs)/library" as Href);
  const insets = useSafeAreaInsets();
  const { gutter, uiScale, iconAction } = useResponsiveLayout();
  const { token } = useAuth();
  const bookmarkIcn = Math.round(clamp(26 * uiScale, 22, 30));
  const rowGap = Math.round(clamp(12 * uiScale, 10, 14));
  const topMb = Math.round(clamp(16 * uiScale, 12, 20));
  const metaGap = Math.round(clamp(6 * uiScale, 5, 8));
  const fsBadge = Math.round(clamp(11 * uiScale, 10, 12));
  const fsUpdated = Math.round(clamp(11 * uiScale, 10, 12));
  const updatedPadH = Math.round(clamp(8 * uiScale, 6, 10));
  const updatedPadV = Math.round(clamp(4 * uiScale, 3, 5));
  const updatedRad = Math.round(clamp(8 * uiScale, 6, 10));
  const fsTitle = Math.round(clamp(24 * uiScale, 21, 28));
  const titleMb = Math.round(clamp(8 * uiScale, 6, 10));
  const fsSub = Math.round(clamp(15 * uiScale, 14, 17));
  const subMb = Math.round(clamp(12 * uiScale, 10, 14));
  const fsScripture = Math.round(clamp(15 * uiScale, 14, 17));
  const scrMb = Math.round(clamp(12 * uiScale, 10, 14));
  const fsBody = Math.round(clamp(16 * uiScale, 15, 18));
  const lhBody = Math.round(fsBody * 1.5);
  const fsUpload = Math.round(clamp(12 * uiScale, 11, 14));
  const uploadMt = Math.round(clamp(16 * uiScale, 12, 20));
  const seeAlsoMt = Math.round(clamp(28 * uiScale, 22, 32));
  const seeAlsoGap = Math.round(clamp(10 * uiScale, 8, 12));
  const fsSeeTitle = Math.round(clamp(16 * uiScale, 15, 18));
  const seeRowGap = Math.round(clamp(10 * uiScale, 8, 12));
  const seePad = Math.round(clamp(14 * uiScale, 12, 16));
  const seeRad = Math.round(clamp(16 * uiScale, 14, 18));
  const fsSeeText = Math.round(clamp(14 * uiScale, 13, 16));
  const linkIcn = iconAction;
  const fsHint = Math.round(clamp(12 * uiScale, 11, 13));
  const lhHint = Math.round(fsHint * 1.45);
  const refreshMt = Math.round(clamp(20 * uiScale, 16, 24));
  const fsRefresh = Math.round(clamp(12 * uiScale, 11, 13));
  const botPad = Math.round(clamp(32 * uiScale, 24, 40));
  const [saving, setSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [bodyExpanded, setBodyExpanded] = useState(false);

  const { data, isLoading, isError, refetch } = useGetOfficialPrayerById(prayerId, {
    query: {
      queryKey: getGetOfficialPrayerByIdQueryKey(prayerId),
      enabled: Number.isFinite(prayerId) && prayerId > 0,
    },
  });

  const bodyText = (data?.content ?? "").trim();
  const longBody = useMemo(
    () => bodyText.length > 280 || (bodyText.match(/\n/g)?.length ?? 0) > 4,
    [bodyText],
  );

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

  React.useEffect(() => {
    setBodyExpanded(false);
  }, [prayerId]);

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
  const isLecture = (d.category ?? "").toLowerCase() === "lectures";
  const updated =
    d.updatedAt && d.createdAt && d.updatedAt !== d.createdAt
      ? new Date(d.updatedAt)
      : null;

  const showSeeAlsoRowPath = Boolean(d.pathId && d.pathId > 0 && !isLecture);
  const showSeeAlsoRowCategory = Boolean(d.category && !isLecture);
  const showSanctuaryHint = Boolean(!d.pathId && d.scheduleSlot);
  const showSeeAlso = showSeeAlsoRowPath || showSeeAlsoRowCategory || showSanctuaryHint;

  return (
    <ScrollView
      contentContainerStyle={[styles.container, { paddingHorizontal: gutter, paddingBottom: insets.bottom + botPad }]}
      showsVerticalScrollIndicator={false}
    >
      <View style={[styles.topRow, { gap: rowGap, marginBottom: topMb }]}>
        <View style={[styles.topMeta, { gap: metaGap, flex: 1 }]}>
          <Text style={[styles.badge, { fontSize: fsBadge }]}>
            OFFICIAL PRAYER
            {d.scheduleSlot ? ` · ${scheduleSlotBadge(d.scheduleSlot)}` : ""}
          </Text>
          {updated ? (
            <Text
              style={[
                styles.updatedPill,
                {
                  fontSize: fsUpdated,
                  paddingHorizontal: updatedPadH,
                  paddingVertical: updatedPadV,
                  borderRadius: updatedRad,
                },
              ]}
              accessibilityLabel="Content was updated by the team"
            >
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
            size={bookmarkIcn}
            color={isSaved ? colors.primary : colors.muted}
          />
        </Pressable>
      </View>

      <Text style={[styles.title, { fontSize: fsTitle, marginBottom: titleMb }]}>{d.title}</Text>
      {d.subtitle ? <Text style={[styles.subtitle, { fontSize: fsSub, marginBottom: subMb }]}>{d.subtitle}</Text> : null}
      {d.scripture ? (
        <Text style={[styles.scripture, { fontSize: fsScripture, marginBottom: scrMb }]}>&ldquo;{d.scripture}&rdquo;</Text>
      ) : null}

      {d.audioUrl ? (
        <View style={{ marginBottom: scrMb }}>
          <CapsuleAudioPlayer audioUrl={d.audioUrl} accentColor={colors.primary} />
        </View>
      ) : null}

      {bodyText ? (
        <View style={{ marginBottom: scrMb }}>
          <Text
            style={[styles.body, { fontSize: fsBody, lineHeight: lhBody }]}
            numberOfLines={bodyExpanded || !longBody ? undefined : 6}
          >
            {bodyText}
          </Text>
          {longBody ? (
            <Pressable
              onPress={() => setBodyExpanded((prev) => !prev)}
              style={styles.moreToggle}
              accessibilityRole="button"
              accessibilityLabel={bodyExpanded ? "Show less description" : "Show full description"}
            >
              <Text style={[styles.moreToggleText, { fontSize: fsHint }]}>{bodyExpanded ? "Less" : "More"}</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {d.uploadedByUsername ? (
        <Text style={[styles.uploader, { fontSize: fsUpload, marginTop: uploadMt }]}>
          From @{d.uploadedByUsername}
        </Text>
      ) : null}

      {showSeeAlso ? (
        <View style={[styles.seeAlso, { marginTop: seeAlsoMt, gap: seeAlsoGap }]}>
          <Text style={[styles.seeAlsoTitle, { fontSize: fsSeeTitle }]}>See also</Text>
          {showSeeAlsoRowPath ? (
            <Pressable
              style={[styles.seeRow, { gap: seeRowGap, padding: seePad, borderRadius: seeRad }]}
              onPress={() => router.push(`/path/${d.pathId}` as never)}
            >
              <Feather name="map" size={linkIcn} color={colors.primary} />
              <Text style={[styles.seeText, { fontSize: fsSeeText }]}>Open related prayer path</Text>
              <Ionicons name="chevron-forward" size={linkIcn} color={colors.muted} />
            </Pressable>
          ) : null}
          {showSeeAlsoRowCategory ? (
            <Pressable
              style={[styles.seeRow, { gap: seeRowGap, padding: seePad, borderRadius: seeRad }]}
              onPress={() => router.push(`/category/${encodeURIComponent(d.category!)}` as never)}
            >
              <Feather name="grid" size={linkIcn} color={colors.primary} />
              <Text style={[styles.seeText, { fontSize: fsSeeText }]}>More in &ldquo;{d.category}&rdquo;</Text>
              <Ionicons name="chevron-forward" size={linkIcn} color={colors.muted} />
            </Pressable>
          ) : null}
          {showSanctuaryHint ? (
            <Text style={[styles.hint, { fontSize: fsHint, lineHeight: lhHint }]}>
              With Morning & Evening Reminders on, we send a push around 4:00 a.m. and 5:00 p.m. in your account time
              zone so the matching guide is ready.
            </Text>
          ) : null}
        </View>
      ) : null}

      <Pressable onPress={() => void refetch()} style={[styles.refresh, { marginTop: refreshMt }]}>
        <Text style={[styles.refreshText, { fontSize: fsRefresh }]}>Refresh if something looks out of date</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, backgroundColor: colors.cream, alignItems: "center", justifyContent: "center", padding: 24 },
  err: { fontFamily: "PlusJakartaSans_400Regular", color: colors.muted, textAlign: "center" },
  container: { paddingTop: 8 },
  topRow: { flexDirection: "row", alignItems: "flex-start" },
  topMeta: {},
  badge: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    color: colors.primary,
    letterSpacing: 0.4,
  },
  updatedPill: {
    alignSelf: "flex-start",
    fontFamily: "PlusJakartaSans_500Medium",
    color: colors.muted,
    backgroundColor: colors.surface,
    overflow: "hidden",
  },
  saveBtn: { padding: 4 },
  title: {
    fontFamily: "NotoSerif_700Bold",
    color: colors.primary,
  },
  subtitle: { fontFamily: "PlusJakartaSans_400Regular", color: colors.textSecondary },
  scripture: {
    fontFamily: "NotoSerif_600SemiBold",
    fontStyle: "italic",
    color: colors.text,
  },
  body: { fontFamily: "PlusJakartaSans_400Regular", color: colors.text },
  moreToggle: {
    marginTop: 8,
    alignSelf: "flex-start",
    paddingVertical: 4,
  },
  moreToggleText: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    color: colors.primary,
  },
  uploader: { fontFamily: "PlusJakartaSans_400Regular", color: colors.muted },
  seeAlso: {},
  seeAlsoTitle: { fontFamily: "NotoSerif_700Bold", color: colors.primary },
  seeRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  seeText: { flex: 1, fontFamily: "PlusJakartaSans_600SemiBold", color: colors.text },
  hint: { fontFamily: "PlusJakartaSans_400Regular", color: colors.muted, marginTop: 4 },
  refresh: { alignItems: "center" },
  refreshText: { fontFamily: "PlusJakartaSans_500Medium", color: colors.primary },
});
