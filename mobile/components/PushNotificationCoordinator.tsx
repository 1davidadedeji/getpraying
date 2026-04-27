import * as Notifications from "expo-notifications";
import React, { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getGetNotificationsQueryKey } from "@workspace/api-client-react";
import { useAuth } from "@/context/auth";
import { navigateFromNotificationData } from "@/lib/notificationNavigation";

/**
 * Handles cold-start and tap on remote notifications so `data` routes match the in-app Alerts list.
 */
export function PushNotificationCoordinator() {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const tokenRef = useRef(token);
  tokenRef.current = token;

  useEffect(() => {
    let alive = true;

    void Notifications.getLastNotificationResponseAsync().then((response) => {
      if (!alive || !response?.notification) return;
      const data = response.notification.request.content.data as Record<string, unknown>;
      void navigateFromNotificationData(data, { authToken: tokenRef.current }).then(() => {
        queryClient.invalidateQueries({ queryKey: getGetNotificationsQueryKey() });
      });
    });

    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as Record<string, unknown>;
      void navigateFromNotificationData(data, { authToken: tokenRef.current }).then(() => {
        queryClient.invalidateQueries({ queryKey: getGetNotificationsQueryKey() });
      });
    });

    return () => {
      alive = false;
      sub.remove();
    };
  }, [queryClient]);

  return null;
}
