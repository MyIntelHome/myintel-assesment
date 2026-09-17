import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient, type Client } from "@libsql/client";
import { z } from "zod";
import { applicationTables, createSnapshot, exportSnapshot, restoreSnapshot, type Snapshot } from "./snapshot.ts";

const emptyRows = z.array(z.never());
const legacyExportSchema = z.object({
  exportedAt: z.string().datetime(),
  tables: z.object({
    case_archives: z.array(z.object({
      user_id: z.string().min(1), payload: z.string().min(1), revision: z.number().int().positive(), updated_at: z.string().min(1),
    }).strict()).length(1),
    home_handoffs: emptyRows,
    home_photos: emptyRows,
    payment_events: emptyRows,
    professional_access: z.array(z.object({
      user_id: z.string(), email: z.string(), name: z.string(), practice: z.string(), credential: z.string(), region: z.string(),
      status: z.string(), revision: z.number().int(), review_note: z.string(), updated_at: z.string(),
    }).strict()).length(1),
    professional_access_events: z.array(z.object({
      id: z.string(), user_id: z.string(), actor_id: z.string(), status: z.string(), note: z.string(), created_at: z.string(),
    }).strict()).length(1),
    providers: emptyRows,
    request_events: emptyRows,
    service_requests: emptyRows,
  }).strict(),
}).strict();

const hashSchema = z.string().regex(/^[a-f0-9]{64}$/);
const mappingSchema = z.object({
  sourceUserId: z.string().min(1),
  targetUserId: z.string().uuid(),
  expectedExportSha256: hashSchema,
  expectedPayloadSha256: hashSchema,
}).strict();

function sha256(value: string) { return createHash("sha256").update(value).digest("hex"); }

/**
 * Convert the exact recovered Sites export into a complete v2 snapshot.
 * The legacy professional rows are intentionally retained only in the private
 * source export: they are known test records and must not create pilot access.
 */
export async function prepareLegacyArchiveSnapshot(
  client: Client,
  rawExport: string,
  mapping: unknown,
): Promise<Snapshot> {
  const expected = mappingSchema.parse(mapping);
  if (sha256(rawExport) !== expected.expectedExportSha256) throw new Error("Legacy export checksum mismatch");
  const legacy = legacyExportSchema.parse(JSON.parse(rawExport));
  const archive = legacy.tables.case_archives[0]!;
  if (archive.user_id !== expected.sourceUserId) throw new Error("Legacy account mapping mismatch");
  if (sha256(archive.payload) !== expected.expectedPayloadSha256) throw new Error("Legacy payload checksum mismatch");
  const payload = z.object({ cases: z.array(z.unknown()).min(1) }).passthrough().parse(JSON.parse(archive.payload));
  if (payload.cases.length !== 6) throw new Error("Legacy case count mismatch");

  const tables: Snapshot["tables"] = [];
  for (const name of applicationTables) {
    const columns = (await client.execute(`PRAGMA table_info("${name}")`)).rows.map(row => String(row.name));
    if (!columns.length) throw new Error("Destination schema is incomplete");
    const rows = name === "case_archives"
      ? [[expected.targetUserId, archive.payload, archive.revision, archive.updated_at]]
      : [];
    tables.push({ name, columns, rows });
  }
  return createSnapshot(tables, legacy.exportedAt);
}

async function writePrivateSnapshot(path: string, snapshot: Snapshot) {
  if (!isAbsolute(path)) throw new Error("Backup paths must be absolute");
  await writeFile(path, JSON.stringify(snapshot), { encoding: "utf8", flag: "wx", mode: 0o600 });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const url = process.env.MYINTEL_DATABASE_URL;
  const authToken = process.env.MYINTEL_DATABASE_AUTH_TOKEN;
  const inputPath = process.env.MYINTEL_LEGACY_EXPORT_PATH;
  const prePath = process.env.MYINTEL_PREIMPORT_BACKUP_PATH;
  const postPath = process.env.MYINTEL_POSTIMPORT_BACKUP_PATH;
  const confirmedTarget = process.env.MYINTEL_IMPORT_TARGET;
  const ready = url && authToken && url.startsWith("libsql://") && confirmedTarget === url && inputPath && isAbsolute(inputPath) && prePath && postPath;
  if (!ready) {
    console.error("Legacy import blocked: set credentials, absolute export/backup paths, and explicitly confirm MYINTEL_IMPORT_TARGET matches the database URL.");
    process.exitCode = 1;
  } else {
    const client = createClient({ url, authToken, intMode: "number" });
    try {
      const before = await exportSnapshot(client);
      await writePrivateSnapshot(prePath, before);
      const raw = await readFile(inputPath, "utf8");
      const prepared = await prepareLegacyArchiveSnapshot(client, raw, {
        sourceUserId: process.env.MYINTEL_LEGACY_SOURCE_USER_ID,
        targetUserId: process.env.MYINTEL_TARGET_USER_ID,
        expectedExportSha256: process.env.MYINTEL_LEGACY_EXPORT_SHA256,
        expectedPayloadSha256: process.env.MYINTEL_LEGACY_PAYLOAD_SHA256,
      });
      const counts = await restoreSnapshot(client, prepared);
      if (counts.case_archives !== 1 || Object.entries(counts).some(([name, count]) => name !== "case_archives" && count !== 0)) {
        throw new Error("Imported row counts differ from the reviewed plan");
      }
      const after = await exportSnapshot(client);
      const archive = after.tables.find(table => table.name === "case_archives")?.rows[0];
      if (!archive || archive[0] !== process.env.MYINTEL_TARGET_USER_ID || sha256(String(archive[1])) !== process.env.MYINTEL_LEGACY_PAYLOAD_SHA256) {
        throw new Error("Imported archive verification failed");
      }
      await writePrivateSnapshot(postPath, after);
      console.log("Legacy archive import complete: one mapped archive verified; two test-professional rows remain quarantined in the source export.");
    } catch {
      console.error("Legacy import completion was not confirmed. Inspect the target and private snapshots before retrying; never overwrite an occupied destination.");
      process.exitCode = 1;
    } finally { client.close(); }
  }
}
