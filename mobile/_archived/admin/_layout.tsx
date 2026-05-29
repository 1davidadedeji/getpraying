import { Feather } from "@expo/vector-icons";
import { Stack, router, type Href } from "expo-router";
import React from "react";
import { Platform, Pressable } from "react-native";
import colors from "@/constants/colors";
import { useResponsiveLayout } from "@/hooks/useResponsiveLayout";
import { clamp } from "@/lib/responsiveMetrics";

function AdminHubBack() {
  const { uiScale } = useResponsiveLayout();
  const iconSize = Math.round(clamp(26 * uiScale, 22, 30));
  const hitSlop = Math.round(clamp(12 * uiScale, 10, 16));
  const padV = Math.round(clamp(8 * uiScale, 6, 10));
  const padR = Math.round(clamp(8 * uiScale, 6, 10));
  const marginL = Platform.OS === "ios" ? Math.round(clamp(8 * uiScale, 6, 10)) : Math.round(clamp(4 * uiScale, 3, 6));
  return (
    <Pressable
      onPress={() => {
        if (router.canGoBack()) router.back();
        else router.replace("/(tabs)" as Href);
      }}
      hitSlop={hitSlop}
      accessibilityRole="button"
      accessibilityLabel="Go back"
      style={{ paddingVertical: padV, paddingRight: padR, marginLeft: marginL }}
    >
      <Feather name="chevron-left" size={iconSize} color={colors.primary} />
    </Pressable>
  );
}

export default function AdminLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerStyle: { backgroundColor: colors.cream },
        headerTintColor: colors.primary,
        headerTitleStyle: { fontFamily: "NotoSerif_700Bold" },
        contentStyle: { backgroundColor: colors.cream },
        headerBackTitle: "Back",
      }}
    >
      <Stack.Screen
        name="index"
        options={{
          title: "Admin",
          headerLeft: () => <AdminHubBack />,
        }}
      />
      <Stack.Screen name="queue" options={{ title: "Moderation queue" }} />
      <Stack.Screen name="daily-word" options={{ title: "Today's Word" }} />
      <Stack.Screen name="official-guides" options={{ title: "Official guides" }} />
      <Stack.Screen name="users" options={{ title: "Users & roles" }} />
    </Stack>
  );
}
