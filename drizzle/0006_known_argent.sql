CREATE TABLE `provider_account_events` (
	`id` text PRIMARY KEY NOT NULL,
	`provider_id` text NOT NULL,
	`user_id` text NOT NULL,
	`actor_id` text NOT NULL,
	`action` text NOT NULL,
	`revision` integer NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `provider_account_events_provider` ON `provider_account_events` (`provider_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `provider_accounts` (
	`provider_id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`linked_by` text NOT NULL,
	`linked_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `provider_accounts_user` ON `provider_accounts` (`user_id`);--> statement-breakpoint
CREATE TABLE `request_followup_events` (
	`id` text PRIMARY KEY NOT NULL,
	`request_id` text NOT NULL,
	`coordinator_id` text NOT NULL,
	`actor_id` text NOT NULL,
	`due_at` text NOT NULL,
	`note` text NOT NULL,
	`revision` integer NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `request_followup_events_request` ON `request_followup_events` (`request_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `request_followups` (
	`request_id` text PRIMARY KEY NOT NULL,
	`coordinator_id` text NOT NULL,
	`due_at` text NOT NULL,
	`note` text NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `request_professional_events` (
	`id` text PRIMARY KEY NOT NULL,
	`request_id` text NOT NULL,
	`actor_id` text NOT NULL,
	`action` text NOT NULL,
	`details` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `request_professional_events_request` ON `request_professional_events` (`request_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `request_professional_grants` (
	`request_id` text PRIMARY KEY NOT NULL,
	`provider_id` text NOT NULL,
	`professional_user_id` text NOT NULL,
	`provider_revision` integer NOT NULL,
	`quote_version` integer NOT NULL,
	`share_contact` integer NOT NULL,
	`share_home` integer NOT NULL,
	`share_photos` integer NOT NULL,
	`photo_ids` text DEFAULT '[]' NOT NULL,
	`consent_at` text NOT NULL,
	`revoked_at` text
);
--> statement-breakpoint
CREATE INDEX `request_professional_grants_user` ON `request_professional_grants` (`professional_user_id`,`consent_at`);