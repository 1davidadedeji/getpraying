import { Feather } from "@expo/vector-icons";
import { Stack, router, type Href } from "expo-router";
import React from "react";
import { Platform, Pressable } from "react-native";
import colors from "@/constants/colors";

function AdminHubBack() {
  return (
    <Pressable
      onPress={() => {
        if (router.canGoBack()) router.back();
        else router.replace("/(tabs)" as Href);
      }}
      hitSlop={12}
      accessibilityRole="button"
      accessibilityLabel="Go back"
      style={{ paddingVertical: 8, paddingRight: 8, marginLeft: Platform.OS === "ios" ? 8 : 4 }}
    >
      <Feather name="chevron-left" size={26} color={colors.primary} />
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
