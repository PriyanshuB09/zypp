import { useMutation, useQuery } from "convex/react";
import { useEffect, useRef } from "react";

import { api } from "../../convex/_generated/api";

export function NotificationBridge() {
  const notifications = useQuery(api.notifications.list);
  const markDelivered = useMutation(api.notifications.markDelivered);
  const attempted = useRef(new Set<string>());

  useEffect(() => {
    if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
    for (const notification of notifications ?? []) {
      if (notification.deliveredAt || attempted.current.has(notification._id)) continue;
      attempted.current.add(notification._id);
      const nativeNotification = new Notification(notification.title, { body: notification.body, tag: notification.dedupeKey });
      nativeNotification.onclick = () => {
        window.focus();
        if (notification.taskId) window.location.assign(`/tasks/${notification.taskId}`);
      };
      void markDelivered({ notificationId: notification._id });
    }
  }, [markDelivered, notifications]);
  return null;
}
