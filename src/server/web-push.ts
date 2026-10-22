/**
 * Web Push with WebCrypto alone: message encryption (RFC 8291, aes128gcm)
 * and VAPID authentication (RFC 8292). The `web-push` package is written for
 * Node and sends through its `https` module; this needs nothing beyond what
 * Workers provide.
 */

/** Bytes backed by a plain ArrayBuffer, which is what WebCrypto and fetch accept. */
type Bytes = Uint8Array<ArrayBuffer>;

/** A browser's push subscription, as PushSubscription.toJSON() gives it. */
export interface PushSubscriptionJSON {
  endpoint: string;
  keys: { auth: string; p256dh: string };
}

export interface VapidKeys {
  /** Uncompressed P-256 public key, base64url (65 bytes). */
  publicKey: string;
  /** P-256 private scalar, base64url (32 bytes). */
  privateKey: string;
  /** A mailto: or https: URL push services can use to reach the sender. */
  subject: string;
}

export interface PushOptions {
  /** Seconds the push service keeps the message for an offline browser. */
  ttl: number;
  urgency?: "very-low" | "low" | "normal" | "high";
  /** A newer message with the same topic replaces an undelivered one. Up to 32 base64url characters. */
  topic?: string;
}

export type PushResult = { ok: true } | { ok: false; status: number; gone: boolean };

/**
 * Browser push services. A subscription is a URL the Org will POST to, so
 * any other host is refused: a member could otherwise point it anywhere.
 */
const PUSH_HOSTS = [/^fcm\.googleapis\.com$/, /\.push\.services\.mozilla\.com$/, /\.notify\.windows\.com$/, /^web\.push\.apple\.com$/];

export function pushEndpoint(value: unknown) {
  try {
    const url = new URL(String(value));
    return url.protocol === "https:" && PUSH_HOSTS.some((host) => host.test(url.hostname)) ? url.toString() : null;
  } catch {
    return null;
  }
}

/** A base64url subscription key of the given decoded length. */
export function validKey(value: unknown, bytes: number) {
  return typeof value === "string" && /^[A-Za-z0-9_-]+$/.test(value) && Math.floor((value.length * 3) / 4) === bytes;
}

const RECORD_SIZE = 4096;
const encoder = new TextEncoder();

/** Encrypts and sends one message; `gone` means the subscription is dead and should be dropped. */
export async function sendPush(
  subscription: PushSubscriptionJSON,
  payload: string,
  vapid: VapidKeys,
  options: PushOptions,
): Promise<PushResult> {
  const body = await encryptPayload(subscription, encoder.encode(payload));
  const token = await vapidToken(new URL(subscription.endpoint).origin, vapid);
  const response = await fetch(subscription.endpoint, {
    body,
    headers: {
      Authorization: `vapid t=${token}, k=${vapid.publicKey}`,
      "Content-Encoding": "aes128gcm",
      "Content-Type": "application/octet-stream",
      TTL: String(options.ttl),
      ...(options.urgency ? { Urgency: options.urgency } : {}),
      ...(options.topic ? { Topic: options.topic } : {}),
    },
    method: "POST",
    // A push service answers itself; a redirect could send the request anywhere.
    redirect: "manual",
  });
  if (response.ok) {
    return { ok: true };
  }
  // 404 and 410: the browser unsubscribed or the subscription expired.
  return { gone: response.status === 404 || response.status === 410, ok: false, status: response.status };
}

/**
 * The aes128gcm body for one record: salt, record size, the sender's
 * ephemeral public key, then the ciphertext. `fixed` replaces the random
 * salt and key pair, for testing against the RFC's example.
 */
