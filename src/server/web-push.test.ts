import { describe, expect, test } from "bun:test";
import { encryptPayload, fromBase64Url, toBase64Url, vapidToken } from "./web-push";

// RFC 8291 section 5 and appendix A.
const RFC = {
  auth: "BTBZMqHH6r4Tts7J_aSIgg",
  body:
    "DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27ml" +
    "mlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A_yl95bQpu6cVPT" +
    "pK4Mqgkf1CXztLVBSt2Ks3oZwbuwXPXLWyouBWLVWGNWQexSgSxsj_Qulcy4a-fN",
  plaintext: "When I grow up, I want to be a watermelon",
  receiverPublic: "BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4",
  salt: "DGv6ra1nlYgDCS1FRnbzlw",
  senderPrivate: "yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw",
  senderPublic: "BP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8",
};

describe("encryptPayload", () => {
  test("matches the RFC 8291 example byte for byte", async () => {
    const body = await encryptPayload(
      { endpoint: "https://push.example.net/push/x", keys: { auth: RFC.auth, p256dh: RFC.receiverPublic } },
      new TextEncoder().encode(RFC.plaintext),
      { salt: fromBase64Url(RFC.salt), senderPrivateKey: RFC.senderPrivate, senderPublicKey: RFC.senderPublic },
    );
    expect(toBase64Url(body)).toBe(RFC.body);
  });

  test("uses a fresh salt and key each time", async () => {
    const subscription = { endpoint: "https://push.example.net/push/x", keys: { auth: RFC.auth, p256dh: RFC.receiverPublic } };
    const a = await encryptPayload(subscription, new TextEncoder().encode("hi"));
    const b = await encryptPayload(subscription, new TextEncoder().encode("hi"));
    expect(toBase64Url(a)).not.toBe(toBase64Url(b));
    // Header: 16 salt + 4 record size + 1 key length + 65 key; then 2 + 1 + 16 bytes of ciphertext.
    expect(a.length).toBe(86 + 3 + 16);
  });

  test("refuses a payload larger than one record", async () => {
    const subscription = { endpoint: "https://push.example.net/push/x", keys: { auth: RFC.auth, p256dh: RFC.receiverPublic } };
    await expect(encryptPayload(subscription, new Uint8Array(5000))).rejects.toThrow("too large");
  });
});

describe("vapidToken", () => {
  test("is an ES256 JWT for the push origin that verifies with the public key", async () => {
    const vapid = { privateKey: RFC.senderPrivate, publicKey: RFC.senderPublic, subject: "https://powerhouse.example" };
    const now = Date.parse("2026-10-21T12:00:00Z");
    const token = await vapidToken("https://fcm.googleapis.com", vapid, now);
    const [header, claims, signature] = token.split(".") as [string, string, string];
    expect(JSON.parse(new TextDecoder().decode(fromBase64Url(header)))).toEqual({ alg: "ES256", typ: "JWT" });
    expect(JSON.parse(new TextDecoder().decode(fromBase64Url(claims)))).toEqual({
      aud: "https://fcm.googleapis.com",
      exp: now / 1000 + 12 * 3600,
      sub: "https://powerhouse.example",
    });
    const key = await crypto.subtle.importKey("raw", fromBase64Url(RFC.senderPublic), { name: "ECDSA", namedCurve: "P-256" }, false, [
      "verify",
    ]);
    const valid = await crypto.subtle.verify(
      { hash: "SHA-256", name: "ECDSA" },
      key,
      fromBase64Url(signature),
      new TextEncoder().encode(`${header}.${claims}`),
    );
    expect(valid).toBe(true);
  });
});

describe("subscription checks", () => {
  test("only browser push services are accepted as endpoints", async () => {
    const { pushEndpoint } = await import("./web-push");
    expect(pushEndpoint("https://fcm.googleapis.com/fcm/send/abc")).toBe("https://fcm.googleapis.com/fcm/send/abc");
    expect(pushEndpoint("https://updates.push.services.mozilla.com/wpush/v2/x")).not.toBeNull();
    expect(pushEndpoint("https://wns2-par02p.notify.windows.com/w/?token=x")).not.toBeNull();
    expect(pushEndpoint("https://web.push.apple.com/abc")).not.toBeNull();
    expect(pushEndpoint("https://evil.example/fcm.googleapis.com")).toBeNull();
    expect(pushEndpoint("https://fcm.googleapis.com.evil.example/x")).toBeNull();
    expect(pushEndpoint("http://fcm.googleapis.com/x")).toBeNull();
    expect(pushEndpoint("not a url")).toBeNull();
  });

  test("keys must decode to the right length", async () => {
    const { validKey } = await import("./web-push");
    expect(validKey(RFC.receiverPublic, 65)).toBe(true);
    expect(validKey(RFC.auth, 16)).toBe(true);
    expect(validKey(RFC.auth, 65)).toBe(false);
    expect(validKey("not/base64+", 16)).toBe(false);
    expect(validKey(42, 16)).toBe(false);
  });
});
