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
import * as SystemUI from "expo-system-ui";
import React, { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { Text, TextInput } from "react-native";

import { AppAlertHost } from "@/components/AppAlert";
import { EntitlementGate } from "@/components/EntitlementGate";
import { PushNotificationCoordinator } from "@/components/PushNotificationCoordinator";
import { ensureAppBackgroundMediaPause } from "@/lib/mediaPlaybackCoordinator";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AuthProvider, useAuth } from "@/context/auth";
import { FeedNoticeProvider } from "@/context/feedNotice";
import { ModerationBadgeProvider } from "@/context/moderationBadge";
import { PendingDeepLinkProvider } from "@/context/pendingDeepLink";
import { RevenueCatProvider, useRevenueCat } from "@/context/revenuecat";
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
      refetchOnWindowFocus: false,
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
 * Hides the native splash once fonts, auth hydration, and RevenueCat account
 * linking are ready — avoids a second JS splash and logo size jump.
 */
function SplashHideGate({ fontsReady }: { fontsReady: boolean }) {
  const { loading: authLoading } = useAuth();
  const { isReady: rcReady, isCheckingSubscription } = useRevenueCat();

  useEffect(() => {
    if (!fontsReady || authLoading) return;
    if (!rcReady || isCheckingSubscription) return;
    void SplashScreen.hideAsync();
  }, [fontsReady, authLoading, rcReady, isCheckingSubscription]);

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
      <Stack.Screen name="(paywall)" options={{ headerShown: false, presentation: "modal" }} />
      <Stack.Screen name="onboarding" options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen
        name="post/new"
        options={{
          title: "Share a prayer",
          headerBackTitle: "Back",
          headerShown: true,
          gestureEnabled: true,
          fullScreenGestureEnabled: true,
        }}
      />
      <Stack.Screen
        name="post/[id]"
        options={{
          title: "Prayer",
          headerBackTitle: "Back",
          gestureEnabled: true,
          fullScreenGestureEnabled: true,
        }}
      />
      <Stack.Screen
        name="official/[id]"
        options={{
          title: "Official guide",
          headerBackTitle: "Back",
          gestureEnabled: true,
          fullScreenGestureEnabled: true,
        }}
      />
      <Stack.Screen
        name="path/[id]"
        options={{
          title: "Prayer Path",
          headerBackTitle: "Back",
          gestureEnabled: true,
          fullScreenGestureEnabled: true,
        }}
      />
      <Stack.Screen
        name="user/[username]"
        options={{
          title: "Profile",
          headerBackTitle: "Back",
          gestureEnabled: true,
          fullScreenGestureEnabled: true,
        }}
      />
      <Stack.Screen
        name="category/[name]"
        options={{
          title: "Category",
          headerBackTitle: "Back",
          gestureEnabled: true,
          fullScreenGestureEnabled: true,
        }}
      />
      <Stack.Screen
        name="settings"
        options={{
          title: "Settings",
          headerBackTitle: "Back",
          gestureEnabled: true,
          fullScreenGestureEnabled: true,
        }}
      />
    </Stack>
  );
}

export default function RootLayout() {
  useEffect(() => {
    void SystemUI.setBackgroundColorAsync(colors.cream);
    ensureAppBackgroundMediaPause();
  }, []);

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

  // Keep the native splash visible until fonts load — avoids a second smaller JS splash.
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
              <PendingDeepLinkProvider>
              <PushNotificationCoordinator />
              <FeedNoticeProvider>
                <ModerationBadgeProvider>
                  <RevenueCatProvider>
                    <SplashHideGate fontsReady={fontsReady} />
                    <KeyboardProvider>
                      <EntitlementGate>
                        <RootLayoutNav />
                      </EntitlementGate>
                    </KeyboardProvider>
                  </RevenueCatProvider>
                </ModerationBadgeProvider>
              </FeedNoticeProvider>
              </PendingDeepLinkProvider>
            </AuthProvider>
          </QueryClientProvider>
        </ErrorBoundary>
      </GestureHandlerRootView>
    </SafeAreaProvider>
  );
}
