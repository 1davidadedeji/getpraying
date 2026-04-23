import "react-native-gesture-handler";

import {
  NotoSerif_400Regular,
  NotoSerif_600SemiBold,
  NotoSerif_700Bold,
} from "@expo-google-fonts/noto-serif";
import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  useFonts,
} from "@expo-google-fonts/plus-jakarta-sans";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { setBaseUrl } from "@workspace/api-client-react";
import { getApiBaseUrl } from "@/lib/apiBase";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { Text, TextInput } from "react-native";

import { AppAlertHost } from "@/components/AppAlert";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AuthProvider } from "@/context/auth";
import { FeedNoticeProvider } from "@/context/feedNotice";
import { ModerationBadgeProvider } from "@/context/moderationBadge";
import { RevenueCatProvider } from "@/context/revenuecat";
import colors from "@/constants/colors";

setBaseUrl(getApiBaseUrl());

SplashScreen.preventAutoHideAsync();

(Text as any).defaultProps = { ...((Text as any).defaultProps ?? {}), allowFontScaling: false };
(TextInput as any).defaultProps = {
  ...((TextInput as any).defaultProps ?? {}),
  allowFontScaling: false,
};

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30000, throwOnError: false },
    mutations: { throwOnError: false },
  },
});

function RootLayoutNav() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.cream },
        headerTintColor: colors.primary,
        headerTitleStyle: { fontFamily: "NotoSerif_700Bold" },
        contentStyle: { backgroundColor: colors.cream },
        animation: "slide_from_right",
      }}
    >
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="login" options={{ headerShown: false }} />
      <Stack.Screen name="register" options={{ headerShown: false }} />
      <Stack.Screen name="forgot-password" options={{ headerShown: false }} />
      <Stack.Screen name="reset-password" options={{ headerShown: false }} />
      <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      <Stack.Screen name="(paywall)" options={{ headerShown: false }} />
      <Stack.Screen name="onboarding" options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen
        name="post/new"
        options={{ title: "Share a prayer", headerBackTitle: "Back", headerShown: true }}
      />
      <Stack.Screen name="post/[id]" options={{ title: "Prayer", headerBackTitle: "Back" }} />
      <Stack.Screen name="official/[id]" options={{ title: "Official guide", headerBackTitle: "Back" }} />
      <Stack.Screen name="path/[id]" options={{ title: "Prayer Path", headerBackTitle: "Back" }} />
      <Stack.Screen name="user/[username]" options={{ title: "Profile", headerBackTitle: "Back" }} />
      <Stack.Screen name="category/[name]" options={{ title: "Category", headerBackTitle: "Back" }} />
      <Stack.Screen name="settings" options={{ title: "Settings", headerBackTitle: "Back" }} />
      <Stack.Screen name="admin" options={{ headerShown: false }} />
    </Stack>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    NotoSerif_400Regular,
    NotoSerif_600SemiBold,
    NotoSerif_700Bold,
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <AppAlertHost />
        <ErrorBoundary>
          <QueryClientProvider client={queryClient}>
            <AuthProvider>
              <FeedNoticeProvider>
                <ModerationBadgeProvider>
                  <RevenueCatProvider>
                    <KeyboardProvider>
                      <RootLayoutNav />
                    </KeyboardProvider>
                  </RevenueCatProvider>
                </ModerationBadgeProvider>
              </FeedNoticeProvider>
            </AuthProvider>
          </QueryClientProvider>
        </ErrorBoundary>
      </GestureHandlerRootView>
    </SafeAreaProvider>
  );
}
