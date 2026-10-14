CREATE TABLE `payment_attempts` (
	`id` text PRIMARY KEY NOT NULL,
	`request_id` text NOT NULL,
	`quote_version` integer NOT NULL,
	`attempt` integer NOT NULL,
	`amount_cents` integer NOT NULL,
	`mode` text NOT NULL,
	`state` text NOT NULL,
	`session_id` text,
	`payment_intent_id` text,
	`amount_refunded_cents` integer DEFAULT 0 NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	CONSTRAINT "payment_attempt_positive" CHECK("payment_attempts"."attempt" > 0),
	CONSTRAINT "payment_amount_positive" CHECK("payment_attempts"."amount_cents" > 0),
	CONSTRAINT "payment_mode_valid" CHECK("payment_attempts"."mode" IN ('test', 'live')),
	CONSTRAINT "payment_state_valid" CHECK("payment_attempts"."state" IN ('creating', 'open', 'expired', 'paid')),
	CONSTRAINT "payment_refund_valid" CHECK("payment_attempts"."amount_refunded_cents" >= 0 AND "payment_attempts"."amount_refunded_cents" <= "payment_attempts"."amount_cents")
);
--> statement-breakpoint
CREATE UNIQUE INDEX `payment_attempts_session_id_unique` ON `payment_attempts` (`session_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `payment_attempts_payment_intent_id_unique` ON `payment_attempts` (`payment_intent_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `payment_attempt_number_unique` ON `payment_attempts` (`request_id`,`quote_version`,`mode`,`attempt`);--> statement-breakpoint
CREATE UNIQUE INDEX `payment_attempt_active_unique` ON `payment_attempts` (`request_id`,`quote_version`,`mode`) WHERE "payment_attempts"."state" <> 'expired';