export type PaymentConfig =
  | { mode: "disabled" }
  | { mode: "test" | "live"; stripeSecretKey: string; stripeWebhookSecret: string; checkoutEnabled?: boolean };

/** Server-only configuration. Never include this object in an API response. */
export function parsePaymentConfig(env: Record<string, string | undefined>): PaymentConfig {
  const mode = env.MYINTEL_PAYMENT_MODE ?? "disabled";
  if (mode === "disabled") return { mode };

  const invalid = () => new Error("Payment configuration is invalid.");
  if (mode !== "test" && mode !== "live") throw invalid();
  if (mode === "live" && env.MYINTEL_LIVE_PAYMENTS_APPROVED !== "true") throw invalid();
  if (env.MYINTEL_PAYMENT_CHECKOUT_ENABLED !== undefined && !["true","false"].includes(env.MYINTEL_PAYMENT_CHECKOUT_ENABLED)) throw invalid();

  const stripeSecretKey = env.STRIPE_SECRET_KEY;
  const stripeWebhookSecret = env.STRIPE_WEBHOOK_SECRET;
  const secretPattern = mode === "test" ? /^sk_test_[A-Za-z0-9]+$/ : /^sk_live_[A-Za-z0-9]+$/;
  if (!stripeSecretKey || stripeSecretKey.trim() !== stripeSecretKey || !secretPattern.test(stripeSecretKey)
    || !stripeWebhookSecret || stripeWebhookSecret.trim() !== stripeWebhookSecret || !/^whsec_[A-Za-z0-9]+$/.test(stripeWebhookSecret)) throw invalid();

  return { mode, stripeSecretKey, stripeWebhookSecret, ...(env.MYINTEL_PAYMENT_CHECKOUT_ENABLED === "false" ? { checkoutEnabled:false } : {}) };
}
