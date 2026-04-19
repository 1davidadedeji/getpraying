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
    />
  );
}
