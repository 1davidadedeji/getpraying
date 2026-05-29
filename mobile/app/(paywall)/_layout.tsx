import { Stack } from "expo-router";
import React from "react";
import colors from "@/constants/colors";

export default function PaywallLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        presentation: "modal",
        contentStyle: { backgroundColor: colors.cream },
      }}
    />
  );
}
