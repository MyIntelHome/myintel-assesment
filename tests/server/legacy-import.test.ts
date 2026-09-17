import { createHash } from "node:crypto";
import { afterEach, beforeEach, expect, it } from "vitest";
import { createClient, type Client } from "@libsql/client";
import { prepareLegacyArchiveSnapshot } from "../../production/legacy-import";
import { applyMigrations, readMigrations } from "../../production/migrations";
import { exportSnapshot, restoreSnapshot } from "../../production/snapshot";

let target: Client;
beforeEach(async () => {
  target = createClient({ url: ":memory:", intMode: "number" });
  await applyMigrations(target, await readMigrations());
});
afterEach(() => target.close());

const digest = (value: string) => createHash("sha256").update(value).digest("hex");
const sourceUserId = "sites-owner";
const targetUserId = "3a13580d-b71c-4e55-9d01-f41e16cdedaf";
const payload = JSON.stringify({ activeId: "case-6", cases: Array.from({ length: 6 }, (_, index) => ({ id: `case-${index + 1}` })) });

function sourceExport(overrides: Record<string, unknown> = {}) {
  return JSON.stringify({
    exportedAt: "2026-09-16T00:39:49.791Z",
    tables: {
      case_archives: [{ user_id: sourceUserId, payload, revision: 260, updated_at: "2026-09-16T00:00:00.000Z" }],
      home_handoffs: [], home_photos: [], payment_events: [],
      professional_access: [{ user_id: "test-professional", email: "test@example.invalid", name: "Test", practice: "Test", credential: "Test", region: "Colorado", status: "approved", revision: 1, review_note: "test", updated_at: "2026-09-15T00:00:00.000Z" }],
      professional_access_events: [{ id: "event", user_id: "test-professional", actor_id: "test-admin", status: "approved", note: "test", created_at: "2026-09-15T00:00:00.000Z" }],
      providers: [], request_events: [], service_requests: [],
      ...overrides,
    },
  });
}

function mapping(raw: string) {
  return { sourceUserId, targetUserId, expectedExportSha256: digest(raw), expectedPayloadSha256: digest(payload) };
}

it("maps the exact archive and quarantines legacy test-professional access", async () => {
  const raw = sourceExport();
  const prepared = await prepareLegacyArchiveSnapshot(target, raw, mapping(raw));
  const counts = await restoreSnapshot(target, prepared);
  expect(counts.case_archives).toBe(1);
  expect(counts.professional_access).toBe(0);
  expect(counts.professional_access_events).toBe(0);
  const restored = await exportSnapshot(target);
  expect(restored.tables.find(table => table.name === "case_archives")?.rows[0]).toEqual([targetUserId, payload, 260, "2026-09-16T00:00:00.000Z"]);
});

it("rejects a different export, payload, owner, case count or nonempty service table", async () => {
  const raw = sourceExport();
  await expect(prepareLegacyArchiveSnapshot(target, raw + " ", mapping(raw))).rejects.toThrow("export checksum");
  await expect(prepareLegacyArchiveSnapshot(target, raw, { ...mapping(raw), expectedPayloadSha256: "0".repeat(64) })).rejects.toThrow("payload checksum");
  await expect(prepareLegacyArchiveSnapshot(target, raw, { ...mapping(raw), sourceUserId: "different-owner" })).rejects.toThrow("account mapping");

  const fiveCases = JSON.stringify({ cases: Array.from({ length: 5 }, (_, index) => ({ id: index })) });
  const wrongCount = sourceExport({ case_archives: [{ user_id: sourceUserId, payload: fiveCases, revision: 260, updated_at: "now" }] });
  await expect(prepareLegacyArchiveSnapshot(target, wrongCount, { ...mapping(wrongCount), expectedPayloadSha256: digest(fiveCases) })).rejects.toThrow("case count");

  const request = sourceExport({ service_requests: [{ id: "unexpected" }] });
  await expect(prepareLegacyArchiveSnapshot(target, request, mapping(request))).rejects.toThrow();
});
