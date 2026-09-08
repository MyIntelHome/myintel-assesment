const CHECKOUT_SESSIONS_URL = "https://api.stripe.com/v1/checkout/sessions";
const WEBHOOK_TOLERANCE_SECONDS = 300;

const encoder = new TextEncoder();

export interface CreateCheckoutOptions {
  secretKey: string;
  requestId: string;
  quoteVersion: string;
  amountCents: number;
  currency: "usd";
  origin: string;
  customerEmail?: string;
}

export interface CheckoutSessionReference {
  id: string;
  url: string;
}

export interface VerifiedStripeEvent {
  id: string;
  type: string;
  data: {
    object: {
      id: string;
      payment_status: string;
      amount_total: number;
      currency: string;
      metadata: Record<string, string>;
    };
  };
}

function requireNonEmpty(value: string, name: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`${name} is required`);
  }
  return value;
}

function normalizedOrigin(origin: string): string {
  requireNonEmpty(origin, "origin");
  let url: URL;
  try {
    url = new URL(origin);
  } catch {
    throw new Error("origin must be an absolute HTTP(S) URL");
  }
  if ((url.protocol !== "https:" && url.protocol !== "http:") || url.origin === "null") {
    throw new Error("origin must be an absolute HTTP(S) URL");
  }
  if (url.pathname !== "/" || url.search || url.hash || url.username || url.password) {
    throw new Error("origin must contain only scheme, host, and optional port");
  }
  return url.origin;
}

/**
 * Creates a hosted, one-time Stripe Checkout Session. The caller must load the
 * amount from trusted server-side quote data; never forward a client amount.
 */
export async function createCheckout({
  secretKey,
  requestId,
  quoteVersion,
  amountCents,
  currency,
  origin,
  customerEmail,
}: CreateCheckoutOptions): Promise<CheckoutSessionReference> {
  requireNonEmpty(secretKey, "secretKey");
  requireNonEmpty(requestId, "requestId");
  requireNonEmpty(quoteVersion, "quoteVersion");
  if (!Number.isSafeInteger(amountCents) || amountCents <= 0) {
    throw new Error("amountCents must be a positive safe integer");
  }
  if (currency !== "usd") {
    throw new Error("currency must be usd");
  }
  if (customerEmail !== undefined) {
    requireNonEmpty(customerEmail, "customerEmail");
  }

  const siteOrigin = normalizedOrigin(origin);
  const idempotencyKey = `${requestId}:${quoteVersion}`;
  if (idempotencyKey.length > 255) {
    throw new Error("requestId and quoteVersion produce an oversized idempotency key");
  }

  const body = new URLSearchParams({
    mode: "payment",
    success_url: `${siteOrigin}/?view=requests&checkout=returned`,
    cancel_url: `${siteOrigin}/?view=requests`,
    "line_items[0][price_data][currency]": currency,
    "line_items[0][price_data][product_data][name]": "MyIntel professional service",
    "line_items[0][price_data][unit_amount]": String(amountCents),
    "line_items[0][quantity]": "1",
    "metadata[requestId]": requestId,
    "metadata[quoteVersion]": quoteVersion,
    "payment_intent_data[metadata][requestId]": requestId,
    "payment_intent_data[metadata][quoteVersion]": quoteVersion,
  });
  if (customerEmail !== undefined) {
    body.set("customer_email", customerEmail);
  }

  const response = await fetch(CHECKOUT_SESSIONS_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "Idempotency-Key": idempotencyKey,
    },
    body,
  });

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new Error(`Stripe Checkout request failed (${response.status})`);
  }
  if (!response.ok) {
    const message = getStripeErrorMessage(payload);
    throw new Error(
      message
        ? `Stripe Checkout request failed (${response.status}): ${message}`
        : `Stripe Checkout request failed (${response.status})`,
    );
  }
  if (!isRecord(payload) || typeof payload.id !== "string" || typeof payload.url !== "string") {
    throw new Error("Stripe Checkout returned an invalid session");
  }
  return { id: payload.id, url: payload.url };
}

