import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  handleApi,
  type Env,
} from "../../worker/api";
import { SqliteTestDatabase } from "./sqlite-test-db";

const APP_ORIGIN = "https://myintel.test";
type User = { id: string; email: string; name?: string };

const alice: User = { id: "user-alice", email: "alice@example.com", name: "Alice Analyst" };
const bob: User = { id: "user-bob", email: "bob@example.com", name: "Bob Buyer" };
const admin: User = { id: "user-admin", email: "ADMIN@example.com", name: "Ada Admin" };

function authHeaders(user?: User): Record<string, string> {
  if (!user) return {};
  return {
    "oai-authenticated-user-id": user.id,
    "oai-authenticated-user-email": user.email,
    "oai-authenticated-user-full-name": encodeURIComponent(user.name ?? user.email),
    "oai-authenticated-user-full-name-encoding": "percent-encoded-utf-8",
  };
}

function makeRequest(
  path: string,
  options: { method?: string; user?: User; body?: unknown; headers?: Record<string, string> } = {},
): Request {
  const method = options.method ?? "GET";
  const headers = new Headers({ ...authHeaders(options.user), ...options.headers });
  let body: string | undefined;
  if (options.body !== undefined) {
    headers.set("content-type", "application/json");
    body = JSON.stringify(options.body);
  }
  if (method !== "GET" && method !== "HEAD" && !headers.has("origin")) {
    headers.set("origin", APP_ORIGIN);
  }
  return new Request(`${APP_ORIGIN}${path}`, { method, headers, body });
}

function validServiceRequest(overrides: Record<string, unknown> = {}) {
  return {
    idempotencyKey: crypto.randomUUID(),
    service: "home_modifications",
    name: "Alice Analyst",
    postalCode: "02139",
    phone: "",
    contactMethod: "email",
    relationship: "self",
    consent: true,
    ...overrides,
  };
}

function caseRecord(id: string, reportVersions: unknown[] = []) {
  return { id, spaces: [], responses: {}, plan: [], reportVersions };
}

function signedSnapshot(id = "report-v1", attestationText = "I attest to this report") {
  const completeness = {
    requiredTotal: 0,
    requiredAssessed: 0,
    optionalTotal: 0,
    optionalAssessed: 0,
    percent: 0,
    isComplete: false,
    unableToAssessCount: 0,
    outstanding: [],
  };
  return {
    id,
    revision: 1,
    supersedesId: null,
    attestationVersion: "v1",
    attestationText,
    templateVersions: {},
    caseData: {
      reference: "CASE-1",
      intake: {
        ageBand: "",
        housingType: "",
        floors: "",
        livesAlone: "",
        mobilityAids: "",
        fallsLast12Months: "",
        concerns: [],
        concernNotes: "",
      },
      spaces: [],
      responses: {},
      findings: {},
      plan: [],
      signoff: {
        assessorName: "Test Assessor",
        credentials: "OT",
        licenseNumber: "TEST-1",
        licenseState: "MA",
        licenseExpiry: "2030-01-01",
        organisation: "Test Practice",
        signedAt: "2026-09-08T10:00:00.000Z",
      },
    },
    view: {
      perSpace: [],
      completeness,
      risk: {
        state: "incomplete",
        counts: { critical: 0, concern: 0, total: 0 },
        canStateNoRisks: false,
        assessmentIncomplete: true,
        unableToAssessCount: 0,
        statement: "Assessment incomplete",
      },
      findings: [],
      limitations: [],
      notApplicable: [],
    },
  };
}

function insertProvider(
  database: SqliteTestDatabase,
  values: { id: string; service: string; status?: string; name?: string },
) {
  database.sqlite
    .prepare(
      "INSERT INTO providers (id,name,service,area,credentials,verification_note,status,created_at) VALUES (?,?,?,?,?,?,?,?)",
    )
    .run(
      values.id,
      values.name ?? values.id,
      values.service,
      "Boston",
      "Licensed contractor",
      "Verified by the test fixture",
      values.status ?? "verified",
      "2026-09-08T00:00:00.000Z",
    );
}

