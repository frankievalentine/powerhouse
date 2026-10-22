// powerhouse service worker: shows push notifications from the Org agent
// (see Org.notifyPhase) and opens the job they are about when clicked. It
// caches nothing; the app is always loaded from the network.

self.addEventListener("push", (event) => {
  if (!event.data) {
    return;
  }
  const data = event.data.json();
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      data: { runId: data.runId },
      // The orb; Android shows the badge's shape alone in the status bar.
      icon: "/icon-192.png",
      badge: "/badge-96.png",
      // One notification per job, replaced as the job changes.
      tag: data.runId,
      renotify: true,
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const runId = event.notification.data?.runId;
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ includeUncontrolled: true, type: "window" });
      const open = windows.find((client) => new URL(client.url).origin === self.location.origin);
      if (open) {
        await open.focus();
        open.postMessage({ runId, type: "open-run" });
        return;
      }
      await self.clients.openWindow(runId ? `/?run=${encodeURIComponent(runId)}` : "/");
    })(),
  );
});
