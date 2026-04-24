import { Stack } from "expo-router";
import React from "react";
import colors from "@/constants/colors";

export default function AuthGroupLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.cream },
      }}
    >
      <Stack.Screen
        name="verify"
        options={{
          title: "Verify email",
          headerShown: false,
        }}
      />
    </Stack>
  );
}