function insertServiceRequest(
  database: SqliteTestDatabase,
  values: {
    id: string;
    userId?: string;
    service?: string;
    status?: string;
    quoteVersion?: number;
    providerId?: string | null;
  },
) {
  database.sqlite
    .prepare(
      `INSERT INTO service_requests
       (id,user_id,email,service,name,postal_code,phone,contact_method,relationship,status,consent_at,
        provider_id,scope,amount_cents,quote_version,created_at,updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    )
    .run(
      values.id,
      values.userId ?? alice.id,
      values.userId === bob.id ? bob.email : alice.email,
      values.service ?? "home_modifications",
      "Test Client",
      "02139",
      "",
      "email",
      "self",
      values.status ?? "submitted",
      "2026-09-08T00:00:00.000Z",
      values.providerId ?? null,
      values.status === "quoted" ? "Install an entry rail" : "",
      values.status === "quoted" ? 12500 : null,
      values.quoteVersion ?? 0,
      "2026-09-08T00:00:00.000Z",
      "2026-09-08T00:00:00.000Z",
    );
}

describe("MyIntel API integration", () => {
  let database: SqliteTestDatabase;
  let env: Env;

  beforeEach(() => {
    database = new SqliteTestDatabase();
    env = {
      DB: database,
      ASSETS: { fetch: async () => new Response("asset") },
      APP_ORIGIN,
      MYINTEL_ADMIN_EMAIL: "admin@example.com",
    };
  });

  afterEach(() => database.close());

  async function call(
    path: string,
    options: Parameters<typeof makeRequest>[1] = {},
  ): Promise<{ response: Response; data: any }> {
    const response = await handleApi(makeRequest(path, options), env);
    return { response, data: await response.json() };
  }

  describe("account authentication and admin isolation", () => {
    it("returns a public account envelope but protects every other account route", async () => {
      const account = await call("/api/account");
      expect(account.response.status).toBe(200);
      expect(account.data).toEqual({ user: null, paymentsEnabled: false });

      const cases = await call("/api/cases");
      expect(cases.response.status).toBe(401);
      expect(cases.data.error).toMatch(/sign in/i);
    });

    it("decodes the authenticated name and compares the configured admin email case-insensitively", async () => {
      const result = await call("/api/account", { user: admin });
      expect(result.data.user).toEqual({ ...admin, isAdmin: true });
    });

    it("keeps the admin collection inaccessible to ordinary users while admins can see all owners", async () => {
      insertServiceRequest(database, { id: "request-alice", userId: alice.id });
      insertServiceRequest(database, { id: "request-bob", userId: bob.id });

      const forbidden = await call("/api/admin/requests", { user: alice });
      expect(forbidden.response.status).toBe(403);

      const own = await call("/api/requests", { user: alice });
      expect(own.data.requests.map((request: any) => request.id)).toEqual(["request-alice"]);

      const all = await call("/api/admin/requests", { user: admin });
      expect(all.response.status).toBe(200);
      expect(all.data.requests.map((request: any) => request.id).sort()).toEqual([
        "request-alice",
        "request-bob",
      ]);
    });
  });

  describe("case archive ownership, revisions, and signed snapshots", () => {
    it("stores and reads archives only under the authenticated owner", async () => {
      const archive = { activeId: "case-a", cases: [caseRecord("case-a")] };
      const saved = await call("/api/cases", {
        method: "PUT",
        user: alice,
        body: { ownerId: alice.id, revision: 0, archive },
      });
      expect(saved.response.status).toBe(200);
      expect(saved.data).toEqual({ revision: 1 });

      const aliceRead = await call("/api/cases", { user: alice });
      expect(aliceRead.data).toEqual({ archive, revision: 1 });
      const bobRead = await call("/api/cases", { user: bob });
      expect(bobRead.data).toEqual({ archive: null, revision: 0 });

      const impersonation = await call("/api/cases", {
        method: "PUT",
        user: bob,
        body: { ownerId: alice.id, revision: 1, archive },
      });
      expect(impersonation.response.status).toBe(403);
    });

    it("rejects a stale revision without overwriting the winning archive", async () => {
      const first = { activeId: "case-a", cases: [caseRecord("case-a")] };
      await call("/api/cases", {
        method: "PUT",
        user: alice,
        body: { ownerId: alice.id, revision: 0, archive: first },
      });
      const winner = { activeId: "case-b", cases: [caseRecord("case-a"), caseRecord("case-b")] };
      expect(
        (
          await call("/api/cases", {
            method: "PUT",
            user: alice,
            body: { ownerId: alice.id, revision: 1, archive: winner },
          })
        ).response.status,
      ).toBe(200);

      const stale = { activeId: "case-c", cases: [caseRecord("case-a"), caseRecord("case-c")] };
      const conflict = await call("/api/cases", {
        method: "PUT",
        user: alice,
        body: { ownerId: alice.id, revision: 1, archive: stale },
      });
      expect(conflict.response.status).toBe(409);
      expect((await call("/api/cases", { user: alice })).data).toEqual({ archive: winner, revision: 2 });
    });

    it("allows an appended amendment but rejects mutation or deletion of a signed snapshot", async () => {
      const v1 = signedSnapshot();
      const original = { activeId: "case-a", cases: [caseRecord("case-a", [v1])] };
      const initial = await call("/api/cases", {
        method: "PUT",
        user: alice,
        body: { ownerId: alice.id, revision: 0, archive: original },
      });
      expect(initial.response.status).toBe(200);

      const v2 = { ...signedSnapshot("report-v2", "Amendment attestation"), revision: 2, supersedesId: "report-v1" };
      const amended = { activeId: "case-a", cases: [caseRecord("case-a", [v1, v2])] };
      const append = await call("/api/cases", {
        method: "PUT",
        user: alice,
        body: { ownerId: alice.id, revision: 1, archive: amended },
      });
      expect(append.response.status).toBe(200);

      const changedV1 = signedSnapshot("report-v1", "Changed after signing");
      const mutation = await call("/api/cases", {
        method: "PUT",
        user: alice,
        body: {
          ownerId: alice.id,
          revision: 2,
          archive: { activeId: "case-a", cases: [caseRecord("case-a", [changedV1, v2])] },
        },
      });
      expect(mutation.response.status).toBe(409);

      const deletion = await call("/api/cases", {
        method: "PUT",
        user: alice,
        body: { ownerId: alice.id, revision: 2, archive: { activeId: "case-b", cases: [caseRecord("case-b")] } },
      });
      expect(deletion.response.status).toBe(409);
      expect((await call("/api/cases", { user: alice })).data).toEqual({ archive: amended, revision: 2 });
    });
  });

  describe("service request validation, idempotency, and ownership", () => {
    it("rejects invalid callback details and unsupported request media without writing rows", async () => {
      const invalid = await call("/api/requests", {
        method: "POST",
        user: alice,
        body: validServiceRequest({ contactMethod: "phone", phone: "555-12" }),
      });
      expect(invalid.response.status).toBe(400);

      const unsupported = await call("/api/requests", {
        method: "POST",
        user: alice,
        headers: { "content-type": "text/plain" },
      });
      expect(unsupported.response.status).toBe(415);
      expect(database.sqlite.prepare("SELECT COUNT(*) AS total FROM service_requests").get()).toEqual({ total: 0 });
    });

    it("creates one event for an idempotent retry and refuses reuse by another owner", async () => {
      const id = crypto.randomUUID();
      const payload = validServiceRequest({ idempotencyKey: id });
      const created = await call("/api/requests", { method: "POST", user: alice, body: payload });
      expect(created.response.status).toBe(201);

      const retried = await call("/api/requests", {
        method: "POST",
        user: alice,
        body: { ...payload, name: "Different retry name" },
      });
      expect(retried.response.status).toBe(200);
      expect(retried.data.request.name).toBe("Alice Analyst");
      expect(database.sqlite.prepare("SELECT COUNT(*) AS total FROM request_events WHERE request_id=?").get(id)).toEqual({ total: 1 });

      const collision = await call("/api/requests", { method: "POST", user: bob, body: payload });
      expect(collision.response.status).toBe(409);
      expect((await call("/api/requests", { user: bob })).data.requests).toEqual([]);
    });

    it("rejects cross-origin writes before parsing or persistence", async () => {
      const result = await call("/api/requests", {
        method: "POST",
        user: alice,
        body: validServiceRequest(),
        headers: { origin: "https://attacker.example" },
      });
      expect(result.response.status).toBe(403);
      expect(database.sqlite.prepare("SELECT COUNT(*) AS total FROM service_requests").get()).toEqual({ total: 0 });
    });
  });

  describe("admin quote concurrency, provider eligibility, and transitions", () => {
    it("requires the current quote version even for an initial admin update", async () => {
      insertServiceRequest(database, { id: "request-version-required" });
      const missing = await call("/api/admin/requests/request-version-required", {
        method: "PATCH",
        user: admin,
        body: { status: "reviewing" },
      });
      expect(missing.response.status).toBe(400);

      const negative = await call("/api/admin/requests/request-version-required", {
        method: "PATCH",
        user: admin,
        body: { status: "reviewing", quoteVersion: -1 },
      });
      expect(negative.response.status).toBe(400);
    });

    it("quotes only with a verified provider for the requested service", async () => {
      insertServiceRequest(database, { id: "request-provider", service: "home_modifications" });
      insertProvider(database, { id: "pending-match", service: "home_modifications", status: "pending" });
      insertProvider(database, { id: "verified-wrong", service: "technology_support" });
      insertProvider(database, { id: "verified-match", service: "home_modifications" });

      for (const providerId of ["pending-match", "verified-wrong"]) {
        const rejected = await call("/api/admin/requests/request-provider", {
          method: "PATCH",
          user: admin,
          body: {
            status: "quoted",
            quoteVersion: 0,
            providerId,
            scope: "Install an entry rail",
            amountCents: 12500,
          },
        });
        expect(rejected.response.status).toBe(400);
      }

      const quoted = await call("/api/admin/requests/request-provider", {
        method: "PATCH",
        user: admin,
        body: {
          status: "quoted",
          quoteVersion: 0,
          providerId: "verified-match",
          scope: "Install an entry rail",
          amountCents: 12500,
        },
      });
      expect(quoted.response.status).toBe(200);
      expect(
        database.sqlite.prepare("SELECT status,provider_id,quote_version FROM service_requests WHERE id=?").get("request-provider"),
      ).toEqual({ status: "quoted", provider_id: "verified-match", quote_version: 1 });
    });

    it("rejects stale admin updates and records no event for a failed compare-and-swap", async () => {
      insertServiceRequest(database, { id: "request-stale", status: "quoted", quoteVersion: 2 });
      const stale = await call("/api/admin/requests/request-stale", {
        method: "PATCH",
        user: admin,
        body: { status: "reviewing", quoteVersion: 1 },
      });
      expect(stale.response.status).toBe(409);
      expect(database.sqlite.prepare("SELECT status,quote_version FROM service_requests WHERE id=?").get("request-stale")).toEqual({
        status: "quoted",
        quote_version: 2,
      });
      expect(database.sqlite.prepare("SELECT COUNT(*) AS total FROM request_events WHERE request_id=?").get("request-stale")).toEqual({ total: 0 });
    });

    it.each(["completed", "cancelled"])("keeps the %s terminal state immutable", async (status) => {
      const id = `request-${status}`;
      insertServiceRequest(database, { id, status, quoteVersion: 3 });
      const result = await call(`/api/admin/requests/${id}`, {
        method: "PATCH",
        user: admin,
        body: { status: "reviewing", quoteVersion: 3 },
      });
      expect(result.response.status).toBe(409);
      expect(database.sqlite.prepare("SELECT status FROM service_requests WHERE id=?").get(id)).toEqual({ status });
    });

    it.each(["accepted", "paid"])("allows %s only to transition to completed", async (status) => {
      const rejectId = `request-${status}-reject`;
      insertServiceRequest(database, { id: rejectId, status, quoteVersion: 4 });
      const rejected = await call(`/api/admin/requests/${rejectId}`, {
        method: "PATCH",
        user: admin,
        body: { status: "cancelled", quoteVersion: 4 },
      });
      expect(rejected.response.status).toBe(409);

      const completeId = `request-${status}-complete`;
      insertServiceRequest(database, { id: completeId, status, quoteVersion: 4 });
      const completed = await call(`/api/admin/requests/${completeId}`, {
        method: "PATCH",
        user: admin,
        body: { status: "completed", quoteVersion: 4 },
      });
      expect(completed.response.status).toBe(200);
      expect(database.sqlite.prepare("SELECT status FROM service_requests WHERE id=?").get(completeId)).toEqual({ status: "completed" });
    });
  });

  describe("quote acceptance compare-and-swap", () => {
    it("requires the owner, quoted status, and exact positive quote version", async () => {
      insertServiceRequest(database, {
        id: "request-accept",
        status: "quoted",
        quoteVersion: 3,
        providerId: "provider-1",
      });

      const invalid = await call("/api/requests/request-accept/accept", {
        method: "POST",
        user: alice,
        body: { quoteVersion: 0 },
      });
      expect(invalid.response.status).toBe(400);

      const otherOwner = await call("/api/requests/request-accept/accept", {
        method: "POST",
        user: bob,
        body: { quoteVersion: 3 },
      });
      expect(otherOwner.response.status).toBe(409);

      const stale = await call("/api/requests/request-accept/accept", {
        method: "POST",
        user: alice,
        body: { quoteVersion: 2 },
      });
      expect(stale.response.status).toBe(409);

      const accepted = await call("/api/requests/request-accept/accept", {
        method: "POST",
        user: alice,
        body: { quoteVersion: 3 },
      });
      expect(accepted.response.status).toBe(200);
      expect(accepted.data).toEqual({ accepted: true });

      const replay = await call("/api/requests/request-accept/accept", {
        method: "POST",
        user: alice,
        body: { quoteVersion: 3 },
      });
      expect(replay.response.status).toBe(409);
      expect(database.sqlite.prepare("SELECT status,quote_version FROM service_requests WHERE id=?").get("request-accept")).toEqual({
        status: "accepted",
        quote_version: 3,
      });
    });
  });
});
