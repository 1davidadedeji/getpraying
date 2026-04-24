import { BlurView } from "expo-blur";
import { isLiquidGlassAvailable } from "expo-glass-effect";
import { Redirect, router, Tabs, usePathname, type Href } from "expo-router";
import { Icon, Label, NativeTabs } from "expo-router/unstable-native-tabs";
import { SymbolView } from "expo-symbols";
import { Feather, Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import React, { useEffect, useRef } from "react";
import { ActivityIndicator, Animated, Platform, Pressable, StyleSheet, Text, View, useColorScheme } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import colors from "@/constants/colors";
import { useAuth } from "@/context/auth";
import { useModerationBadge } from "@/context/moderationBadge";
import { useRevenueCat } from "@/context/revenuecat";
import { TabBarVisibilityProvider, useTabBarVisibility } from "@/context/tabBarVisibility";
import { FeedNoticeBanner } from "@/components/FeedNoticeBanner";

const TAB_BAR_HEIGHT = Platform.OS === "web" ? 72 : Platform.OS === "ios" ? 52 : 58;

function isFeedsPath(pathname: string): boolean {
  return (
    pathname === "/" ||
    pathname === "/(tabs)" ||
    pathname === "/(tabs)/index" ||
    pathname === "/index"
  );
}

/** Keeps tab bar + FAB chrome in sync with route: reset when entering Feeds, and when leaving Feeds so other tabs are not stuck with a hidden bar. */
function ScrollChromeSync() {
  const pathname = usePathname();
  const { resetScrollChrome } = useTabBarVisibility();
  const isFeeds = isFeedsPath(pathname);
  const prevIsFeeds = useRef<boolean | null>(null);

  useEffect(() => {
    if (isFeeds) {
      resetScrollChrome();
    } else if (prevIsFeeds.current === true) {
      resetScrollChrome();
    }
    prevIsFeeds.current = isFeeds;
  }, [isFeeds, resetScrollChrome]);

  return null;
}

function ComposeFab() {
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const { translateY, fabScale, fabOpacity, fabPointerEvents } = useTabBarVisibility();
  const isFeeds = isFeedsPath(pathname);

  if (!isFeeds) return null;
  return (
    <Animated.View
      pointerEvents={fabPointerEvents}
      style={[StyleSheet.absoluteFill, { transform: [{ translateY }] }]}
    >
      <Animated.View
        style={[
          fabStyles.fabWrap,
          {
            bottom: insets.bottom + TAB_BAR_HEIGHT + 10,
            right: 20,
            transform: [{ scale: fabScale }],
            opacity: fabOpacity,
          },
        ]}
      >
        <Pressable
          onPress={() => router.push("/post/new")}
          style={({ pressed }) => [fabStyles.fab, pressed && fabStyles.fabPressed]}
          accessibilityRole="button"
          accessibilityLabel="Share a prayer"
          testID="compose-fab"
        >
          <Ionicons name="add" size={28} color={colors.surface} />
        </Pressable>
      </Animated.View>
    </Animated.View>
  );
}

const fabStyles = StyleSheet.create({
  fabWrap: {
    position: "absolute",
  },
  fab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
  },
  fabPressed: { opacity: 0.92 },
});

function NativeTabLayout() {
  return (
    <View style={{ flex: 1 }}>
    <NativeTabs>
      <NativeTabs.Trigger name="index">
        <Icon sf={{ default: "flame", selected: "flame.fill" }} />
        <Label>Feeds</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="library">
        <Icon sf={{ default: "square.stack.3d.up", selected: "square.stack.3d.up.fill" }} />
        <Label>Library</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="notifications">
        <Icon sf={{ default: "bell", selected: "bell.fill" }} />
        <Label>Alerts</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="profile">
        <Icon sf={{ default: "person", selected: "person.fill" }} />
        <Label>Profile</Label>
      </NativeTabs.Trigger>
    </NativeTabs>
    <ScrollChromeSync />
    <ComposeFab />
    <FeedNoticeBanner />
    </View>
  );
}

type TabItemConfig = {
  name: string;
  title: string;
  iosSymbol: string;
  androidIcon: string;
  iconSet: "ionicons" | "mci" | "feather";
};

const TAB_ITEMS: TabItemConfig[] = [
  { name: "index", title: "Feeds", iosSymbol: "flame.fill", androidIcon: "flame", iconSet: "ionicons" },
  {
    name: "library",
    title: "Library",
    iosSymbol: "square.stack.3d.up.fill",
    androidIcon: "book-open",
    iconSet: "feather",
  },
  { name: "notifications", title: "Alerts", iosSymbol: "bell.fill", androidIcon: "bell", iconSet: "feather" },
  { name: "profile", title: "Profile", iosSymbol: "person.fill", androidIcon: "user", iconSet: "feather" },
];