export async function encryptPayload(
  subscription: PushSubscriptionJSON,
  plaintext: Bytes,
  fixed?: { salt: Bytes; senderPrivateKey: string; senderPublicKey: string },
): Promise<Bytes> {
  const uaPublic = fromBase64Url(subscription.keys.p256dh);
  const authSecret = fromBase64Url(subscription.keys.auth);
  const salt = fixed?.salt ?? crypto.getRandomValues(new Uint8Array(16));

  const sender = fixed
    ? { privateKey: await importPrivateKey(fixed.senderPrivateKey, fixed.senderPublicKey, "ECDH"), publicRaw: fromBase64Url(fixed.senderPublicKey) }
    : await ephemeralKeyPair();
  const receiver = await crypto.subtle.importKey("raw", uaPublic, { name: "ECDH", namedCurve: "P-256" }, false, []);
  const ecdhSecret = new Uint8Array(
    await crypto.subtle.deriveBits({ name: "ECDH", public: receiver }, sender.privateKey, 256),
  );

  // RFC 8291 section 3.4: combine the ECDH secret with the auth secret.
  const prkKey = await hmac(authSecret, ecdhSecret);
  const keyInfo = concat(encoder.encode("WebPush: info\0"), uaPublic, sender.publicRaw);
  const ikm = await hmac(prkKey, concat(keyInfo, Uint8Array.of(1)));
  // RFC 8188: content encryption key and nonce from the salt.
  const prk = await hmac(salt, ikm);
  const cek = (await hmac(prk, concat(encoder.encode("Content-Encoding: aes128gcm\0"), Uint8Array.of(1)))).slice(0, 16);
  const nonce = (await hmac(prk, concat(encoder.encode("Content-Encoding: nonce\0"), Uint8Array.of(1)))).slice(0, 12);

  // One record, ending with the last-record delimiter.
  const record = concat(plaintext, Uint8Array.of(2));
  if (record.length + 16 > RECORD_SIZE) {
    throw new Error(`Push payload too large: ${plaintext.length} bytes`);
  }
  const aesKey = await crypto.subtle.importKey("raw", cek, "AES-GCM", false, ["encrypt"]);
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ iv: nonce, name: "AES-GCM" }, aesKey, record));

  const header = new Uint8Array(16 + 4 + 1 + sender.publicRaw.length);
  header.set(salt, 0);
  new DataView(header.buffer).setUint32(16, RECORD_SIZE);
  header[20] = sender.publicRaw.length;
  header.set(sender.publicRaw, 21);
  return concat(header, ciphertext);
}

/** RFC 8292: an ES256 JWT for the push service's origin, valid for 12 hours. */
export async function vapidToken(audience: string, vapid: VapidKeys, nowMs = Date.now()) {
  const header = toBase64Url(encoder.encode(JSON.stringify({ alg: "ES256", typ: "JWT" })));
  const claims = toBase64Url(
    encoder.encode(JSON.stringify({ aud: audience, exp: Math.floor(nowMs / 1000) + 12 * 3600, sub: vapid.subject })),
  );
  const key = await importPrivateKey(vapid.privateKey, vapid.publicKey, "ECDSA");
  // WebCrypto returns the raw r||s signature JWS expects.
  const signature = await crypto.subtle.sign({ hash: "SHA-256", name: "ECDSA" }, key, encoder.encode(`${header}.${claims}`));
  return `${header}.${claims}.${toBase64Url(new Uint8Array(signature))}`;
}

async function ephemeralKeyPair() {
  const pair = (await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"])) as CryptoKeyPair;
  return { privateKey: pair.privateKey, publicRaw: new Uint8Array((await crypto.subtle.exportKey("raw", pair.publicKey)) as ArrayBuffer) };
}

/** A P-256 private key from its raw scalar and uncompressed public key. */
function importPrivateKey(privateKey: string, publicKey: string, algorithm: "ECDH" | "ECDSA") {
  const pub = fromBase64Url(publicKey);
  const jwk: JsonWebKey = {
    crv: "P-256",
    d: privateKey,
    ext: true,
    kty: "EC",
    x: toBase64Url(pub.slice(1, 33)),
    y: toBase64Url(pub.slice(33, 65)),
  };
  return crypto.subtle.importKey(
    "jwk",
    jwk,
    { name: algorithm, namedCurve: "P-256" },
    false,
    algorithm === "ECDH" ? ["deriveBits"] : ["sign"],
  );
}

async function hmac(key: Bytes, data: Bytes) {
  const hmacKey = await crypto.subtle.importKey("raw", key, { hash: "SHA-256", name: "HMAC" }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", hmacKey, data));
}

function concat(...parts: Uint8Array[]): Bytes {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

export function toBase64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function fromBase64Url(value: string): Bytes {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  return Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
}