function getStripeErrorMessage(payload: unknown): string | undefined {
  if (!isRecord(payload) || !isRecord(payload.error) || typeof payload.error.message !== "string") {
    return undefined;
  }
  return payload.error.message;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseSignatureHeader(
  signature: string,
): { timestamp: number; signatures: Uint8Array<ArrayBuffer>[] } {
  requireNonEmpty(signature, "signature");
  let timestampText: string | undefined;
  const signatures: Uint8Array<ArrayBuffer>[] = [];

  for (const part of signature.split(",")) {
    const separator = part.indexOf("=");
    if (separator <= 0) continue;
    const key = part.slice(0, separator).trim();
    const value = part.slice(separator + 1).trim();
    if (key === "t" && timestampText === undefined) timestampText = value;
    if (key === "v1" && /^[0-9a-fA-F]{64}$/.test(value)) {
      signatures.push(hexToBytes(value));
    }
  }

  if (timestampText === undefined || !/^\d+$/.test(timestampText) || signatures.length === 0) {
    throw new Error("Malformed Stripe-Signature header");
  }
  const timestamp = Number(timestampText);
  if (!Number.isSafeInteger(timestamp) || timestamp <= 0) {
    throw new Error("Malformed Stripe-Signature timestamp");
  }
  return { timestamp, signatures };
}

function hexToBytes(hex: string): Uint8Array<ArrayBuffer> {
  const result = new Uint8Array(hex.length / 2);
  for (let i = 0; i < result.length; i += 1) {
    result[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return result;
}

function rawBodyBytes(raw: string | Uint8Array | ArrayBuffer): Uint8Array<ArrayBuffer> {
  if (typeof raw === "string") return encoder.encode(raw);
  if (raw instanceof Uint8Array) return Uint8Array.from(raw);
  if (raw instanceof ArrayBuffer) return new Uint8Array(raw);
  throw new Error("raw webhook body is required");
}

function joinSignedPayload(timestamp: number, raw: Uint8Array): Uint8Array<ArrayBuffer> {
  const prefix = encoder.encode(`${timestamp}.`);
  const signed = new Uint8Array(prefix.length + raw.length);
  signed.set(prefix);
  signed.set(raw, prefix.length);
  return signed;
}

/**
 * Verifies Stripe's v1 HMAC-SHA256 signature against the untouched request body.
 * Web Crypto's verify operation performs the signature comparison without a
 * JavaScript string equality check.
 */
export async function verifyStripeEvent(
  raw: string | Uint8Array | ArrayBuffer,
  signature: string,
  secret: string,
  nowSeconds = Math.floor(Date.now() / 1000),
): Promise<VerifiedStripeEvent> {
  requireNonEmpty(secret, "secret");
  if (!Number.isSafeInteger(nowSeconds) || nowSeconds <= 0) {
    throw new Error("nowSeconds must be a positive integer");
  }

  const bodyBytes = rawBodyBytes(raw);
  const { timestamp, signatures } = parseSignatureHeader(signature);
  if (Math.abs(nowSeconds - timestamp) > WEBHOOK_TOLERANCE_SECONDS) {
    throw new Error("Stripe webhook timestamp is outside the allowed tolerance");
  }

  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"],
  );
  const signedPayload = joinSignedPayload(timestamp, bodyBytes);
  let verified = false;
  for (const candidate of signatures) {
    if (await crypto.subtle.verify("HMAC", key, candidate, signedPayload)) {
      verified = true;
    }
  }
  if (!verified) throw new Error("Invalid Stripe webhook signature");

  let payload: unknown;
  try {
    payload = JSON.parse(new TextDecoder().decode(bodyBytes));
  } catch {
    throw new Error("Invalid Stripe webhook JSON");
  }
  return narrowVerifiedEvent(payload);
}

function narrowVerifiedEvent(payload: unknown): VerifiedStripeEvent {
  if (!isRecord(payload) || typeof payload.id !== "string" || typeof payload.type !== "string") {
    throw new Error("Invalid Stripe event envelope");
  }
  if (!isRecord(payload.data) || !isRecord(payload.data.object)) {
    throw new Error("Invalid Stripe event data");
  }
  const object = payload.data.object;
  if (
    typeof object.id !== "string" ||
    typeof object.payment_status !== "string" ||
    !Number.isSafeInteger(object.amount_total) ||
    typeof object.currency !== "string" ||
    !isRecord(object.metadata)
  ) {
    throw new Error("Invalid Stripe Checkout Session event object");
  }
  const metadata: Record<string, string> = {};
  for (const [key, value] of Object.entries(object.metadata)) {
    if (typeof value !== "string") {
      throw new Error("Invalid Stripe Checkout Session metadata");
    }
    metadata[key] = value;
  }
  return {
    id: payload.id,
    type: payload.type,
    data: {
      object: {
        id: object.id,
        payment_status: object.payment_status,
        amount_total: object.amount_total as number,
        currency: object.currency,
        metadata,
      },
    },
  };
}