function CustomTabBar({ state, navigation }: { state: any; navigation: any }) {
  const insets = useSafeAreaInsets();
  const isIOS = Platform.OS === "ios";
  const isWeb = Platform.OS === "web";
  const isDark = useColorScheme() === "dark";
  const { translateY } = useTabBarVisibility();
  const { user: authUser } = useAuth();
  const isMod = authUser?.role === "admin" || authUser?.role === "moderator";
  const { pendingCount } = useModerationBadge();

  const bgColor = isIOS ? "transparent" : isDark ? "#1A1F36" : colors.surface;
  const barHeight = isWeb ? 84 : undefined;

  return (
    <Animated.View
      style={[
        tabBarStyles.container,
        {
          backgroundColor: bgColor,
          paddingBottom: insets.bottom,
          borderTopWidth: isWeb ? 1 : 0,
          borderTopColor: colors.border,
          transform: [{ translateY }],
          ...(barHeight ? { height: barHeight } : {}),
        },
      ]}
    >
      {isIOS && (
        <BlurView intensity={80} tint="light" style={StyleSheet.absoluteFill} />
      )}
      {isWeb && !isIOS && (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.surface }]} />
      )}
      {TAB_ITEMS.map((tab, index) => {
        const focused = state.index === index;
        const tint = focused ? colors.flame : colors.muted;
        const showModBadge = isMod && tab.name === "profile" && pendingCount > 0;
        return (
          <Pressable
            key={tab.name}
            accessibilityRole="button"
            accessibilityState={{ selected: focused }}
            onPress={() => {
              const route = state.routes[index];
              const event = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
              if (!focused && !event.defaultPrevented) {
                navigation.navigate(route.name);
              }
            }}
            style={tabBarStyles.tab}
          >
            <View style={tabBarStyles.iconWrap}>
              {isIOS ? (
                <SymbolView name={tab.iosSymbol as any} tintColor={tint} size={24} />
              ) : tab.iconSet === "ionicons" ? (
                <Ionicons name={tab.androidIcon as any} size={24} color={tint} />
              ) : tab.iconSet === "mci" ? (
                <MaterialCommunityIcons name={tab.androidIcon as any} size={24} color={tint} />
              ) : (
                <Feather name={tab.androidIcon as any} size={22} color={tint} />
              )}
              {showModBadge && (
                <View style={tabBarStyles.modTabBadge}>
                  <Text style={tabBarStyles.modTabBadgeText}>
                    {pendingCount > 9 ? "9+" : String(pendingCount)}
                  </Text>
                </View>
              )}
            </View>
            <Text
              style={[tabBarStyles.label, { color: tint }]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.75}
            >
              {tab.title}
            </Text>
          </Pressable>
        );
      })}
    </Animated.View>
  );
}

const tabBarStyles = StyleSheet.create({
  container: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    elevation: 0,
  },
  tab: {
    flex: 1,
    minWidth: 0,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    gap: 2,
    paddingHorizontal: 2,
  },
  iconWrap: {
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
  },
  modTabBadge: {
    position: "absolute",
    top: -6,
    right: -10,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 4,
    borderRadius: 8,
    backgroundColor: colors.danger,
    alignItems: "center",
    justifyContent: "center",
  },
  modTabBadgeText: {
    fontFamily: "PlusJakartaSans_700Bold",
    fontSize: 9,
    color: colors.surface,
  },
  label: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 11,
  },
});

function ClassicTabLayout() {
  return (
    <View style={{ flex: 1 }}>
    <Tabs
      tabBar={(props) => <CustomTabBar state={props.state} navigation={props.navigation} />}
      screenOptions={{
        headerShown: false,
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Feeds" }} />
      <Tabs.Screen name="library" options={{ title: "Library" }} />
      <Tabs.Screen name="notifications" options={{ title: "Alerts" }} />
      <Tabs.Screen name="profile" options={{ title: "Profile" }} />
    </Tabs>
    <ScrollChromeSync />
    <ComposeFab />
    <FeedNoticeBanner />
    </View>
  );
}

export default function TabLayout() {
  const { user, loading } = useAuth();
  const rc = useRevenueCat();

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.cream, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  if (!user) {
    return <Redirect href="/" />;
  }
  if (!user.isEmailVerified) {
    return <Redirect href={"/(auth)/verify" as Href} />;
  }
  if (user.role !== "admin" && user.role !== "moderator") {
    const startedAt = user.trialStartsAt ? new Date(user.trialStartsAt as any) : null;
    const trialExpired =
      startedAt != null && Date.now() - startedAt.getTime() > 7 * 24 * 60 * 60 * 1000;
    if (trialExpired && rc.isReady && rc.enabled && !rc.isEntitled) {
      return <Redirect href={"/(paywall)" as any} />;
    }
  }

  let useLiquidGlass = false;
  try { useLiquidGlass = Platform.OS === "ios" && isLiquidGlassAvailable(); } catch {}
  if (useLiquidGlass) {
    return (
      <TabBarVisibilityProvider>
        <NativeTabLayout />
      </TabBarVisibilityProvider>
    );
  }
  return (
    <TabBarVisibilityProvider>
      <ClassicTabLayout />
    </TabBarVisibilityProvider>
  );
}
