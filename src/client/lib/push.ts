/**
 * Browser side of push notifications: the service worker in public/sw.js
 * shows them, and the Org agent stores each browser's subscription.
 */

export function pushSupported() {
  return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

export function registerServiceWorker() {
  return navigator.serviceWorker.register("/sw.js");
}

/** This browser's current subscription, if notifications are on here. */
export async function currentSubscription() {
  const registration = await navigator.serviceWorker.getRegistration();
  return (await registration?.pushManager.getSubscription()) ?? null;
}

/**
 * Asks for permission and subscribes with the deployment's key. A
 * subscription made with an older key (keys were regenerated) is replaced.
 */
export async function subscribe(publicKey: string) {
  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    throw new Error(
      permission === "denied"
        ? "Notifications are blocked for this site. Allow them in your browser's site settings, then try again."
        : "Notifications were not allowed.",
    );
  }
  const registration = await registerServiceWorker();
  await navigator.serviceWorker.ready;
  const key = fromBase64Url(publicKey);
  const existing = await registration.pushManager.getSubscription();
  if (existing && !sameKey(existing.options.applicationServerKey, key)) {
    await existing.unsubscribe();
  }
  const subscription = await registration.pushManager.subscribe({ applicationServerKey: key, userVisibleOnly: true });
  const json = subscription.toJSON();
  return { endpoint: subscription.endpoint, keys: { auth: json.keys?.auth ?? "", p256dh: json.keys?.p256dh ?? "" } };
}

function sameKey(current: ArrayBuffer | null, wanted: Uint8Array) {
  if (!current) {
    return false;
  }
  const bytes = new Uint8Array(current);
  return bytes.length === wanted.length && bytes.every((b, i) => b === wanted[i]);
}

function fromBase64Url(value: string) {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  return Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
}
