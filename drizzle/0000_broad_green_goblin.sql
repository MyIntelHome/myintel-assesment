CREATE TABLE `case_archives` (
	`user_id` text PRIMARY KEY NOT NULL,
	`payload` text NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `payment_events` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `payment_session_unique` ON `payment_events` (`session_id`);--> statement-breakpoint
CREATE TABLE `providers` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`service` text NOT NULL,
	`area` text NOT NULL,
	`credentials` text NOT NULL,
	`verification_note` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `request_events` (
	`id` text PRIMARY KEY NOT NULL,
	`request_id` text NOT NULL,
	`actor_id` text NOT NULL,
	`status` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `events_request_created` ON `request_events` (`request_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `service_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`email` text NOT NULL,
	`service` text NOT NULL,
	`name` text NOT NULL,
	`postal_code` text NOT NULL,
	`phone` text DEFAULT '' NOT NULL,
	`contact_method` text NOT NULL,
	`relationship` text NOT NULL,
	`status` text DEFAULT 'submitted' NOT NULL,
	`consent_at` text NOT NULL,
	`provider_id` text,
	`scope` text DEFAULT '' NOT NULL,
	`amount_cents` integer,
	`quote_version` integer DEFAULT 0 NOT NULL,
	`payment_session_id` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `requests_user_created` ON `service_requests` (`user_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `requests_status_created` ON `service_requests` (`status`,`created_at`);