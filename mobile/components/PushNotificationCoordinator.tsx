import * as Notifications from "expo-notifications";
import React, { useCallback, useEffect, useRef } from "react";
import { AppState, type AppStateStatus } from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import { getGetNotificationsQueryKey } from "@workspace/api-client-react";
import { useAuth } from "@/context/auth";
import { navigateFromNotificationData } from "@/lib/notificationNavigation";
import {
  registerAndSyncPushToken,
} from "@/lib/syncExpoPushToken";

/**
 * - Registers syncs when the app returns to foreground (e.g. user enabled alerts in Settings).
 * - Persists new Expo tokens when APNs/FCM rotates the device token.
 * - Handles cold-start and tap on remote notifications so `data` routes match the Alerts tab.
 */
export function PushNotificationCoordinator() {
  const { token, user } = useAuth();
  const queryClient = useQueryClient();
  const tokenRef = useRef(token);
  tokenRef.current = token;
  const userRoleRef = useRef(user?.role ?? null);
  userRoleRef.current = user?.role ?? null;
  const handledResponseId = useRef<string | null>(null);

  const handleNotificationResponse = useCallback(
    (response: Notifications.NotificationResponse | null | undefined) => {
      if (!response?.notification) return;
      const id = response.notification.request.identifier;
      if (handledResponseId.current === id) return;
      handledResponseId.current = id;
      const data = response.notification.request.content.data as Record<string, unknown>;
      void navigateFromNotificationData(data, {
        authToken: tokenRef.current,
        userRole: userRoleRef.current,
        deferUntilTabsReady: true,
      }).then(() => {
        queryClient.invalidateQueries({ queryKey: getGetNotificationsQueryKey() });
      });
    },
    [queryClient],
  );

  const replayColdStartNotification = useCallback(() => {
    void Notifications.getLastNotificationResponseAsync().then(handleNotificationResponse);
  }, [handleNotificationResponse]);

  useEffect(() => {
    let alive = true;

    void Notifications.getLastNotificationResponseAsync().then((response) => {
      if (!alive) return;
      handleNotificationResponse(response);
    });

    const subResponse = Notifications.addNotificationResponseReceivedListener(handleNotificationResponse);

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
      alive = false;
      subResponse.remove();
      subToken.remove();
      subIncoming.remove();
      subApp.remove();
    };
  }, [handleNotificationResponse, queryClient]);

  useEffect(() => {
    if (!token) return;
    void registerAndSyncPushToken(token);
    replayColdStartNotification();
  }, [token, replayColdStartNotification]);

  return null;
}
