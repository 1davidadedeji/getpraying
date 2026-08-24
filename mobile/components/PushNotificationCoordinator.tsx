import * as Linking from "expo-linking";
import * as Notifications from "expo-notifications";
import { usePathname, useSegments } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef } from "react";
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
import { subscribeAppActive } from "@/lib/appResume";
import {
  refreshPushRegistration,
} from "@/lib/syncExpoPushToken";
import { syncDeviceTimezone } from "@/lib/syncDeviceTimezone";
import { requestSanctuaryRefresh } from "@/lib/sanctuaryRefresh";

const PUSH_TOKEN_LISTENER_DEBOUNCE_MS = 1_500;

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
  const pushTokenListenerDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  const handleNotificationResponseRef = useRef(handleNotificationResponse);
  handleNotificationResponseRef.current = handleNotificationResponse;

  useEffect(() => {
    if (canNavigateNow && !prevCanNavigateNowRef.current) {
      flushPendingNotification();
    }
    prevCanNavigateNowRef.current = canNavigateNow;
  }, [canNavigateNow, flushPendingNotification]);

  useEffect(() => {
    if (!token) return;
    const timer = setTimeout(() => {
      void refreshPushRegistration(token);
    }, 2_500);
    return () => clearTimeout(timer);
  }, [token]);

  useEffect(() => {
    const subResponse = Notifications.addNotificationResponseReceivedListener((response) => {
      void handleNotificationResponse(response);
    });

    const subToken = Notifications.addPushTokenListener(() => {
      const jwt = tokenRef.current;
      if (!jwt) return;
      if (pushTokenListenerDebounceRef.current) {
        clearTimeout(pushTokenListenerDebounceRef.current);
      }
      pushTokenListenerDebounceRef.current = setTimeout(() => {
        pushTokenListenerDebounceRef.current = null;
        void refreshPushRegistration(jwt);
      }, PUSH_TOKEN_LISTENER_DEBOUNCE_MS);
    });

    const subIncoming = Notifications.addNotificationReceivedListener((notification) => {
      queryClient.invalidateQueries({ queryKey: getGetNotificationsQueryKey() });
      const rawType = notification.request.content.data?.type;
      const type = rawType != null ? String(rawType) : "";
      if (type === "morning_prayer" || type === "evening_prayer") {
        requestSanctuaryRefresh();
      }
    });

    const unsubResume = subscribeAppActive(() => {
      const jwt = tokenRef.current;
      if (!jwt) return;
      void syncDeviceTimezone(jwt);
      void refreshPushRegistration(jwt);
    }, 800);

    return () => {
      subResponse.remove();
      subToken.remove();
      subIncoming.remove();
      unsubResume();
      if (pushTokenListenerDebounceRef.current) {
        clearTimeout(pushTokenListenerDebounceRef.current);
        pushTokenListenerDebounceRef.current = null;
      }
    };
  }, [handleNotificationResponse, queryClient]);

  useEffect(() => {
    if (!token || coldStartCheckedRef.current) return;
    coldStartCheckedRef.current = true;

    void (async () => {
      const initialUrl = await Linking.getInitialURL();
      if (parseDeepLinkUrl(initialUrl)) {
        return;
      }

      const last = await Notifications.getLastNotificationResponseAsync();
      await handleNotificationResponseRef.current(last, { coldStart: true });
    })();
  }, [token]);

  return null;
}
