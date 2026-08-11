import { BlurView } from "expo-blur";
import { isLiquidGlassAvailable } from "expo-glass-effect";
import { Redirect, router, Tabs, usePathname, type Href } from "expo-router";
import { Icon, Label, NativeTabs } from "expo-router/unstable-native-tabs";
import { SymbolView } from "expo-symbols";
import { useGetNotifications, getGetNotificationsQueryKey } from "@workspace/api-client-react";
import type { Notification } from "@workspace/api-client-react";
import { LIVE_NOTIFICATIONS_POLL_MS } from "@/lib/liveSync";
import { Feather, Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import React, { useEffect, useMemo, useRef } from "react";
import { Animated, Platform, Pressable, StyleSheet, Text, View, useColorScheme } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import colors from "@/constants/colors";
import { AppLoadingScreen } from "@/components/AppLoadingScreen";
import { useAuth } from "@/context/auth";
import { useModerationBadge } from "@/context/moderationBadge";
import { TabBarVisibilityProvider, useTabBarVisibility } from "@/context/tabBarVisibility";
import { FeedNoticeBanner } from "@/components/FeedNoticeBanner";
import { useResponsiveLayout } from "@/hooks/useResponsiveLayout";
import { clamp } from "@/lib/responsiveMetrics";

const TAB_BAR_HEIGHT = Platform.OS === "ios" ? 52 : 58;

function isFeedsPath(pathname: string): boolean {
  return (
    pathname === "/" ||
    pathname === "/(tabs)" ||
    pathname === "/(tabs)/index" ||
    pathname === "/index"
  );
}

/** Keeps tab bar + FAB chrome in sync with route: reset when entering Feed, and when leaving Feed so other tabs are not stuck with a hidden bar. */
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
  const { fabSize, uiScale } = useResponsiveLayout();
  const { translateY, fabScale, fabOpacity, fabPointerEvents } = useTabBarVisibility();
  const isFeeds = isFeedsPath(pathname);
  const tabBarChrome = TAB_BAR_HEIGHT;
  const fabIcon = Math.round(clamp(fabSize * 0.5, 24, 32));
  const fabRight = Math.round(clamp(20 * uiScale, 16, 28));

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
            bottom: insets.bottom + tabBarChrome + Math.round(10 * uiScale),
            right: fabRight,
            transform: [{ scale: fabScale }],
            opacity: fabOpacity,
          },
        ]}
      >
        <Pressable
          onPress={() => router.push("/post/new")}
          style={({ pressed }) => [
            fabStyles.fab,
            {
              width: fabSize,
              height: fabSize,
              borderRadius: fabSize / 2,
            },
            pressed && fabStyles.fabPressed,
          ]}
          accessibilityRole="button"
          accessibilityLabel="Share a prayer"
          testID="compose-fab"
        >
          <Ionicons name="add" size={fabIcon} color={colors.surface} />
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
  const notifUnread = useNotificationsUnreadCount();
  return (
    <View style={{ flex: 1 }}>
    <NativeTabs>
      <NativeTabs.Trigger name="index">
        <Icon sf={{ default: "flame", selected: "flame.fill" }} />
        <Label>Feed</Label>
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
    <NativeAlertsUnreadBadge unreadCount={notifUnread} />
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
  { name: "index", title: "Feed", iosSymbol: "flame.fill", androidIcon: "flame", iconSet: "ionicons" },
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

type NotifRow = Notification & { isRead?: boolean };

function normalizeNotificationsPayload(data: unknown): NotifRow[] {
  if (Array.isArray(data)) return data as NotifRow[];
  if (data && typeof data === "object" && "notifications" in data) {
    const raw = (data as { notifications?: unknown }).notifications;
    if (Array.isArray(raw)) return raw as NotifRow[];
  }
  return [];
}

function useNotificationsUnreadCount() {
  const { token } = useAuth();
  const pathname = usePathname();
  const onAlertsTab =
    pathname === "/(tabs)/notifications" ||
    pathname === "/notifications" ||
    pathname.endsWith("/notifications");
  const { data } = useGetNotifications({
    query: {
      queryKey: getGetNotificationsQueryKey(),
      enabled: !!token,
      staleTime: 20_000,
      refetchIntervalInBackground: false,
      refetchInterval: token ? (onAlertsTab ? LIVE_NOTIFICATIONS_POLL_MS : 60_000) : false,
    },
  });
  return useMemo(() => {
    return normalizeNotificationsPayload(data).filter((n) => !n.isRead).length;
  }, [data]);
}

/** Aligns with system tab bar: badge over Alerts (3rd tab). Must stay inside TabBarVisibilityProvider. */
function NativeAlertsUnreadBadge({ unreadCount }: { unreadCount: number }) {
  const insets = useSafeAreaInsets();
  const { uiScale } = useResponsiveLayout();
  if (unreadCount <= 0) return null;
  const badgeMinW = Math.round(clamp(16 * uiScale, 14, 18));
  const badgeH = Math.round(clamp(16 * uiScale, 14, 18));
  const badgePadH = Math.round(clamp(4 * uiScale, 3, 5));
  const badgeRad = Math.round(clamp(8 * uiScale, 7, 10));
  const badgeBorder = Math.max(1, Math.round(1.5 * uiScale));
  const badgeFs = Math.round(clamp(9 * uiScale, 8, 10));
  const rowPadTop = Math.round(clamp(6 * uiScale, 5, 8));
  const contentH =
    Platform.OS === "ios"
      ? Math.round(clamp(52 * uiScale, 48, 58))
      : Math.round(clamp(58 * uiScale, 52, 64));
  return (
    <View pointerEvents="none" style={nativeBadgeStyles.wrap}>
      <View
        style={[
          nativeBadgeStyles.row,
          { paddingBottom: insets.bottom, minHeight: contentH + insets.bottom, paddingTop: rowPadTop },
        ]}
      >
        {TAB_ITEMS.map((tab) => (
          <View key={tab.name} style={nativeBadgeStyles.tabSlot}>
            {tab.name === "notifications" ? (
              <View
                style={[
                  nativeBadgeStyles.badge,
                  {
                    marginLeft: Math.round(clamp(20 * uiScale, 16, 26)),
                    minWidth: badgeMinW,
                    height: badgeH,
                    paddingHorizontal: badgePadH,
                    borderRadius: badgeRad,
                    borderWidth: badgeBorder,
                  },
                ]}
              >
                <Text style={[nativeBadgeStyles.badgeText, { fontSize: badgeFs }]}>
                  {unreadCount > 9 ? "9+" : String(unreadCount)}
                </Text>
              </View>
            ) : null}
          </View>
        ))}
      </View>
    </View>
  );
}

const nativeBadgeStyles = StyleSheet.create({
  wrap: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "flex-end",
  },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  tabSlot: {
    flex: 1,
    alignItems: "center",
  },
  badge: {
    marginTop: -2,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
    borderColor: colors.surface,
  },
  badgeText: {
    fontFamily: "PlusJakartaSans_700Bold",
    color: colors.primary,
  },
});

