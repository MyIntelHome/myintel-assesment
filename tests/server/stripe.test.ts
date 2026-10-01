import { afterEach, describe, expect, it, vi } from "vitest";
import { createHmac } from "node:crypto";
import { createCheckout, parseCheckoutSession, retrieveCheckout, verifyStripeEvent } from "../../worker/stripe";

const session = (overrides: Record<string, unknown> = {}) => ({
  id: "cs_test_123", url: "https://checkout.stripe.com/c/pay/example", mode: "payment", status: "open",
  payment_status: "unpaid", amount_total: 12500, currency: "usd", livemode: false,
  payment_intent: null, expires_at: 1_800_001_860,
  metadata: { requestId: "req_42", quoteVersion: "7", attempt: "0" }, ...overrides,
});
const options = { secretKey: "sk_test_secret", requestId: "req_42", quoteVersion: "7", amountCents: 12500, currency: "usd" as const, origin: "https://myintel.example" };
afterEach(() => vi.unstubAllGlobals());

function stripeReply(value: unknown) {
  const mock = vi.fn().mockImplementation(async () => Response.json(value));
  vi.stubGlobal("fetch", mock);
  return mock;
}

describe("createCheckout", () => {
  it("sends a server-priced payment with generic metadata and a persisted deadline", async () => {
    const mock = stripeReply(session());
    await expect(createCheckout({ ...options, expiresAt: 1_800_001_860 })).resolves.toEqual(session());
    const [url, init] = mock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.stripe.com/v1/checkout/sessions");
    expect(init).toMatchObject({ method: "POST", redirect: "error", headers: { Authorization: "Bearer sk_test_secret", "Idempotency-Key": "req_42:7:0", "Stripe-Version": "2026-08-26.dahlia" } });
    expect(Object.fromEntries(init.body as URLSearchParams)).toMatchObject({
      mode: "payment", integration_identifier: "myintel_proposal_checkout_mqnxzbrt", expires_at: "1800001860",
      success_url: "https://myintel.example/?view=requests&checkout=returned", cancel_url: "https://myintel.example/?view=requests",
      "line_items[0][price_data][unit_amount]": "12500", "metadata[requestId]": "req_42", "metadata[attempt]": "0",
      "payment_intent_data[metadata][quoteVersion]": "7", "payment_intent_data[metadata][attempt]": "0",
    });
    expect([...((init.body as URLSearchParams).keys())].join(" ")).not.toMatch(/health|assessment|diagnosis|patient|customer_email/i);
    expect([...((init.body as URLSearchParams).keys())]).not.toContain("payment_method_types[0]");
  });

  it("accepts a restricted test key while rejecting a restricted live key in test mode", async () => {
    const mock = stripeReply(session());
    await expect(createCheckout({ ...options, secretKey: "rk_test_example", expectedLivemode: false })).resolves.toEqual(session());
    expect(mock.mock.calls[0]![1].headers.Authorization).toBe("Bearer rk_test_example");
    await expect(createCheckout({ ...options, secretKey: "rk_live_example", expectedLivemode: false })).rejects.toThrow("configured payment mode");
    expect(mock).toHaveBeenCalledTimes(1);
  });

  it("keeps retry parameters stable and gives a replacement attempt a distinct idempotency key", async () => {
    const mock = stripeReply(session());
    await createCheckout({ ...options, expiresAt: 1_800_001_860 });
    await createCheckout({ ...options, expiresAt: 1_800_001_860 });
    expect(String(mock.mock.calls[0]![1].body)).toBe(String(mock.mock.calls[1]![1].body));
    mock.mockImplementation(async () => Response.json(session({ metadata: { requestId: "req_42", quoteVersion: "7", attempt: "1" } })));
    await createCheckout({ ...options, attempt: 1, expiresAt: 1_800_003_720 });
    expect(mock.mock.calls[2]![1].headers["Idempotency-Key"]).toBe("req_42:7:1");
  });

  it.each([{ amountCents: 0 }, { amountCents: 1.5 }, { attempt: -1 }, { expiresAt: 1.5 }, { expectedLivemode: true }, { secretKey: "invalid" }, { origin: "https://myintel.example/path" }])("rejects invalid input without contacting Stripe: %j", async (invalid) => {
    const mock = stripeReply(session());
    await expect(createCheckout({ ...options, ...invalid })).rejects.toThrow();
    expect(mock).not.toHaveBeenCalled();
  });

  it.each([{ amount_total: 1 }, { metadata: { requestId: "other", quoteVersion: "7", attempt: "0" } }, { metadata: { requestId: "req_42", quoteVersion: "7", attempt: "2" } }, { livemode: true }])("rejects a mismatched Stripe response: %j", async (invalid) => {
    stripeReply(session(invalid));
    await expect(createCheckout(options)).rejects.toThrow();
  });

  it("reports unsuccessful Stripe requests without returning a checkout link", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ error: { message: "Unavailable" } }, { status: 503 })));
    await expect(createCheckout(options)).rejects.toThrow("503");
  });
});

