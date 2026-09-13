import { sqliteTable, text, integer, index, uniqueIndex } from "drizzle-orm/sqlite-core";

export const publicSessions=sqliteTable("public_sessions",{
  idHash:text("id_hash").primaryKey(),userId:text("user_id").notNull(),encryptedTokens:text("encrypted_tokens").notNull(),purpose:text("purpose").notNull(),expiresAt:integer("expires_at").notNull(),
},t=>[index("public_sessions_user").on(t.userId)]);
export const publicAuthAttempts=sqliteTable("public_auth_attempts",{
  key:text("key").primaryKey(),window:integer("window").notNull(),attempts:integer("attempts").notNull(),
});
export const publicAuthRevocations=sqliteTable("public_auth_revocations",{
  userId:text("user_id").primaryKey(),revokedBefore:integer("revoked_before").notNull(),resetting:integer("resetting").notNull().default(0),
});

export const professionalAccess=sqliteTable("professional_access",{
  userId:text("user_id").primaryKey(),email:text("email").notNull(),name:text("name").notNull(),practice:text("practice").notNull(),credential:text("credential").notNull(),region:text("region").notNull(),status:text("status").notNull().default("pending"),revision:integer("revision").notNull().default(1),reviewNote:text("review_note").notNull().default(""),updatedAt:text("updated_at").notNull(),
});
export const professionalAccessEvents=sqliteTable("professional_access_events",{
  id:text("id").primaryKey(),userId:text("user_id").notNull(),actorId:text("actor_id").notNull(),status:text("status").notNull(),note:text("note").notNull(),createdAt:text("created_at").notNull(),
});

export const caseArchives = sqliteTable("case_archives", {
  userId: text("user_id").primaryKey(), payload: text("payload").notNull(),
  revision: integer("revision").notNull().default(1), updatedAt: text("updated_at").notNull(),
});
export const requestCoordinators=sqliteTable("request_coordinators",{
  requestId:text("request_id").primaryKey(),staffId:text("staff_id").notNull(),staffName:text("staff_name").notNull(),claimedAt:text("claimed_at").notNull(),
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
export const providerAccounts=sqliteTable("provider_accounts",{
  providerId:text("provider_id").primaryKey(),userId:text("user_id").notNull(),revision:integer("revision").notNull().default(1),linkedBy:text("linked_by").notNull(),linkedAt:text("linked_at").notNull(),
},t=>[index("provider_accounts_user").on(t.userId)]);
export const providerAccountEvents=sqliteTable("provider_account_events",{
  id:text("id").primaryKey(),providerId:text("provider_id").notNull(),userId:text("user_id").notNull(),actorId:text("actor_id").notNull(),action:text("action").notNull(),revision:integer("revision").notNull(),createdAt:text("created_at").notNull(),
},t=>[index("provider_account_events_provider").on(t.providerId,t.createdAt)]);
export const requestProfessionalGrants=sqliteTable("request_professional_grants",{
  requestId:text("request_id").primaryKey(),providerId:text("provider_id").notNull(),professionalUserId:text("professional_user_id").notNull(),providerRevision:integer("provider_revision").notNull(),quoteVersion:integer("quote_version").notNull(),shareContact:integer("share_contact").notNull(),shareHome:integer("share_home").notNull(),sharePhotos:integer("share_photos").notNull(),photoIds:text("photo_ids").notNull().default("[]"),consentAt:text("consent_at").notNull(),revokedAt:text("revoked_at"),
},t=>[index("request_professional_grants_user").on(t.professionalUserId,t.consentAt)]);
export const requestProfessionalEvents=sqliteTable("request_professional_events",{
  id:text("id").primaryKey(),requestId:text("request_id").notNull(),actorId:text("actor_id").notNull(),action:text("action").notNull(),details:text("details").notNull(),createdAt:text("created_at").notNull(),
},t=>[index("request_professional_events_request").on(t.requestId,t.createdAt)]);
export const requestFollowups=sqliteTable("request_followups",{
  requestId:text("request_id").primaryKey(),coordinatorId:text("coordinator_id").notNull(),dueAt:text("due_at").notNull(),note:text("note").notNull(),revision:integer("revision").notNull().default(1),updatedAt:text("updated_at").notNull(),
});
export const requestFollowupEvents=sqliteTable("request_followup_events",{
  id:text("id").primaryKey(),requestId:text("request_id").notNull(),coordinatorId:text("coordinator_id").notNull(),actorId:text("actor_id").notNull(),dueAt:text("due_at").notNull(),note:text("note").notNull(),revision:integer("revision").notNull(),createdAt:text("created_at").notNull(),
},t=>[index("request_followup_events_request").on(t.requestId,t.createdAt)]);
export const requestEvents = sqliteTable("request_events", {
  id:text("id").primaryKey(), requestId:text("request_id").notNull(), actorId:text("actor_id").notNull(),
  status:text("status").notNull(), createdAt:text("created_at").notNull(),
}, t=>[index("events_request_created").on(t.requestId,t.createdAt)]);
export const paymentEvents = sqliteTable("payment_events", {
  id:text("id").primaryKey(), sessionId:text("session_id").notNull(), createdAt:text("created_at").notNull(),
}, t=>[uniqueIndex("payment_session_unique").on(t.sessionId)]);
export const homeHandoffs=sqliteTable("home_handoffs",{requestId:text("request_id").primaryKey(),payload:text("payload").notNull(),consentAt:text("consent_at").notNull()});
export const homePhotos=sqliteTable("home_photos",{id:text("id").primaryKey(),requestId:text("request_id").notNull(),room:text("room").notNull(),kind:text("kind").notNull(),objectKey:text("object_key").notNull(),ready:integer("ready").notNull().default(0),createdAt:text("created_at").notNull()},t=>[index("photos_request").on(t.requestId)]);