function CustomTabBar({ state, navigation }: { state: any; navigation: any }) {
  const insets = useSafeAreaInsets();
  const isIOS = Platform.OS === "ios";
  const isDark = useColorScheme() === "dark";
  const { iconTab, tabLabelSize, uiScale } = useResponsiveLayout();
  const tabBadgeMinW = Math.round(clamp(16 * uiScale, 14, 18));
  const tabBadgeH = Math.round(clamp(16 * uiScale, 14, 18));
  const tabBadgePadH = Math.round(clamp(4 * uiScale, 3, 5));
  const tabBadgeRad = Math.round(clamp(8 * uiScale, 7, 10));
  const tabBadgeFs = Math.round(clamp(9 * uiScale, 8, 10));
  const tabBadgeTop = Math.round(clamp(-6 * uiScale, -8, -4));
  const tabBadgeRight = Math.round(clamp(-10 * uiScale, -12, -8));
  const tabBadgeBorder = Math.max(1, Math.round(1.5 * uiScale));
  const { user: authUser } = useAuth();
  const isMod = authUser?.role === "admin" || authUser?.role === "moderator";
  const { pendingCount } = useModerationBadge();
  const notifUnread = useNotificationsUnreadCount();

  const bgColor = isIOS ? "transparent" : isDark ? "#1A1F36" : colors.surface;

  return (
    <View
      style={[
        tabBarStyles.container,
        {
          backgroundColor: bgColor,
          paddingBottom: insets.bottom,
          borderTopWidth: 0,
          borderTopColor: colors.border,
        },
      ]}
    >
      {isIOS && (
        <BlurView intensity={80} tint="light" style={StyleSheet.absoluteFill} />
      )}
      {TAB_ITEMS.map((tab, index) => {
        const focused = state.index === index;
        const tint = focused ? colors.flame : colors.muted;
        const showModBadge = isMod && tab.name === "profile" && pendingCount > 0;
        const showNotifBadge = tab.name === "notifications" && notifUnread > 0;
        return (
          <Pressable
            key={tab.name}
            accessibilityRole="button"
            accessibilityState={{ selected: focused }}
            {...(tab.name === "notifications" && notifUnread > 0
              ? { accessibilityLabel: `Alerts, ${notifUnread} unread` }
              : {})}
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
                <SymbolView name={tab.iosSymbol as any} tintColor={tint} size={iconTab} />
              ) : tab.iconSet === "ionicons" ? (
                <Ionicons name={tab.androidIcon as any} size={iconTab} color={tint} />
              ) : tab.iconSet === "mci" ? (
                <MaterialCommunityIcons name={tab.androidIcon as any} size={iconTab} color={tint} />
              ) : (
                <Feather name={tab.androidIcon as any} size={Math.max(18, iconTab - 2)} color={tint} />
              )}
              {showModBadge && (
                <View
                  style={[
                    tabBarStyles.modTabBadge,
                    {
                      top: tabBadgeTop,
                      right: tabBadgeRight,
                      minWidth: tabBadgeMinW,
                      height: tabBadgeH,
                      paddingHorizontal: tabBadgePadH,
                      borderRadius: tabBadgeRad,
                    },
                  ]}
                >
                  <Text style={[tabBarStyles.modTabBadgeText, { fontSize: tabBadgeFs }]}>
                    {pendingCount > 9 ? "9+" : String(pendingCount)}
                  </Text>
                </View>
              )}
              {showNotifBadge && (
                <View
                  style={[
                    tabBarStyles.notifTabBadge,
                    {
                      top: tabBadgeTop,
                      right: tabBadgeRight,
                      minWidth: tabBadgeMinW,
                      height: tabBadgeH,
                      paddingHorizontal: tabBadgePadH,
                      borderRadius: tabBadgeRad,
                      borderWidth: tabBadgeBorder,
                    },
                  ]}
                >
                  <Text style={[tabBarStyles.notifTabBadgeText, { fontSize: tabBadgeFs }]}>
                    {notifUnread > 9 ? "9+" : String(notifUnread)}
                  </Text>
                </View>
              )}
            </View>
            <Text
              style={[tabBarStyles.label, { color: tint, fontSize: tabLabelSize }]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.75}
            >
              {tab.title}
            </Text>
          </Pressable>
        );
      })}
    </View>
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
    color: colors.surface,
  },
  notifTabBadge: {
    position: "absolute",
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
    borderColor: colors.surface,
  },
  notifTabBadgeText: {
    fontFamily: "PlusJakartaSans_700Bold",
    color: colors.primary,
  },
  label: {
    fontFamily: "PlusJakartaSans_600SemiBold",
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
      <Tabs.Screen name="index" options={{ title: "Feed" }} />
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

  if (loading) {
    return <AppLoadingScreen variant="splash" />;
  }

  if (!user) {
    return <Redirect href="/" />;
  }
  if (!user.isEmailVerified) {
    return <Redirect href={"/(auth)/verify" as Href} />;
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
