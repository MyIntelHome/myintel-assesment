// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { RequestCenter } from "@/components/RequestCenter";
vi.mock("@/components/HomeReviewPhotos", () => ({ HomeReviewPhotos: () => null }));
vi.mock("@/components/ProfessionalHandoff", () => ({ ProfessionalHandoff: () => null }));

let root: Root, container: HTMLDivElement;
const fetchMock = vi.fn();
const user = { id: "example", name: "Example User", email: "example@example.test", isAdmin: false };
const request = { id: "example-request", service: "professional_assessment", status: "accepted", scope: "Example visit", amount_cents: 12500, quote_version: 4, created_at: "2026-09-08T00:00:00Z" };
const reply = (body: unknown) => ({ ok: true, json: async () => body });
async function render(mode?: "disabled" | "test" | "live") {
  await act(async () => root.render(createElement(RequestCenter, { user, paymentsEnabled: true, paymentMode: mode, onNew: vi.fn() })));
}
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  window.history.replaceState(null, "", "/?view=requests");
  container = document.createElement("div"); document.body.append(container); root = createRoot(container);
  fetchMock.mockReset(); fetchMock.mockResolvedValue(reply({ requests: [request] })); vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => { act(() => root.unmount()); container.remove(); vi.unstubAllGlobals(); });

it("requires an explicit enabled payment mode before offering checkout", async () => {
  await render();
  expect(container.textContent).toContain("Online payment is not enabled yet");
  expect(container.textContent).not.toContain("Continue to secure payment");
});

it("clearly labels test checkout and reloads an already-paid response without a redirect URL", async () => {
  await render("test");
  expect(container.textContent).toContain("no real money is charged");
  const checkout = [...container.querySelectorAll("button")].find(b => b.textContent === "Open test checkout")!;
  fetchMock.mockResolvedValueOnce(reply({ paid: true, testPayment: true }));
  fetchMock.mockResolvedValue(reply({ requests: [{ ...request, payment_mode: "test", test_paid: true }] }));
  await act(async () => checkout.click());
  expect(fetchMock).toHaveBeenCalledTimes(3);
  expect(container.textContent).toContain("Test payment confirmed. No money was charged");
  expect(container.textContent).not.toContain("Open test checkout");
  expect(container.querySelector('[role="alert"]')).toBeNull();
});

it("does not treat a checkout return parameter as proof of payment", async () => {
  window.history.replaceState(null, "", "/?view=requests&checkout=returned");
  await render("live");
  expect(fetchMock).toHaveBeenCalledWith("/api/requests", { cache: "no-store" });
  expect(container.textContent).toContain("Payment is confirmed only when your request shows it");
  expect(container.textContent).toContain("Proposal accepted");
  expect(container.textContent).not.toContain("Payment received");
});

it.each([[2500, "Partial refund", "$25.00"], [12500, "Full refund", "$125.00"]])("shows refund %s separately from the service status", async (amount, label, formatted) => {
  fetchMock.mockResolvedValue(reply({ requests: [{ ...request, status: "paid", payment_mode: "live", amount_refunded_cents: amount }] }));
  await render("live");
  expect(container.textContent).toContain(`${label}: ${formatted}`);
  expect(container.textContent).toContain("A refund does not change the service status");
  expect(container.textContent).toContain("Payment received");
  expect(container.textContent).toContain("cancellation or refund review");
});
