import { Feather, Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Href, router, useLocalSearchParams } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { FormattedBodyText } from "@/components/FormattedBodyText";
import { CapsuleAudioPlayer } from "@/components/CapsuleAudioPlayer";
import { LectureTrackList } from "@/components/LectureTrackList";
import { showAppAlert } from "@/components/AppAlert";
import colors from "@/constants/colors";
import { useAuth } from "@/context/auth";
import { useResponsiveLayout } from "@/hooks/useResponsiveLayout";
import { apiFetch } from "@/lib/api";
import { fetchLibraryCached, peekLibraryCache } from "@/lib/libraryFetchCache";
import { clamp } from "@/lib/responsiveMetrics";
import {
  officialGuideBadgeLabel,
  type LectureTrackRow,
  type OfficialPrayerRow,
} from "@/lib/officialPrayer";
import { isPremiumContentLocked, isSanctuaryOfficialPrayer } from "@/lib/premiumContent";
import { PremiumGatedContent } from "@/components/PremiumGatedContent";
import { usePremiumViewer } from "@/lib/premiumViewer";
import { premiumCardStyle } from "@/lib/premiumPostTheme";
import { useStackHeaderBack } from "@/hooks/useStackHeaderBack";

const DETAIL_TIMEOUT_MS = 25_000;
const LECTURES_LIST_PATH = "/library/official?category=lectures&limit=20";

type OfficialDetail = OfficialPrayerRow & {
  updatedAt?: string | Date | null;
};

