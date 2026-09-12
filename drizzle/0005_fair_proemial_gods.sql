CREATE TABLE `public_auth_revocations` (
	`user_id` text PRIMARY KEY NOT NULL,
	`revoked_before` integer NOT NULL,
	`resetting` integer DEFAULT 0 NOT NULL
);
