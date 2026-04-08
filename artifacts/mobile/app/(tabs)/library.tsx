import { Feather, Ionicons } from "@expo/vector-icons";
import React, { useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Platform,
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
import PathCard from "@/components/PathCard";
import PrayerCard from "@/components/PrayerCard";
import PostCard from "@/components/PostCard";
import colors from "@/constants/colors";

type Tab = "official" | "paths" | "saved";

export default function LibraryScreen() {
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<Tab>("official");

  const { data: officialData, isLoading: loadingOfficial } = useGetOfficialPrayers({});
  const { data: pathsData, isLoading: loadingPaths } = useGetPaths();
  const { data: savedData, isLoading: loadingSaved } = useGetSavedPrayers();

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const tabs: { key: Tab; label: string; icon: string }[] = [
    { key: "official", label: "Prayers", icon: "book-open" },
    { key: "paths", label: "Paths", icon: "compass" },
    { key: "saved", label: "Saved", icon: "bookmark" },
  ];

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      <View style={styles.header}>
        <Text style={styles.title}>Prayer Library</Text>
        <Text style={styles.subtitle}>Curated for your walk</Text>
      </View>

      <View style={styles.tabRow}>
        {tabs.map((t) => (
          <TouchableOpacity
            key={t.key}
            style={[styles.tab, activeTab === t.key && styles.tabActive]}
            onPress={() => setActiveTab(t.key)}
          >
            {t.key === "saved" ? (
              <Text style={[styles.tabEmoji, activeTab === t.key ? styles.tabEmojiActive : styles.tabEmojiInactive]}>
                🪜
              </Text>
            ) : (
              <Feather
                name={t.icon as any}
                size={15}
                color={activeTab === t.key ? colors.surface : colors.muted}
              />
            )}
            <Text style={[styles.tabText, activeTab === t.key && styles.tabTextActive]}>
              {t.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {activeTab === "official" && (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: Platform.OS === "web" ? 100 : 100 }]}
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
              <PrayerCard key={p.id} prayer={p} />
            ))
          )}
        </ScrollView>
      )}

      {activeTab === "paths" && (
        <FlatList
          data={(pathsData as any)?.paths ?? []}
          keyExtractor={(item: any) => String(item.id)}
          renderItem={({ item }: any) => <PathCard path={item} />}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: Platform.OS === "web" ? 100 : 100 }]}
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

      {activeTab === "saved" && (
        <FlatList
          data={(savedData as any)?.posts ?? []}
          keyExtractor={(item: any) => String(item.id)}
          renderItem={({ item }: any) => <PostCard post={item} />}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: Platform.OS === "web" ? 100 : 100 }]}
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
    flexDirection: "row",
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
  tabEmoji: {
    fontSize: 15,
    lineHeight: 16,
  },
  tabEmojiActive: {
    opacity: 1,
  },
  tabEmojiInactive: {
    opacity: 0.7,
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
});
