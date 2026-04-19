import { Stack } from "expo-router";
import React from "react";
import colors from "@/constants/colors";

export default function AdminLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.cream },
        headerTintColor: colors.primary,
        headerTitleStyle: { fontFamily: "NotoSerif_700Bold" },
        contentStyle: { backgroundColor: colors.cream },
        headerBackTitle: "Back",
      }}
    >
      <Stack.Screen name="index" options={{ title: "Admin" }} />
      <Stack.Screen name="queue" options={{ title: "Moderation queue" }} />
      <Stack.Screen name="daily-word" options={{ title: "Today's Word" }} />
      <Stack.Screen name="official-guides" options={{ title: "Official guides" }} />
      <Stack.Screen name="users" options={{ title: "Users & roles" }} />
    </Stack>
  );
}
