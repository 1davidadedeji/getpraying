import { Feather, Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  useGetSavedPrayers,
} from "@workspace/api-client-react";
import PostCard from "@/components/PostCard";
import colors from "@/constants/colors";
import { useAuth } from "@/context/auth";
import { apiUrl, authHeaders } from "@/lib/api";

type Tab = "categories" | "saved";

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
  shield: "shield",
  leaf: "feather",
  cloud: "cloud",
  star: "star",
  music: "music",
  "help-circle": "help-circle",
  zap: "zap",
};

export default function LibraryScreen() {
  const insets = useSafeAreaInsets();
  const { token } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>("categories");
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [loadingCats, setLoadingCats] = useState(false);

  const { data: savedData, isLoading: loadingSaved } = useGetSavedPrayers();

  const loadCategories = useCallback(async () => {
    setLoadingCats(true);
    try {
      const res = await fetch(apiUrl("/library/categories"), { headers: authHeaders(token) });
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
  const screenWidth = Dimensions.get("window").width;
  const isTablet = screenWidth >= 768;
  const numColumns = isTablet ? 3 : 2;
  const cardGap = 10;
  const horizontalPad = 16;
  const totalGaps = (numColumns - 1) * cardGap;
  const cardWidth = (screenWidth - horizontalPad * 2 - totalGaps) / numColumns;

  const tabs: { key: Tab; label: string; icon: "grid" | "bookmark" }[] = [
    { key: "categories", label: "Explore", icon: "grid" },
    { key: "saved", label: "Saved", icon: "bookmark" },
  ];

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      <View style={styles.header}>
        <Text style={styles.title}>Prayer Library</Text>
        <Text style={styles.subtitle}>Curated for your walk</Text>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabRow}>
        {tabs.map((t) => (
          <Pressable
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
          </Pressable>
        ))}
      </ScrollView>

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
                  style={({ pressed }) => [
                    styles.catCard,
                    { width: cardWidth },
                    pressed && styles.catCardPressed,
                  ]}
                  onPress={() => router.push(`/category/${encodeURIComponent(cat.name.toLowerCase())}` as never)}
                >
                  <View style={styles.catIconBg}>
                    <Feather
                      name={(FEATHER_ICON_MAP[cat.icon] ?? "hash") as any}
                      size={22}
                      color={colors.surface}
                    />
                  </View>
                  <Text style={styles.catName} numberOfLines={2}>{cat.name}</Text>
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
  catGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  catCard: {
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
});
