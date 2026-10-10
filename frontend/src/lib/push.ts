import api from "./api";
import { isTauri } from "@tauri-apps/api/core";
import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from "@tauri-apps/plugin-notification";

const NATIVE_PUSH_ENABLED_KEY = "damkar.native-push-enabled";
const INITIAL_PUSH_PERMISSION_KEY = "damkar.initial-push-permission-requested";

export async function requestInitialPushPermission(): Promise<void> {
  if (typeof window === "undefined" || localStorage.getItem(INITIAL_PUSH_PERMISSION_KEY)) {
    return;
  }
  if (!isPushSupported()) {
    localStorage.setItem(INITIAL_PUSH_PERMISSION_KEY, "true");
    return;
  }

  try {
    await subscribeToPush();
  } catch (err) {
    console.warn("Initial notification permission request failed:", err);
  } finally {
    localStorage.setItem(INITIAL_PUSH_PERMISSION_KEY, "true");
  }
}

export function isNativePushRuntime(): boolean {
  return isTauri();
}

export function isNativePushEnabled(): boolean {
  return isNativePushRuntime() && localStorage.getItem(NATIVE_PUSH_ENABLED_KEY) === "true";
}

export async function subscribeToNativePush(): Promise<{ success: boolean; error?: string }> {
  try {
    let permissionGranted = await isPermissionGranted();
    if (!permissionGranted) {
      permissionGranted = (await requestPermission()) === "granted";
    }
    if (!permissionGranted) {
      return { success: false, error: "Izin notifikasi tidak diberikan." };
    }
    localStorage.setItem(NATIVE_PUSH_ENABLED_KEY, "true");
    return { success: true };
  } catch (err: any) {
    console.error("Failed to enable native notifications:", err);
    return { success: false, error: err?.message || "Gagal mengaktifkan notifikasi." };
  }
}

export function unsubscribeFromNativePush(): { success: boolean } {
  localStorage.removeItem(NATIVE_PUSH_ENABLED_KEY);
  return { success: true };
}

export async function sendNativePushNotification(title: string, body: string): Promise<void> {
  if (isNativePushEnabled()) {
    await sendNotification({ title, body });
  }
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function isPushSupported(): boolean {
  if (isNativePushRuntime()) return true;
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

export function getNotificationPermission(): NotificationPermission {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return "denied";
  }
  return Notification.permission;
}

export async function getExistingSubscription(): Promise<PushSubscription | null> {
  if (isNativePushRuntime()) return null;
  if (!isPushSupported()) return null;
  try {
    const registration = await navigator.serviceWorker.getRegistration("/sw.js");
    if (!registration) return null;
    return await registration.pushManager.getSubscription();
  } catch (err) {
    console.warn("Error getting push subscription:", err);
    return null;
  }
}

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!isPushSupported()) return null;
  try {
    return await navigator.serviceWorker.register("/sw.js", { scope: "/" });
  } catch (err) {
    console.error("Service Worker registration failed:", err);
    return null;
  }
}

export async function subscribeToPush(): Promise<{ success: boolean; subscription?: PushSubscription; error?: string }> {
  if (isNativePushRuntime()) {
    return subscribeToNativePush();
  }
  if (!isPushSupported()) {
    return { success: false, error: "Browser Anda tidak mendukung Web Push Notifications." };
  }

  // Request browser permission
  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    return {
      success: false,
      error: permission === "denied"
        ? "Izin notifikasi diblokir di browser. Mohon izinkan notifikasi di pengaturan situs."
        : "Izin notifikasi tidak diberikan.",
    };
  }

  try {
    // Ensure service worker is registered & ready
    await registerServiceWorker();
    const registration = await navigator.serviceWorker.ready;

    // Fetch VAPID Public Key from backend
    const vapidRes = await api.get("/notifications/vapid-public-key");
    const publicKey = vapidRes.data?.publicKey;

    if (!publicKey) {
      return { success: false, error: "Kunci VAPID belum dikonfigurasi di server backend." };
    }

    const applicationServerKey = urlBase64ToUint8Array(publicKey);

    // Clean up any existing stale subscription first
    const existingSub = await registration.pushManager.getSubscription();
    if (existingSub) {
      try {
        await existingSub.unsubscribe();
      } catch (e) {
        console.warn("Could not unsubscribe previous subscription:", e);
      }
    }

    // Subscribe to PushManager
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: applicationServerKey as unknown as BufferSource,
    });

    const subJson = subscription.toJSON();
    const endpoint = subJson.endpoint;
    const p256dh = subJson.keys?.p256dh;
    const auth = subJson.keys?.auth;

    if (!endpoint || !p256dh || !auth) {
      return { success: false, error: "Gagal mengekstrak kunci subscription dari browser." };
    }

    // Save to backend
    await api.post("/notifications/subscribe", {
      endpoint,
      keys: { p256dh, auth },
      user_agent: navigator.userAgent,
    });

    return { success: true, subscription };
  } catch (err: any) {
    console.error("Failed to subscribe to Web Push:", err);
    return {
      success: false,
      error: err?.response?.data?.detail || err?.message || "Gagal mengaktifkan notifikasi Web Push.",
    };
  }
}

export async function unsubscribeFromPush(): Promise<{ success: boolean; error?: string }> {
  if (isNativePushRuntime()) {
    return unsubscribeFromNativePush();
  }
  if (!isPushSupported()) return { success: true };
  try {
    const registration = await navigator.serviceWorker.getRegistration("/sw.js");
    if (registration) {
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        const endpoint = subscription.endpoint;
        await subscription.unsubscribe();
        try {
          await api.post("/notifications/unsubscribe", { endpoint });
        } catch (e) {
          // Ignore backend delete failure
        }
      }
    }
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || "Gagal menonaktifkan notifikasi." };
  }
}
