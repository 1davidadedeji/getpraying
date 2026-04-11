import { BlurView } from "expo-blur";
import { isLiquidGlassAvailable } from "expo-glass-effect";
import { Redirect, router, Tabs, type Href } from "expo-router";
import { Icon, Label, NativeTabs } from "expo-router/unstable-native-tabs";
import { SymbolView } from "expo-symbols";
import { Feather, Ionicons } from "@expo/vector-icons";
import React from "react";
import { ActivityIndicator, Platform, Pressable, StyleSheet, View, useColorScheme } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import colors from "@/constants/colors";
import { useAuth } from "@/context/auth";

const TAB_BAR_HEIGHT = Platform.OS === "web" ? 72 : Platform.OS === "ios" ? 52 : 58;

function ComposeFab() {
  const insets = useSafeAreaInsets();
  return (
    <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
      <Pressable
        onPress={() => router.push("/post/new")}
        style={({ pressed }) => [
          fabStyles.fab,
          { bottom: insets.bottom + TAB_BAR_HEIGHT + 10, right: 20 },
          pressed && fabStyles.fabPressed,
        ]}
        accessibilityRole="button"
        accessibilityLabel="Share a prayer"
        testID="compose-fab"
      >
        <Ionicons name="add" size={28} color={colors.surface} />
      </Pressable>
    </View>
  );
}

const fabStyles = StyleSheet.create({
  fab: {
    position: "absolute",
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
        <Icon sf={{ default: "books.vertical", selected: "books.vertical.fill" }} />
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
    <ComposeFab />
    </View>
  );
}

function ClassicTabLayout() {
  const isDark = useColorScheme() === "dark";
  const isIOS = Platform.OS === "ios";
  const isWeb = Platform.OS === "web";

  return (
    <View style={{ flex: 1 }}>
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.flame,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: {
          position: "absolute",
          backgroundColor: isIOS ? "transparent" : isDark ? "#1A1F36" : colors.surface,
          borderTopWidth: isWeb ? 1 : 0,
          borderTopColor: colors.border,
          elevation: 0,
          ...(isWeb ? { height: 84 } : {}),
        },
        tabBarBackground: () =>
          isIOS ? (
            <BlurView
              intensity={80}
              tint="light"
              style={StyleSheet.absoluteFill}
            />
          ) : isWeb ? (
            <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.surface }]} />
          ) : null,
        tabBarShowLabel: true,
        tabBarLabelStyle: {
          fontFamily: "PlusJakartaSans_600SemiBold",
          fontSize: 11,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Feeds",
          tabBarIcon: ({ color }) =>
            isIOS ? (
              <SymbolView name="flame.fill" tintColor={color} size={24} />
            ) : (
              <Ionicons name="flame" size={24} color={color} />
            ),
        }}
      />
      <Tabs.Screen
        name="library"
        options={{
          title: "Library",
          tabBarIcon: ({ color }) =>
            isIOS ? (
              <SymbolView name="books.vertical.fill" tintColor={color} size={24} />
            ) : (
              <Feather name="book-open" size={22} color={color} />
            ),
        }}
      />
      <Tabs.Screen
        name="notifications"
        options={{
          title: "Alerts",
          tabBarIcon: ({ color }) =>
            isIOS ? (
              <SymbolView name="bell.fill" tintColor={color} size={24} />
            ) : (
              <Feather name="bell" size={22} color={color} />
            ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color }) =>
            isIOS ? (
              <SymbolView name="person.fill" tintColor={color} size={24} />
            ) : (
              <Feather name="user" size={22} color={color} />
            ),
        }}
      />
    </Tabs>
    <ComposeFab />
    </View>
  );
}

export default function TabLayout() {
  const { user, loading } = useAuth();

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
  // TODO: Re-enable RevenueCat for final milestone — restore paywall redirect for expired trial without entitlement
  // if (user.role !== "admin" && user.role !== "moderator") {
  //   const startedAt = user.trialStartsAt ? new Date(user.trialStartsAt as any) : null;
  //   const trialExpired =
  //     startedAt != null && Date.now() - startedAt.getTime() > 7 * 24 * 60 * 60 * 1000;
  //   if (trialExpired && rc.isReady && rc.enabled && !rc.isEntitled) {
  //     return <Redirect href={"/(paywall)" as any} />;
  //   }
  // }

  // NativeTabs + SF Symbol icons are iOS-only; never use on Android (can crash release builds).
  if (Platform.OS === "ios" && isLiquidGlassAvailable()) {
    return <NativeTabLayout />;
  }
  return <ClassicTabLayout />;
}
