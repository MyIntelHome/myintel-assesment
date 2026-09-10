CREATE TABLE `home_handoffs` (
	`request_id` text PRIMARY KEY NOT NULL,
	`payload` text NOT NULL,
	`consent_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `home_photos` (
	`id` text PRIMARY KEY NOT NULL,
	`request_id` text NOT NULL,
	`room` text NOT NULL,
	`kind` text NOT NULL,
	`object_key` text NOT NULL,
	`ready` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `photos_request` ON `home_photos` (`request_id`);