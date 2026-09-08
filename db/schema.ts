import { sqliteTable, text, integer, index, uniqueIndex } from "drizzle-orm/sqlite-core";

export const caseArchives = sqliteTable("case_archives", {
  userId: text("user_id").primaryKey(), payload: text("payload").notNull(),
  revision: integer("revision").notNull().default(1), updatedAt: text("updated_at").notNull(),
});
export const requests = sqliteTable("service_requests", {
  id:text("id").primaryKey(), userId:text("user_id").notNull(), email:text("email").notNull(),
  service:text("service").notNull(), name:text("name").notNull(), postalCode:text("postal_code").notNull(),
  phone:text("phone").notNull().default(""), contactMethod:text("contact_method").notNull(), relationship:text("relationship").notNull(),
  status:text("status").notNull().default("submitted"), consentAt:text("consent_at").notNull(),
  providerId:text("provider_id"), scope:text("scope").notNull().default(""), amountCents:integer("amount_cents"),
  quoteVersion:integer("quote_version").notNull().default(0), paymentSessionId:text("payment_session_id"),
  createdAt:text("created_at").notNull(), updatedAt:text("updated_at").notNull(),
}, t=>[index("requests_user_created").on(t.userId,t.createdAt),index("requests_status_created").on(t.status,t.createdAt)]);
export const providers = sqliteTable("providers", {
  id:text("id").primaryKey(), name:text("name").notNull(), service:text("service").notNull(),
  area:text("area").notNull(), credentials:text("credentials").notNull(), verificationNote:text("verification_note").notNull(),
  status:text("status").notNull().default("pending"), createdAt:text("created_at").notNull(),
});
export const requestEvents = sqliteTable("request_events", {
  id:text("id").primaryKey(), requestId:text("request_id").notNull(), actorId:text("actor_id").notNull(),
  status:text("status").notNull(), createdAt:text("created_at").notNull(),
}, t=>[index("events_request_created").on(t.requestId,t.createdAt)]);
export const paymentEvents = sqliteTable("payment_events", {
  id:text("id").primaryKey(), sessionId:text("session_id").notNull(), createdAt:text("created_at").notNull(),
}, t=>[uniqueIndex("payment_session_unique").on(t.sessionId)]);
