import { afterEach, describe, expect, it, vi } from "vitest";
import { createCheckout, verifyStripeEvent } from "../../worker/stripe";

const encoder = new TextEncoder();

afterEach(() => {
  vi.unstubAllGlobals();
});

async function sign(raw: string, timestamp: number, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(`${timestamp}.${raw}`),
  );
  return Array.from(new Uint8Array(signature), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

describe("createCheckout", () => {
  it("posts a server-priced Checkout Session with generic metadata", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: "cs_test_123", url: "https://checkout.stripe.com/test" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      createCheckout({
        secretKey: "sk_test_secret",
        requestId: "req_42",
        quoteVersion: "7",
        amountCents: 12500,
        currency: "usd",
        origin: "https://myintel.example",
        customerEmail: "client@example.com",
      }),
    ).resolves.toEqual({ id: "cs_test_123", url: "https://checkout.stripe.com/test" });

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.stripe.com/v1/checkout/sessions");
    expect(init.method).toBe("POST");
    expect(init.headers).toMatchObject({
      Authorization: "Bearer sk_test_secret",
      "Content-Type": "application/x-www-form-urlencoded",
      "Idempotency-Key": "req_42:7",
    });
    const body = init.body as URLSearchParams;
    expect(Object.fromEntries(body)).toMatchObject({
      mode: "payment",
      success_url: "https://myintel.example/?view=requests&checkout=returned",
      cancel_url: "https://myintel.example/?view=requests",
      "line_items[0][price_data][product_data][name]": "MyIntel professional service",
      "line_items[0][price_data][unit_amount]": "12500",
      "metadata[requestId]": "req_42",
      "metadata[quoteVersion]": "7",
      "payment_intent_data[metadata][requestId]": "req_42",
      "payment_intent_data[metadata][quoteVersion]": "7",
      customer_email: "client@example.com",
    });
    expect([...body.keys()].join(" ")).not.toMatch(/health|assessment|diagnosis|patient/i);
  });

  it("rejects an invalid amount before calling Stripe", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(
      createCheckout({
        secretKey: "sk_test_secret",
        requestId: "req_42",
        quoteVersion: "7",
        amountCents: 0,
        currency: "usd",
        origin: "https://myintel.example",
      }),
    ).rejects.toThrow("amountCents");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("verifyStripeEvent", () => {
  const now = 1_800_000_000;
  const secret = "whsec_test_secret";
  const event = {
    id: "evt_123",
    type: "checkout.session.completed",
    data: {
      object: {
        id: "cs_test_123",
        payment_status: "paid",
        amount_total: 12500,
        currency: "usd",
        metadata: { requestId: "req_42", quoteVersion: "7" },
        customer_details: { email: "client@example.com" },
      },
    },
  };

  it("accepts a valid v1 signature and returns only the verified fields", async () => {
    const raw = JSON.stringify(event);
    const v1 = await sign(raw, now, secret);
    await expect(verifyStripeEvent(raw, `t=${now},v1=${v1}`, secret, now)).resolves.toEqual({
      id: "evt_123",
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_test_123",
          payment_status: "paid",
          amount_total: 12500,
          currency: "usd",
          metadata: { requestId: "req_42", quoteVersion: "7" },
        },
      },
    });
  });

  it("rejects a body changed after signing", async () => {
    const raw = JSON.stringify(event);
    const v1 = await sign(raw, now, secret);
    await expect(
      verifyStripeEvent(raw.replace("12500", "12501"), `t=${now},v1=${v1}`, secret, now),
    ).rejects.toThrow("signature");
  });

  it("rejects missing keys, malformed headers, and stale timestamps", async () => {
    const raw = JSON.stringify(event);
    const v1 = await sign(raw, now, secret);
    await expect(verifyStripeEvent(raw, `t=${now},v1=${v1}`, "", now)).rejects.toThrow("secret");
    await expect(verifyStripeEvent(raw, "v1=abcd", secret, now)).rejects.toThrow("Malformed");
    await expect(verifyStripeEvent(raw, `t=${now - 301},v1=${v1}`, secret, now)).rejects.toThrow(
      "tolerance",
    );
  });

  it("accepts any matching v1 signature during secret rotation", async () => {
    const raw = JSON.stringify(event);
    const v1 = await sign(raw, now, secret);
    const invalid = "00".repeat(32);
    await expect(
      verifyStripeEvent(raw, `t=${now},v1=${invalid},v1=${v1}`, secret, now),
    ).resolves.toMatchObject({ id: "evt_123" });
  });
});

