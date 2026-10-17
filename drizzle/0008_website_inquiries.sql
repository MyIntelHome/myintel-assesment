CREATE TABLE website_inquiries (
 id text PRIMARY KEY NOT NULL,
 type text NOT NULL,
 name text NOT NULL,
 email text NOT NULL,
 phone text NOT NULL,
 relationship text NOT NULL,
 postal_code text NOT NULL,
 company_name text NOT NULL,
 role text NOT NULL,
 client_count text NOT NULL,
 message text NOT NULL,
 consent_at text NOT NULL,
 payload_hash text NOT NULL,
 created_at text NOT NULL,
 coordinator_id text,
 coordinator_name text,
 closed_at text
);
CREATE INDEX website_inquiries_queue ON website_inquiries(closed_at,created_at);
CREATE TABLE website_inquiry_events (
 id text PRIMARY KEY NOT NULL,
 inquiry_id text NOT NULL,
 actor_id text NOT NULL,
 action text NOT NULL,
 created_at text NOT NULL
);
CREATE TABLE website_inquiry_limits (
 key text PRIMARY KEY NOT NULL,
 window integer NOT NULL,
 attempts integer NOT NULL
);
