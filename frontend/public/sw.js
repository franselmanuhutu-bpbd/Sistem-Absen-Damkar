/* Service Worker for Sistem Informasi Absensi DAMKAR Mimika */
self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let data = {};
  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data = { body: event.data.text() };
    }
  }

  const title = data.title || "DAMKAR MIMIKA — Notifikasi";
  const options = {
    body: data.body || "Pemberitahuan dari Sistem Informasi Absensi DAMKAR.",
    icon: data.icon || "/favicon.ico",
    badge: data.badge || "/favicon.ico",
    tag: data.tag || "damkar-notification",
    renotify: true,
    data: {
      url: data.url || "/laporan",
      timestamp: data.timestamp || Date.now(),
      ...(data.data || {}),
    },
    actions: data.actions || [
      { action: "open", title: "Buka Laporan" }
    ],
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  let targetUrl = (event.notification.data && event.notification.data.url) || "/laporan-export";
  if (typeof targetUrl !== "string" || !targetUrl.startsWith("/") || targetUrl.startsWith("//")) {
    targetUrl = "/laporan-export";
  }

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      // If a window is already open, focus it and navigate
      for (const client of clientList) {
        if ("focus" in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      // If no window is open, open a new one
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});
