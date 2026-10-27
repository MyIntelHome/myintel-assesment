CREATE TABLE organizations (
 id TEXT PRIMARY KEY NOT NULL,
 name TEXT NOT NULL,
 owner_id TEXT NOT NULL,
 revision INTEGER NOT NULL DEFAULT 1,
 last_mutation_id TEXT NOT NULL,
 created_at TEXT NOT NULL,
 updated_at TEXT NOT NULL
);
CREATE TABLE organization_members (
 organization_id TEXT NOT NULL REFERENCES organizations(id),
 user_id TEXT NOT NULL,
 role TEXT NOT NULL CHECK(role IN ('owner','member')),
 status TEXT NOT NULL CHECK(status IN ('active','removed')),
 display_name TEXT NOT NULL,
 email TEXT NOT NULL,
 joined_at TEXT NOT NULL,
 removed_at TEXT,
 PRIMARY KEY (organization_id,user_id)
);
CREATE INDEX organization_members_by_user ON organization_members(user_id,status);
CREATE UNIQUE INDEX one_active_organization_owner ON organization_members(organization_id) WHERE role='owner' AND status='active';
CREATE TABLE organization_invitations (
 id TEXT PRIMARY KEY NOT NULL,
 organization_id TEXT NOT NULL REFERENCES organizations(id),
 email TEXT NOT NULL,
 status TEXT NOT NULL CHECK(status IN ('pending','accepted','revoked')),
 expires_at TEXT NOT NULL,
 created_by TEXT NOT NULL,
 created_at TEXT NOT NULL,
 accepted_by TEXT
);
CREATE UNIQUE INDEX pending_organization_email ON organization_invitations(organization_id,email) WHERE status='pending';
CREATE INDEX organization_invitation_recipient ON organization_invitations(email,status);
CREATE TABLE organization_case_summaries (
 id TEXT PRIMARY KEY NOT NULL,
 organization_id TEXT NOT NULL REFERENCES organizations(id),
 case_owner_id TEXT NOT NULL,
 case_id TEXT NOT NULL,
 source_revision INTEGER NOT NULL,
 payload TEXT NOT NULL,
 consent_version TEXT NOT NULL,
 consent_at TEXT NOT NULL,
 shared_at TEXT NOT NULL,
 withdrawn_at TEXT,
 UNIQUE (organization_id,case_owner_id,case_id)
);
CREATE INDEX organization_summary_scope ON organization_case_summaries(organization_id,withdrawn_at);
CREATE TABLE organization_events (
 id TEXT PRIMARY KEY NOT NULL,
 organization_id TEXT NOT NULL REFERENCES organizations(id),
 actor_id TEXT NOT NULL,
 type TEXT NOT NULL,
 subject_id TEXT NOT NULL,
 created_at TEXT NOT NULL
);
CREATE INDEX organization_event_scope ON organization_events(organization_id,created_at);