describe("retrieveCheckout", () => {
  it.each(["open", "expired", "complete"])("retrieves a %s session before deciding whether to retry", async (status) => {
    const value = session({ status, url: status === "open" ? session().url : null });
    const mock = stripeReply(value);
    await expect(retrieveCheckout("sk_test_secret", "cs_test_123")).resolves.toEqual(value);
    expect(mock.mock.calls[0]![0]).toBe("https://api.stripe.com/v1/checkout/sessions/cs_test_123");
  });
  it("rejects session-id path injection without a network call", async () => {
    const mock = stripeReply(session());
    await expect(retrieveCheckout("sk_test_secret", "cs_test_123/../other")).rejects.toThrow();
    expect(mock).not.toHaveBeenCalled();
  });
  it("rejects responses for another session or payment mode", async () => {
    stripeReply(session({ id: "cs_other" }));
    await expect(retrieveCheckout("sk_test_secret", "cs_test_123")).rejects.toThrow("different session");
    stripeReply(session({ livemode: true }));
    await expect(retrieveCheckout("sk_test_secret", "cs_test_123")).rejects.toThrow();
  });
});

describe("parseCheckoutSession", () => {
  it.each([
    { url: "https://checkout.stripe.com.evil.test/pay" }, { url: "https://evil.test/" },
    { url: "http://checkout.stripe.com/pay" }, { url: "https://user@checkout.stripe.com/pay" },
    { url: "https://checkout.stripe.com:444/pay" }, { url: null }, { mode: "subscription" },
    { status: "unknown" }, { payment_status: "unknown" }, { payment_intent: "bad" },
    { amount_total: 1.1 }, { currency: "eur" }, { livemode: "false" }, { metadata: { requestId: 1 } },
  ])("rejects an unsafe or malformed session: %j", (invalid) => {
    expect(() => parseCheckoutSession(session(invalid), false)).toThrow();
  });
  it("returns only payment fields and preserves settled intent IDs", () => {
    const value = session({ status: "complete", payment_status: "paid", payment_intent: "pi_example", url: null });
    expect(parseCheckoutSession({ ...value, customer_details: { email: "private@example.test" } })).toEqual(value);
  });
});

describe("verifyStripeEvent", () => {
  const now = 1_800_000_000, secret = "whsec_test_secret";
  const event = { id: "evt_123", type: "checkout.session.completed", livemode: false, data: { object: session() } };
  const signature = (raw: string, timestamp = now) => `t=${timestamp},v1=${createHmac("sha256", secret).update(`${timestamp}.${raw}`).digest("hex")}`;
  it("verifies the untouched body and retains its payment mode", async () => {
    const raw = JSON.stringify(event);
    await expect(verifyStripeEvent(raw, signature(raw), secret, now)).resolves.toEqual(event);
  });
  it("accepts signed refund envelopes for separate event-specific validation", async () => {
    const refund = { ...event, type: "charge.refunded", data: { object: { id: "ch_example", payment_intent: "pi_example", amount_refunded: 12500 } } };
    const raw = JSON.stringify(refund);
    await expect(verifyStripeEvent(raw, signature(raw), secret, now)).resolves.toEqual(refund);
  });
  it("rejects modified bodies, absent mode, malformed signatures and old or future timestamps", async () => {
    const raw = JSON.stringify(event);
    await expect(verifyStripeEvent(raw.replace("12500", "1"), signature(raw), secret, now)).rejects.toThrow("signature");
    const noMode = JSON.stringify({ ...event, livemode: undefined });
    await expect(verifyStripeEvent(noMode, signature(noMode), secret, now)).rejects.toThrow("envelope");
    await expect(verifyStripeEvent(raw, "v1=abcd", secret, now)).rejects.toThrow("Malformed");
    for (const timestamp of [now - 301, now + 301]) await expect(verifyStripeEvent(raw, signature(raw, timestamp), secret, now)).rejects.toThrow("tolerance");
    await expect(verifyStripeEvent(raw, signature(raw), "", now)).rejects.toThrow("secret");
  });
  it("accepts any valid v1 signature in a rotation header", async () => {
    const raw = JSON.stringify(event);
    await expect(verifyStripeEvent(raw, `${signature(raw)},v1=${"00".repeat(32)}`, secret, now)).resolves.toEqual(event);
  });
});
