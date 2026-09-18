import { createHash } from "node:crypto";
import { afterEach, beforeEach, expect, it } from "vitest";
import { createClient, type Client } from "@libsql/client";
import { clearInitialArchiveForLegacyImport, prepareLegacyArchiveSnapshot } from "../../production/legacy-import";
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

it("replaces only the untouched starter archive created by the first account visit", async () => {
  const initialPayload = JSON.stringify({
    activeId: "case-new",
    cases: [{
      reference: "",
      intake: { ageBand: "", housingType: "", floors: "", livesAlone: "", mobilityAids: "", fallsLast12Months: "", concerns: [], concernNotes: "" },
      spaces: [], responses: {}, findings: {}, plan: [],
      signoff: { assessorName: "", credentials: "", licenseNumber: "", licenseState: "", licenseExpiry: "", organisation: "", signedAt: null },
      id: "case-new", audience: "unchosen", mode: "standard_ot", reportVersions: [], familyAnswers: {}, updatedAt: "2026-09-18T03:17:24.707Z",
    }],
  });
  await target.execute({
    sql: "INSERT INTO case_archives (user_id, payload, revision, updated_at) VALUES (?, ?, ?, ?)",
    args: [targetUserId, initialPayload, 2, "2026-09-18T03:17:24.917Z"],
  });

  expect(await clearInitialArchiveForLegacyImport(target, targetUserId)).toBe("cleared-initial-archive");
  const raw = sourceExport();
  await restoreSnapshot(target, await prepareLegacyArchiveSnapshot(target, raw, mapping(raw)));
  const restored = await exportSnapshot(target);
  expect(restored.tables.find(table => table.name === "case_archives")?.rows[0]).toEqual([targetUserId, payload, 260, "2026-09-16T00:00:00.000Z"]);
});

it("preserves a starter archive once it contains an answer", async () => {
  const answered = JSON.stringify({ activeId: "case-new", cases: [{ id: "case-new", familyAnswers: { entry_clear: true } }] });
  await target.execute({
    sql: "INSERT INTO case_archives (user_id, payload, revision, updated_at) VALUES (?, ?, ?, ?)",
    args: [targetUserId, answered, 3, "2026-09-18T03:17:24.917Z"],
  });
  await expect(clearInitialArchiveForLegacyImport(target, targetUserId)).rejects.toThrow();
  expect((await target.execute("SELECT payload FROM case_archives")).rows[0]?.payload).toBe(answered);
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
