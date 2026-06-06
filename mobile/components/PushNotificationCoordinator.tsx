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
import {
  applyNotificationHref,
  consumePendingNotificationHref,
  navigateFromNotificationData,
  peekPendingNotificationHref,
} from "@/lib/notificationNavigation";
import { parseDeepLinkUrl } from "@/lib/parseDeepLink";
import {
  claimNotificationResponseId,
  claimNotificationResponseInSession,
} from "@/lib/pushNotificationDedup";
import {
  enrichNotificationPayload,
  normalizeNotificationPayload,
} from "@/lib/notificationPayload";
import { scheduleOnAppActive } from "@/lib/appResume";
import { registerAndSyncPushToken } from "@/lib/syncExpoPushToken";

/**
 * Registers push tokens and routes notification taps (foreground, background, cold start).
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

  const coldStartCheckedRef = useRef(false);

  const canNavigateNow = useMemo(() => {
    if (!user?.isEmailVerified) return false;
    if (entitlementGateIsLoading(user, rc, pathname, segments)) return false;
    if (userNeedsEntitlementGate(user, rc, pathname, segments)) return false;
    return true;
  }, [user, rc, pathname, segments]);

  const canNavigateNowRef = useRef(canNavigateNow);
  canNavigateNowRef.current = canNavigateNow;
  const prevCanNavigateNowRef = useRef(false);

  const flushPendingNotification = useCallback(() => {
    const href = consumePendingNotificationHref();
    if (!href) return;
    applyNotificationHref(href, pathnameRef.current);
  }, []);

  const dispatchNotification = useCallback(
    async (response: Notifications.NotificationResponse) => {
      const raw = response.notification.request.content.data;
      const normalized = normalizeNotificationPayload(raw);
      const data = await enrichNotificationPayload(normalized, tokenRef.current);

      navigateFromNotificationData(data, {
        authToken: tokenRef.current,
        userRole: userRoleRef.current,
        deferUntilEntitled: true,
        applyNowPathname: canNavigateNowRef.current ? pathnameRef.current : undefined,
      });

      if (!canNavigateNowRef.current && peekPendingNotificationHref()) {
        /* EntitlementGate will consume when the gate opens. */
      }

      queryClient.invalidateQueries({ queryKey: getGetNotificationsQueryKey() });
    },
    [queryClient],
  );

  const handleNotificationResponse = useCallback(
    async (
      response: Notifications.NotificationResponse | null | undefined,
      opts?: { coldStart?: boolean },
    ) => {
      if (!response?.notification) return;

      const id = response.notification.request.identifier;
      if (!id) return;

      const claimed = opts?.coldStart
        ? await claimNotificationResponseId(id)
        : claimNotificationResponseInSession(id);
      if (!claimed) return;

      await dispatchNotification(response);
    },
    [dispatchNotification],
  );

  useEffect(() => {
    if (canNavigateNow && !prevCanNavigateNowRef.current) {
      flushPendingNotification();
    }
    prevCanNavigateNowRef.current = canNavigateNow;
  }, [canNavigateNow, flushPendingNotification]);

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
      scheduleOnAppActive(() => void registerAndSyncPushToken(jwt), 600);
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
      void registerAndSyncPushToken(token);

      const initialUrl = await Linking.getInitialURL();
      if (parseDeepLinkUrl(initialUrl)) {
        return;
      }

      const last = await Notifications.getLastNotificationResponseAsync();
      await handleNotificationResponse(last, { coldStart: true });
    })();
  }, [token, handleNotificationResponse]);

  return null;
}
