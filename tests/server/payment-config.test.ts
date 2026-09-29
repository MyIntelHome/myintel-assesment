import { expect, it } from "vitest";
import { parsePaymentConfig } from "../../production/payment-config";

const testCredentials = { STRIPE_SECRET_KEY: "sk_test_example123", STRIPE_WEBHOOK_SECRET: "whsec_example123" };
const liveCredentials = { STRIPE_SECRET_KEY: "sk_live_example123", STRIPE_WEBHOOK_SECRET: "whsec_example123" };

it("can pause checkout without losing verified webhook handling credentials",()=>{
  expect(parsePaymentConfig({MYINTEL_PAYMENT_MODE:"test",MYINTEL_PAYMENT_CHECKOUT_ENABLED:"false",...testCredentials})).toEqual({mode:"test",checkoutEnabled:false,stripeSecretKey:testCredentials.STRIPE_SECRET_KEY,stripeWebhookSecret:testCredentials.STRIPE_WEBHOOK_SECRET});
  expect(()=>parsePaymentConfig({MYINTEL_PAYMENT_MODE:"test",MYINTEL_PAYMENT_CHECKOUT_ENABLED:"pause",...testCredentials})).toThrow("Payment configuration is invalid.");
});

it("defaults to disabled and drops configured credentials unless explicitly enabled", () => {
  expect(parsePaymentConfig({})).toEqual({ mode: "disabled" });
  expect(parsePaymentConfig(testCredentials)).toEqual({ mode: "disabled" });
  expect(parsePaymentConfig({ ...liveCredentials, MYINTEL_PAYMENT_MODE: "disabled", MYINTEL_LIVE_PAYMENTS_APPROVED: "true" })).toEqual({ mode: "disabled" });
});

it("accepts complete test configuration without live approval", () => {
  expect(parsePaymentConfig({ ...testCredentials, MYINTEL_PAYMENT_MODE: "test" })).toEqual({
    mode: "test", stripeSecretKey: testCredentials.STRIPE_SECRET_KEY, stripeWebhookSecret: testCredentials.STRIPE_WEBHOOK_SECRET,
  });
});

it("accepts live credentials only with explicit live approval", () => {
  expect(parsePaymentConfig({ ...liveCredentials, MYINTEL_PAYMENT_MODE: "live", MYINTEL_LIVE_PAYMENTS_APPROVED: "true" })).toEqual({
    mode: "live", stripeSecretKey: liveCredentials.STRIPE_SECRET_KEY, stripeWebhookSecret: liveCredentials.STRIPE_WEBHOOK_SECRET,
  });
});

it.each([undefined, "false", "TRUE", "1", " true "])("rejects live payment configuration without exact approval: %s", approval => {
  expect(() => parsePaymentConfig({ ...liveCredentials, MYINTEL_PAYMENT_MODE: "live", MYINTEL_LIVE_PAYMENTS_APPROVED: approval })).toThrow("Payment configuration is invalid.");
});

it.each(["", "TEST", "enabled", " live "])("rejects an unrecognized payment mode: %s", mode => {
  expect(() => parsePaymentConfig({ ...testCredentials, MYINTEL_PAYMENT_MODE: mode })).toThrow("Payment configuration is invalid.");
});

it.each([
  { STRIPE_SECRET_KEY: undefined },
  { STRIPE_WEBHOOK_SECRET: undefined },
  { STRIPE_SECRET_KEY: "" },
  { STRIPE_WEBHOOK_SECRET: "" },
  { STRIPE_SECRET_KEY: "pk_test_example123" },
  { STRIPE_SECRET_KEY: "sk_live_example123" },
  { STRIPE_SECRET_KEY: "sk_test_" },
  { STRIPE_SECRET_KEY: "sk_test_example123\n" },
  { STRIPE_WEBHOOK_SECRET: "sk_test_example123" },
  { STRIPE_WEBHOOK_SECRET: "whsec_" },
  { STRIPE_WEBHOOK_SECRET: " whsec_example123" },
])("rejects incomplete or malformed test credentials without exposing them: %j", overrides => {
  const env = { ...testCredentials, ...overrides, MYINTEL_PAYMENT_MODE: "test" };
  try {
    parsePaymentConfig(env);
    throw new Error("Expected invalid configuration to fail");
  } catch (error) {
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toBe("Payment configuration is invalid.");
  }
});

it("rejects test credentials in live mode even when approved", () => {
  expect(() => parsePaymentConfig({ ...testCredentials, MYINTEL_PAYMENT_MODE: "live", MYINTEL_LIVE_PAYMENTS_APPROVED: "true" })).toThrow("Payment configuration is invalid.");
});
