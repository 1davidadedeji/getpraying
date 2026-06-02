import * as Linking from "expo-linking";
import * as Notifications from "expo-notifications";
import { usePathname, useSegments } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef } from "react";
import { AppState, type AppStateStatus } from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import { getGetNotificationsQueryKey } from "@workspace/api-client-react";
import { useAuth } from "@/context/auth";
import { useRevenueCat } from "@/context/revenuecat";
import {
  entitlementGateIsLoading,
  userNeedsEntitlementGate,
} from "@/lib/entitlementGate";
import { navigateFromNotificationData } from "@/lib/notificationNavigation";
import { parseDeepLinkUrl } from "@/lib/parseDeepLink";
import { claimNotificationResponseId } from "@/lib/pushNotificationDedup";
import { registerAndSyncPushToken } from "@/lib/syncExpoPushToken";

/**
 * - Registers syncs when the app returns to foreground.
 * - Handles notification taps (foreground, background, and cold start).
 */
export function PushNotificationCoordinator() {
  const { token, user } = useAuth();
  const rc = useRevenueCat();
  const pathname = usePathname();
  const segments = useSegments();
  const queryClient = useQueryClient();

  const tokenRef = useRef(token);
  tokenRef.current = token;
  const userRoleRef = useRef(user?.role ?? null);
  userRoleRef.current = user?.role ?? null;
  const pathnameRef = useRef(pathname);
  pathnameRef.current = pathname;

  /** Prevents duplicate handling when cold-start and listener fire together. */
  const inflightResponseIds = useRef(new Set<string>());
  const coldStartCheckedRef = useRef(false);

  const canApplyDeferredNow = useMemo(() => {
    if (!user?.isEmailVerified) return false;
    if (entitlementGateIsLoading(user, rc, pathname, segments)) return false;
    if (userNeedsEntitlementGate(user, rc, pathname, segments)) return false;
    return true;
  }, [user, rc, pathname, segments]);

  const canApplyDeferredNowRef = useRef(canApplyDeferredNow);
  canApplyDeferredNowRef.current = canApplyDeferredNow;

  const handleNotificationResponse = useCallback(
    async (
      response: Notifications.NotificationResponse | null | undefined,
      opts?: { persistDedup?: boolean },
    ) => {
      if (!response?.notification) return;
      const id = response.notification.request.identifier;
      if (!id) return;

      if (inflightResponseIds.current.has(id)) return;
      inflightResponseIds.current.add(id);
      setTimeout(() => inflightResponseIds.current.delete(id), 3000);

      if (opts?.persistDedup) {
        const claimed = await claimNotificationResponseId(id);
        if (!claimed) return;
      }

      const data = response.notification.request.content.data as Record<string, unknown>;
      const applyPath = pathnameRef.current;

      await navigateFromNotificationData(data, {
        authToken: tokenRef.current,
        userRole: userRoleRef.current,
        deferUntilEntitled: true,
        applyNowPathname: canApplyDeferredNowRef.current ? applyPath : undefined,
      });

      queryClient.invalidateQueries({ queryKey: getGetNotificationsQueryKey() });
    },
    [queryClient],
  );

  useEffect(() => {
    const subResponse = Notifications.addNotificationResponseReceivedListener((response) => {
      void handleNotificationResponse(response);
    });

    const subToken = Notifications.addPushTokenListener(() => {
      const jwt = tokenRef.current;
      if (!jwt) return;
      void registerAndSyncPushToken(jwt);
    });

    const subIncoming = Notifications.addNotificationReceivedListener(() => {
      queryClient.invalidateQueries({ queryKey: getGetNotificationsQueryKey() });
    });

    const onAppState = (state: AppStateStatus) => {
      if (state !== "active") return;
      const jwt = tokenRef.current;
      if (!jwt) return;
      void registerAndSyncPushToken(jwt);
    };
    const subApp = AppState.addEventListener("change", onAppState);

    return () => {
      subResponse.remove();
      subToken.remove();
      subIncoming.remove();
      subApp.remove();
    };
  }, [handleNotificationResponse, queryClient]);

  useEffect(() => {
    if (!token || coldStartCheckedRef.current) return;

    void (async () => {
      coldStartCheckedRef.current = true;
      await registerAndSyncPushToken(token);

      const initialUrl = await Linking.getInitialURL();
      if (parseDeepLinkUrl(initialUrl)) {
        return;
      }

      const last = await Notifications.getLastNotificationResponseAsync();
      await handleNotificationResponse(last, { persistDedup: true });
    })();
  }, [token, handleNotificationResponse]);

  return null;
}
