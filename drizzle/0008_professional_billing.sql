CREATE TABLE `professional_allocations` (
	`user_id` text NOT NULL,
	`case_id` text NOT NULL,
	`credit_id` text NOT NULL,
	`state` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `professional_case_allowance` ON `professional_allocations` (`user_id`,`case_id`);--> statement-breakpoint
CREATE TABLE `professional_billing` (
	`user_id` text PRIMARY KEY NOT NULL,
	`customer_id` text,
	`subscription_id` text,
	`subscription_status` text DEFAULT 'none' NOT NULL,
	`period_end` integer DEFAULT 0 NOT NULL,
	`blocked` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `professional_customer` ON `professional_billing` (`customer_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `professional_subscription` ON `professional_billing` (`subscription_id`);--> statement-breakpoint
CREATE TABLE `professional_checkouts` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`kind` text NOT NULL,
	`session_id` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `professional_checkout_session` ON `professional_checkouts` (`session_id`);--> statement-breakpoint
CREATE TABLE `professional_credits` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`kind` text NOT NULL,
	`quantity` integer NOT NULL,
	`expires_at` integer,
	`revoked` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `professional_credit_owner` ON `professional_credits` (`user_id`);