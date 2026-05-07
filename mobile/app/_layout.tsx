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
import { PushNotificationCoordinator } from "@/components/PushNotificationCoordinator";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AuthProvider, useAuth } from "@/context/auth";
import { FeedNoticeProvider } from "@/context/feedNotice";
import { ModerationBadgeProvider } from "@/context/moderationBadge";
import { RevenueCatProvider } from "@/context/revenuecat";
import colors from "@/constants/colors";

setBaseUrl(getApiBaseUrl());

SplashScreen.preventAutoHideAsync();

(Text as any).defaultProps = {
  ...((Text as any).defaultProps ?? {}),
  allowFontScaling: true,
  maxFontSizeMultiplier: 1.28,
};
(TextInput as any).defaultProps = {
  ...((TextInput as any).defaultProps ?? {}),
  allowFontScaling: true,
  maxFontSizeMultiplier: 1.28,
};

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
      // Free cached data from memory after 2 minutes of disuse.
      // Default is 5 minutes; shorter GC time prevents the post cache from
      // growing unboundedly as the user browses and reduces heap pressure.
      gcTime: 2 * 60 * 1000,
      throwOnError: false,
    },
    mutations: { throwOnError: false },
  },
});

/**
 * Hides the native splash only after custom fonts are ready and auth has finished
 * hydrating from storage — avoids an intermediate blank/white frame before routes.
 */
function SplashHideGate({ fontsReady }: { fontsReady: boolean }) {
  const { loading: authRestoring } = useAuth();

  useEffect(() => {
    if (!fontsReady || authRestoring) return;
    void SplashScreen.hideAsync();
  }, [fontsReady, authRestoring]);

  return null;
}

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

  const fontsReady = fontsLoaded || fontError != null;

  if (!fontsReady) {
    return null;
  }

  return (
    <SafeAreaProvider>
      <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.cream }}>
        <AppAlertHost />
        <ErrorBoundary>
          <QueryClientProvider client={queryClient}>
            <AuthProvider>
              <SplashHideGate fontsReady={fontsReady} />
              <PushNotificationCoordinator />
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
