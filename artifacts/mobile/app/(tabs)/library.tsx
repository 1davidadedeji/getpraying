import { Feather, Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  useGetOfficialPrayers,
  useGetPaths,
  useGetSavedPrayers,
} from "@workspace/api-client-react";
import type { OfficialPrayer } from "@workspace/api-client-react";
import PathCard from "@/components/PathCard";
import PrayerCard from "@/components/PrayerCard";
import PostCard from "@/components/PostCard";
import colors from "@/constants/colors";
import { useAuth } from "@/context/auth";
import { getApiBaseUrl } from "@/lib/apiBase";

type Tab = "official" | "paths" | "categories" | "saved";

type CategoryItem = { name: string; count: number; icon: string };

const FEATHER_ICON_MAP: Record<string, string> = {
  waves: "wind",
  sun: "sun",
  "heart-pulse": "heart",
  compass: "compass",
  users: "users",
  stethoscope: "activity",
  briefcase: "briefcase",
  "dollar-sign": "dollar-sign",
  moon: "moon",
  sprout: "trending-up",
  "hand-heart": "heart",
  heart: "heart",
  brain: "cpu",
};

function PrayerDetailModal({
  prayer,
  visible,
  onClose,
}: {
  prayer: OfficialPrayer | null;
  visible: boolean;
  onClose: () => void;
}) {
  if (!prayer) return null;
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={styles.modalRoot}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>{prayer.title}</Text>
          <Pressable onPress={onClose} hitSlop={8} style={styles.modalCloseBtn}>
            <Feather name="x" size={22} color={colors.primary} />
          </Pressable>
        </View>
        {prayer.subtitle && (
          <Text style={styles.modalSubtitle}>{prayer.subtitle}</Text>
        )}
        {prayer.category && (
          <View style={styles.modalCatBadge}>
            <Feather name="tag" size={11} color={colors.accent} />
            <Text style={styles.modalCatText}>{prayer.category}</Text>
          </View>
        )}
        <ScrollView
          style={styles.modalScrollBody}
          contentContainerStyle={styles.modalScrollContent}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.modalPrayerBody}>{prayer.content}</Text>
          {prayer.scripture && (
            <View style={styles.scriptureBlock}>
              <Ionicons name="book-outline" size={16} color={colors.accent} />
              <Text style={styles.scriptureText}>{prayer.scripture}</Text>
            </View>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

export default function LibraryScreen() {
  const insets = useSafeAreaInsets();
  const { token } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>("official");
  const [selectedPrayer, setSelectedPrayer] = useState<OfficialPrayer | null>(null);
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [loadingCats, setLoadingCats] = useState(false);

  const { data: officialData, isLoading: loadingOfficial } = useGetOfficialPrayers({});
  const { data: pathsData, isLoading: loadingPaths } = useGetPaths();
  const { data: savedData, isLoading: loadingSaved } = useGetSavedPrayers();

  const loadCategories = useCallback(async () => {
    setLoadingCats(true);
    try {
      const base = getApiBaseUrl();
      const headers: Record<string, string> = {};
      if (token) headers.Authorization = `Bearer ${token}`;
      const res = await fetch(`${base}/api/library/categories`, { headers });
      if (res.ok) {
        const data = await res.json();
        setCategories(Array.isArray(data) ? data : []);
      }
    } catch { /* silent */ } finally {
      setLoadingCats(false);
    }
  }, [token]);

  useEffect(() => {
    if (activeTab === "categories" && categories.length === 0) {
      void loadCategories();
    }
  }, [activeTab, categories.length, loadCategories]);

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const tabs: { key: Tab; label: string; icon: "book-open" | "compass" | "grid" | "bookmark" }[] = [
    { key: "official", label: "Prayers", icon: "book-open" },
    { key: "paths", label: "Paths", icon: "compass" },
    { key: "categories", label: "Explore", icon: "grid" },
    { key: "saved", label: "Saved", icon: "bookmark" },
  ];

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      <PrayerDetailModal
        prayer={selectedPrayer}
        visible={!!selectedPrayer}
        onClose={() => setSelectedPrayer(null)}
      />

      <View style={styles.header}>
        <Text style={styles.title}>Prayer Library</Text>
        <Text style={styles.subtitle}>Curated for your walk</Text>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabRow}>
        {tabs.map((t) => (
          <TouchableOpacity
            key={t.key}
            style={[styles.tab, activeTab === t.key && styles.tabActive]}
            onPress={() => setActiveTab(t.key)}
          >
            <Feather
              name={t.icon}
              size={15}
              color={activeTab === t.key ? colors.surface : colors.muted}
            />
            <Text style={[styles.tabText, activeTab === t.key && styles.tabTextActive]}>
              {t.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {activeTab === "official" && (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: 100 }]}
        >
          {loadingOfficial ? (
            <ActivityIndicator color={colors.accent} style={styles.loader} />
          ) : (officialData as any)?.prayers?.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="book-outline" size={40} color={colors.muted} />
              <Text style={styles.emptyText}>No official prayers yet</Text>
            </View>
          ) : (
            ((officialData as any)?.prayers ?? []).map((p: any) => (
              <PrayerCard key={p.id} prayer={p} onPress={() => setSelectedPrayer(p)} />
            ))
          )}
        </ScrollView>
      )}

      {activeTab === "paths" && (
        <FlatList
          data={(pathsData as any)?.paths ?? []}
          keyExtractor={(item: any) => String(item.id)}
          renderItem={({ item }: any) => <PathCard path={item} />}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: 100 }]}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            loadingPaths ? (
              <ActivityIndicator color={colors.accent} style={styles.loader} />
            ) : (
              <View style={styles.emptyState}>
                <Ionicons name="compass-outline" size={40} color={colors.muted} />
                <Text style={styles.emptyText}>No prayer paths yet</Text>
              </View>
            )
          }
        />
      )}

      {activeTab === "categories" && (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: 100 }]}
        >
          {loadingCats ? (
            <ActivityIndicator color={colors.accent} style={styles.loader} />
          ) : categories.length === 0 ? (
            <View style={styles.emptyState}>
              <Feather name="grid" size={40} color={colors.muted} />
              <Text style={styles.emptyText}>No categories yet</Text>
            </View>
          ) : (
            <View style={styles.catGrid}>
              {categories.map((cat) => (
                <Pressable
                  key={cat.name}
                  style={({ pressed }) => [styles.catCard, pressed && styles.catCardPressed]}
                  onPress={() => router.push(`/category/${encodeURIComponent(cat.name.toLowerCase())}` as never)}
                >
                  <View style={styles.catIconBg}>
                    <Feather
                      name={(FEATHER_ICON_MAP[cat.icon] ?? "hash") as any}
                      size={22}
                      color={colors.surface}
                    />
                  </View>
                  <Text style={styles.catName}>{cat.name}</Text>
                  <Text style={styles.catCount}>{cat.count} prayers</Text>
                </Pressable>
              ))}
            </View>
          )}
        </ScrollView>
      )}

      {activeTab === "saved" && (
        <FlatList
          data={(savedData as any)?.posts ?? []}
          keyExtractor={(item: any) => String(item.id)}
          renderItem={({ item }: any) => <PostCard post={item} />}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: 100 }]}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            loadingSaved ? (
              <ActivityIndicator color={colors.accent} style={styles.loader} />
            ) : (
              <View style={styles.emptyState}>
                <Ionicons name="bookmark-outline" size={40} color={colors.muted} />
                <Text style={styles.emptyText}>No saved prayers yet</Text>
                <Text style={styles.emptySubtext}>Tap the bookmark on any post to save it</Text>
              </View>
            )
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.cream,
  },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 12,
    paddingTop: 8,
  },
  title: {
    fontFamily: "NotoSerif_700Bold",
    fontSize: 24,
    color: colors.primary,
  },
  subtitle: {
    fontFamily: "PlusJakartaSans_400Regular",
    fontSize: 13,
    color: colors.muted,
    marginTop: 2,
  },
  tabRow: {
    paddingHorizontal: 20,
    gap: 8,
    marginBottom: 16,
  },
  tab: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 50,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tabActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  tabText: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 13,
    color: colors.muted,
  },
  tabTextActive: {
    color: colors.surface,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 4,
  },
  loader: {
    marginTop: 40,
  },
  emptyState: {
    alignItems: "center",
    paddingTop: 60,
    gap: 10,
  },
  emptyText: {
    fontFamily: "NotoSerif_700Bold",
    fontSize: 16,
    color: colors.primary,
  },
  emptySubtext: {
    fontFamily: "PlusJakartaSans_400Regular",
    fontSize: 13,
    color: colors.muted,
    textAlign: "center",
  },
  modalRoot: {
    flex: 1,
    backgroundColor: colors.cream,
    padding: 20,
    paddingTop: 16,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  modalTitle: {
    fontFamily: "NotoSerif_700Bold",
    fontSize: 22,
    color: colors.primary,
    flex: 1,
    marginRight: 12,
  },
  modalCloseBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  modalSubtitle: {
    fontFamily: "PlusJakartaSans_400Regular",
    fontSize: 14,
    color: colors.muted,
    fontStyle: "italic",
    marginBottom: 8,
  },
  modalCatBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    alignSelf: "flex-start",
    backgroundColor: colors.flameDim,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginBottom: 16,
  },
  modalCatText: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 12,
    color: colors.accent,
    textTransform: "capitalize",
  },
  modalScrollBody: {
    flex: 1,
  },
  modalScrollContent: {
    paddingBottom: 40,
  },
  modalPrayerBody: {
    fontFamily: "PlusJakartaSans_400Regular",
    fontSize: 17,
    color: colors.text,
    lineHeight: 28,
  },
  scriptureBlock: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    marginTop: 20,
    padding: 14,
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  scriptureText: {
    fontFamily: "NotoSerif_700Bold",
    fontSize: 14,
    color: colors.primary,
    flex: 1,
    lineHeight: 22,
  },
  catGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  catCard: {
    width: "47%",
    backgroundColor: colors.surface,
    borderRadius: 32,
    padding: 16,
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  catCardPressed: {
    opacity: 0.85,
  },
  catIconBg: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  catName: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 14,
    color: colors.text,
    textAlign: "center",
  },
  catCount: {
    fontFamily: "PlusJakartaSans_400Regular",
    fontSize: 12,
    color: colors.muted,
  },
});