function findCachedOfficialSummary(
  prayerId: number,
  token: string | null,
): OfficialPrayerRow | null {
  const detail = peekLibraryCache<OfficialDetail>(`/library/official/${prayerId}`, token);
  if (detail) return detail;
  const lectures = peekLibraryCache<{ prayers?: OfficialPrayerRow[] }>(LECTURES_LIST_PATH, token);
  return lectures?.prayers?.find((p) => p.id === prayerId) ?? null;
}

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
  const { subscribed, shouldBlurOfficial } = usePremiumViewer();
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
  const lhBody = Math.round(fsBody * 2);
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
  const [data, setData] = useState<OfficialDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const cachedSummary = useMemo(
    () => (Number.isFinite(prayerId) && prayerId > 0 ? findCachedOfficialSummary(prayerId, token) : null),
    [prayerId, token],
  );

  const loadDetail = useCallback(async () => {
    if (!Number.isFinite(prayerId) || prayerId <= 0) return;
    setLoading(true);
    setError(false);
    const startedAt = Date.now();
    try {
      const cached = await fetchLibraryCached<OfficialDetail>(
        `/library/official/${prayerId}`,
        token,
        { force: true, timeoutMs: DETAIL_TIMEOUT_MS },
      );
      if (!cached) {
        setError(true);
        if (__DEV__) {
          console.warn("[library] official detail failed", { prayerId, ms: Date.now() - startedAt });
        }
        return;
      }
      setData(cached);
      if (__DEV__) {
        console.info("[library] official detail ok", { prayerId, ms: Date.now() - startedAt });
      }
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [prayerId, token]);

  useEffect(() => {
    void loadDetail();
  }, [loadDetail]);

  const prevSubscribedRef = useRef(subscribed);
  useEffect(() => {
    if (prevSubscribedRef.current === subscribed) return;
    prevSubscribedRef.current = subscribed;
    void loadDetail();
  }, [subscribed, loadDetail]);

  const bodyText = (data?.content ?? cachedSummary?.content ?? "").trim();
  const longBody = useMemo(
    () => bodyText.length > 280 || (bodyText.match(/\n/g)?.length ?? 0) > 4,
    [bodyText],
  );

  const checkSaved = useCallback(async () => {
    if (!token) return;
    try {
      const saved = await fetchLibraryCached<{ prayers?: { id: number }[] }>(
        "/library/saved-official",
        token,
        { timeoutMs: DETAIL_TIMEOUT_MS },
      );
      setIsSaved(!!(saved?.prayers ?? []).find((p) => p.id === prayerId));
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
      const res = await apiFetch(`/library/saved-official/${prayerId}`, {
        token,
        method: was ? "DELETE" : "POST",
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

  if (error && !data && !cachedSummary) {
    return (
      <View style={styles.centered}>
        <Text style={styles.err}>This guide couldn&apos;t be loaded.</Text>
        <Pressable onPress={() => void loadDetail()} style={styles.retryBtn}>
          <Text style={styles.retryBtnText}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  const d = data ?? cachedSummary;
  if (!d) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    );
  }

  const isLecture = (d.category ?? "").toLowerCase() === "lectures";
  const lectureTracks: LectureTrackRow[] = isLecture ? (data?.tracks ?? d.tracks ?? []) : [];
  const updated =
    data?.updatedAt && data?.createdAt && data.updatedAt !== data.createdAt
      ? new Date(data.updatedAt)
      : null;

  const showSeeAlsoRowPath = Boolean(d.pathId && d.pathId > 0 && !isLecture);
  const showSeeAlsoRowCategory = Boolean(d.category && !isLecture);
  const showSanctuaryHint = Boolean(!d.pathId && d.scheduleSlot);
  const showSeeAlso = showSeeAlsoRowPath || showSeeAlsoRowCategory || showSanctuaryHint;
  const contentLocked = isPremiumContentLocked(d);
  const premiumLocked = shouldBlurOfficial(d);
  const isPremiumGuide = Boolean(d.isPremium) && !isSanctuaryOfficialPrayer(d);
  const showAudioLock =
    contentLocked && !isLecture && !d.audioUrl && !isSanctuaryOfficialPrayer(d);

  return (
    <ScrollView
      contentContainerStyle={[styles.container, { paddingHorizontal: gutter, paddingBottom: insets.bottom + botPad }]}
      showsVerticalScrollIndicator={false}
    >
      {loading && !data ? (
        <View style={styles.loadingBanner}>
          <ActivityIndicator color={colors.accent} size="small" />
          <Text style={styles.loadingBannerText}>Loading full guide…</Text>
        </View>
      ) : null}
      <View style={[styles.topRow, { gap: rowGap, marginBottom: topMb }]}>
        <View style={[styles.topMeta, { gap: metaGap, flex: 1 }]}>
          <Text style={[styles.badge, { fontSize: fsBadge }]}>
            {isLecture
              ? "LECTURE"
              : officialGuideBadgeLabel(d.label)}
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

      <View
        style={
          isPremiumGuide
            ? [
                premiumCardStyle(true),
                {
                  padding: Math.round(clamp(16 * uiScale, 14, 20)),
                  borderRadius: Math.round(clamp(20 * uiScale, 18, 24)),
                  marginBottom: scrMb,
                },
              ]
            : undefined
        }
      >
      <Text style={[styles.title, { fontSize: fsTitle, marginBottom: titleMb }]}>{d.title}</Text>
      {d.subtitle ? <Text style={[styles.subtitle, { fontSize: fsSub, marginBottom: subMb }]}>{d.subtitle}</Text> : null}
      {d.scripture ? (
        <Text style={[styles.scripture, { fontSize: fsScripture, marginBottom: scrMb }]}>&ldquo;{d.scripture}&rdquo;</Text>
      ) : null}

      {(() => {
        const guideContent = (
          <>
            {isLecture && bodyText ? (
              <FormattedBodyText text={bodyText} style={styles.body} fontSize={fsBody} lineHeight={lhBody} />
            ) : null}

            {isLecture ? (
              <LectureTrackList
                tracks={lectureTracks}
                accentColor={colors.primary}
                isPremiumLocked={premiumLocked}
                guideIsPremium={isPremiumGuide}
              />
            ) : d.audioUrl && !premiumLocked ? (
              <CapsuleAudioPlayer audioUrl={d.audioUrl} accentColor={colors.primary} />
            ) : showAudioLock ? (
              <View style={styles.audioPlaceholder} accessibilityLabel="Premium audio locked" />
            ) : null}

            {!isLecture && bodyText ? (
              <>
                <FormattedBodyText
                  text={bodyText}
                  style={styles.body}
                  fontSize={fsBody}
                  lineHeight={lhBody}
                  numberOfLines={bodyExpanded || !longBody ? undefined : 6}
                />
                {longBody && !contentLocked ? (
                  <Pressable
                    onPress={() => setBodyExpanded((prev) => !prev)}
                    style={styles.moreToggle}
                    accessibilityRole="button"
                    accessibilityLabel={bodyExpanded ? "Show less description" : "Show full description"}
                  >
                    <Text style={[styles.moreToggleText, { fontSize: fsHint }]}>
                      {bodyExpanded ? "Less" : "More"}
                    </Text>
                  </Pressable>
                ) : null}
              </>
            ) : null}
          </>
        );

        if (!isPremiumGuide) {
          return <View style={{ marginBottom: scrMb }}>{guideContent}</View>;
        }

        return (
          <PremiumGatedContent
            locked={premiumLocked}
            isPremium
            mode={showAudioLock || isLecture ? "media" : "text"}
            minHeight={showAudioLock || isLecture ? 180 : 120}
          >
            {guideContent}
          </PremiumGatedContent>
        );
      })()}
      </View>

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

      <Pressable onPress={() => void loadDetail()} style={[styles.refresh, { marginTop: refreshMt }]}>
        <Text style={[styles.refreshText, { fontSize: fsRefresh }]}>Refresh if something looks out of date</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, backgroundColor: colors.cream, alignItems: "center", justifyContent: "center", padding: 24 },
  err: { fontFamily: "PlusJakartaSans_400Regular", color: colors.muted, textAlign: "center", marginBottom: 12 },
  retryBtn: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 20,
    backgroundColor: colors.primary,
  },
  retryBtnText: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 14,
    color: colors.surface,
  },
  loadingBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
    paddingVertical: 8,
  },
  loadingBannerText: {
    fontFamily: "PlusJakartaSans_400Regular",
    fontSize: 13,
    color: colors.muted,
  },
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
  audioPlaceholder: {
    minHeight: 72,
    borderRadius: 16,
    backgroundColor: colors.cream,
  },
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
