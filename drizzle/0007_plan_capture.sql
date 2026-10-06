CREATE TABLE `funnel_counts` (
	`day` text NOT NULL,
	`event` text NOT NULL,
	`bucket` text DEFAULT '' NOT NULL,
	`total` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `funnel_counts_key` ON `funnel_counts` (`day`,`event`,`bucket`);--> statement-breakpoint
CREATE TABLE `lead_mail` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`kind` text NOT NULL,
	`recipient` text NOT NULL,
	`subject` text NOT NULL,
	`text` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`lease_until` text,
	`created_at` text NOT NULL,
	`accepted_at` text
);
--> statement-breakpoint
CREATE TABLE `saved_plan_events` (
	`id` text PRIMARY KEY NOT NULL,
	`plan_id` text NOT NULL,
	`actor_id` text NOT NULL,
	`action` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `saved_plans` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`case_id` text NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`postal_code` text NOT NULL,
	`phone` text NOT NULL,
	`contact_consent` integer NOT NULL,
	`share_consent` integer NOT NULL,
	`email_consent` integer NOT NULL,
	`snapshot` text NOT NULL,
	`created_at` text NOT NULL,
	`coordinator_id` text,
	`coordinator_name` text,
	`closed_at` text
);
--> statement-breakpoint
CREATE INDEX `saved_plans_owner` ON `saved_plans` (`user_id`,`created_at`);